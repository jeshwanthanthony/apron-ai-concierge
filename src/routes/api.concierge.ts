import { createFileRoute } from "@tanstack/react-router";
import { ensureEnv, serverClient, embedTexts, toVectorLiteral } from "@/lib/concierge-rag";
import { BILLING_ENABLED } from "@/lib/flags";
import { personaById, answerLengthById } from "@/lib/ai-persona";

/**
 * Public AI concierge endpoint used by the embeddable widget.
 *
 *   POST /api/concierge  { restaurantId, question, history? }  ->  { answer }
 *
 * RAG flow: load the restaurant's guest-facing context (profile + owner Q&A) via
 * a SECURITY DEFINER RPC, embed the guest's question, retrieve the most relevant
 * menu chunks (pgvector), ask OpenAI for a concise grounded answer, and log the
 * question. The OpenAI key is read from server-side env only (OPENAI_API_KEY in
 * `.env.local`) and never reaches the browser.
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });

type HistoryItem = { role: "user" | "assistant"; content: string };

const DAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_LABELS: Record<string, string> = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };

function formatHours(hours: any): string {
  if (!hours || typeof hours !== "object") return "";
  const parts: string[] = [];
  for (const d of DAY_ORDER) {
    const h = hours[d];
    if (!h) continue;
    if (h.closed) {
      parts.push(`${DAY_LABELS[d]}: Closed`);
    } else if (h.open && h.close) {
      let s = `${DAY_LABELS[d]}: ${h.open}–${h.close}`;
      if (h.kitchen_close) s += ` (kitchen until ${h.kitchen_close})`;
      parts.push(s);
    }
  }
  return parts.join("; ");
}

function petLabel(v: string): string {
  return v === "patio" ? "Dogs welcome on the patio" : v === "service_only" ? "Service animals only" : v === "none" ? "No pets allowed" : "";
}
function dressLabel(v: string): string {
  return v === "casual" ? "Casual" : v === "smart_casual" ? "Smart casual" : v === "business_formal" ? "Business / formal attire" : "";
}

function buildContextPrompt(ctx: Record<string, any>): string {
  const lines: string[] = [];
  const add = (label: string, v: unknown) => {
    if (v !== null && v !== undefined && String(v).trim() !== "") lines.push(`${label}: ${v}`);
  };
  add("Restaurant name", ctx.name);
  add("Cuisine", ctx.cuisine_type);

  const menuNames: string[] = Array.isArray(ctx.menu_names)
    ? ctx.menu_names.filter((n: unknown) => typeof n === "string" && n.trim())
    : [];
  if (menuNames.length) {
    lines.push(
      `Menus offered: ${menuNames.join(", ")}. ` +
        "When relevant, you may tell the guest which menu a dish appears on.",
    );
  }

  add("About", ctx.story);
  add("Address", ctx.address);
  add("Phone", ctx.phone);
  add("Email", ctx.email);
  add("Website", ctx.website_url);

  const hoursStr = formatHours(ctx.hours);
  if (hoursStr) lines.push(`Hours: ${hoursStr}`);
  add("Holiday & special hours", ctx.holiday_hours);

  add("Popular dishes", ctx.popular_dishes);
  add("Daily specials", ctx.daily_specials);
  add("Parking & transit", ctx.parking_info);
  add("Delivery & pickup", ctx.delivery_pickup);

  const pets = petLabel(ctx.pet_policy);
  if (pets) lines.push(`Pet policy: ${pets}`);
  const dress = dressLabel(ctx.dress_code);
  if (dress) lines.push(`Dress code: ${dress}`);

  const allergens: string[] = Array.isArray(ctx.allergens) ? ctx.allergens : [];
  if (allergens.length) {
    lines.push(
      `Allergens present in the kitchen: ${allergens.join(", ")}. If a guest mentions a severe allergy, always remind them to notify staff on arrival.`,
    );
  }
  add("Allergen & safety note", ctx.allergy_info);

  add("Reservation link", ctx.reservation_link);
  add("Online ordering link", ctx.order_online_link);
  add("Catering link", ctx.catering_link);
  add("Instagram", ctx.instagram_link);
  add("Google Maps", ctx.google_maps_link);

  const diet = ctx.dietary || {};
  const dietList = [
    diet.vegan && "vegan",
    diet.vegetarian && "vegetarian",
    diet.gluten_free && "gluten-free",
    diet.halal && "halal",
  ].filter(Boolean);
  if (dietList.length) lines.push(`Dietary options: ${dietList.join(", ")}`);

  const faqs: Array<{ question: string; answer: string }> = Array.isArray(ctx.faqs) ? ctx.faqs : [];
  if (faqs.length) {
    lines.push("\nOwner-provided Q&A (prefer these answers when relevant):");
    faqs.forEach((f) => lines.push(`Q: ${f.question}\nA: ${f.answer}`));
  }
  return lines.join("\n");
}

async function askOpenAI(opts: {
  apiKey: string;
  model: string;
  context: string;
  conciergeName: string;
  restaurantName: string;
  persona?: string;
  answerLength?: string;
  customInstructions?: string;
  history: HistoryItem[];
  question: string;
}): Promise<string> {
  const persona = personaById(opts.persona);
  const length = answerLengthById(opts.answerLength);
  const custom = (opts.customInstructions || "").trim().slice(0, 1000);

  let system =
    `You are ${opts.conciergeName || "the concierge"}, the AI host for ${opts.restaurantName || "this restaurant"}.\n\n` +
    "Voice & style:\n" +
    `- Be ${persona.voice}\n` +
    `- ${length.instruction}\n` +
    "- Be personable and genuinely engaging — never robotic or curt.\n" +
    "- Open with a brief acknowledgement, answer the question, then — when natural — offer a gentle next step (a reservation link, a dish suggestion).\n" +
    "- No markdown headings; keep any list to 3 items max.\n\n" +
    "Accuracy:\n" +
    "- Ground every fact in the RESTAURANT INFORMATION and MENUS below; prefer the owner-provided Q&A when it fits.\n" +
    "- When a guest wants to book, order, or cater, share the matching link if provided.\n" +
    "- If a specific detail isn't given, say so gracefully and offer to connect them with the restaurant — never invent prices, hours, or dishes.\n" +
    "- For severe-allergy questions, be careful: share what's known and always advise notifying staff on arrival.\n" +
    "- Recommend fitting dishes when it helps, drawn only from the menu/info. Match the guest's language.";

  if (custom) {
    // Owner's custom instructions are a strong steer, but must never override the
    // accuracy rules above (don't invent facts, respect safety).
    system +=
      "\n\nOwner's custom instructions (follow closely, but never contradict the accuracy rules):\n" +
      custom;
  }

  system += "\n\n=== RESTAURANT INFORMATION ===\n" + opts.context;

  const messages = [
    { role: "system", content: system },
    ...opts.history.slice(-8),
    { role: "user", content: opts.question },
  ];

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({ model: opts.model, messages, temperature: 0.6, max_tokens: length.maxTokens }),
  });

  if (!resp.ok) {
    const detail = await resp.text().catch(() => "");
    throw new Error(`OpenAI ${resp.status}: ${detail.slice(0, 300)}`);
  }
  const data = await resp.json();
  const answer = data?.choices?.[0]?.message?.content?.trim();
  if (!answer) throw new Error("OpenAI returned an empty response");
  return answer;
}

export const Route = createFileRoute("/api/concierge")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),

      POST: async ({ request }) => {
        await ensureEnv();

        let payload: { restaurantId?: string; question?: string; history?: HistoryItem[]; source?: string };
        try {
          payload = await request.json();
        } catch {
          return json({ error: "Invalid JSON body" }, 400);
        }

        const restaurantId = (payload.restaurantId || "").trim();
        const question = (payload.question || "").trim();
        // "preview" = the owner testing in their own dashboard. These are free:
        // they never count toward the guest allowance and aren't logged as
        // guest questions. Everything else is treated as a real guest message.
        const isPreview = payload.source === "preview";
        const history = Array.isArray(payload.history)
          ? payload.history
              .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
              .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }))
          : [];

        if (!restaurantId) return json({ error: "restaurantId is required" }, 400);
        if (!question) return json({ error: "question is required" }, 400);
        if (question.length > 2000) return json({ error: "question is too long" }, 400);

        const supabase = serverClient();

        // Load the restaurant's guest-facing context.
        const { data: ctxData, error: ctxError } = await supabase.rpc("get_concierge_context", {
          p_restaurant_id: restaurantId,
        });
        if (ctxError) return json({ error: "Could not load restaurant" }, 500);
        const ctx = (ctxData as Record<string, any> | null) ?? null;
        if (!ctx || !ctx.name) {
          return json({ error: "Unknown restaurant" }, 404);
        }

        // Usage gate (guest messages only — owner previews are always free).
        // Model: free plan = 50 guest messages / month, paid plans = unlimited.
        // When the free allowance is spent we reply gracefully WITHOUT calling
        // OpenAI or logging (which would burn more usage); the owner upgrades
        // from their dashboard.
        // Paywall is OFF while BILLING_ENABLED is false: the concierge answers
        // every guest for free (usage is still logged for analytics). Flip the
        // flag in src/lib/flags.ts to re-enable the monthly cap + upgrade flow.
        if (!isPreview && BILLING_ENABLED) {
          const { data: usageData } = await supabase.rpc("get_usage", {
            p_restaurant_id: restaurantId,
          });
          const usage =
            (usageData as { beta_allowed?: boolean } | null) ?? null;

          if (usage && usage.beta_allowed === false) {
            return json({
              answer:
                `Thanks for stopping by! ${ctx.name}'s AI concierge has reached its limit for ` +
                `this month — please reach out to the restaurant directly and they'll be happy ` +
                `to help. ✨`,
              limited: true,
              reason: "month",
            });
          }
        }

        const apiKey = process.env.OPENAI_API_KEY;
        const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

        // RAG: embed the question and retrieve the most relevant menu chunks.
        // Cost optimization: only spend an embeddings call when the restaurant
        // actually has menu content to search; otherwise skip straight to the
        // profile + Q&A context.
        // Only spend an embeddings call when there is actual menu CONTENT to
        // search. ctx.menus only includes menus with non-empty text, so an empty
        // "Add a menu" placeholder won't trigger wasted retrieval calls.
        const hasMenu =
          (Array.isArray(ctx.menus) && ctx.menus.length > 0) ||
          (typeof ctx.menu_text === "string" && ctx.menu_text.trim() !== "");

        let menuContext = "";
        if (apiKey && hasMenu) {
          try {
            const [qEmbedding] = await embedTexts(apiKey, [question]);
            const { data: matches } = await supabase.rpc("match_menu_chunks", {
              p_restaurant_id: restaurantId,
              query_embedding: toVectorLiteral(qEmbedding),
              match_count: 8,
            });
            if (matches && matches.length) {
              menuContext = matches.map((m: { content: string }) => m.content).join("\n---\n");
            }
          } catch (err) {
            console.error("[concierge] retrieval error:", err);
          }
        }
        // Fallback grounding when retrieval is empty: labeled menu text per menu.
        if (!menuContext) {
          const menus: Array<{ name?: string; text?: string }> = Array.isArray(ctx.menus) ? ctx.menus : [];
          if (menus.length) {
            menuContext = menus
              .filter((m) => m && typeof m.text === "string" && m.text.trim())
              .map((m) => `[${(m.name || "Menu").trim()}]\n${m.text}`)
              .join("\n\n");
          } else if (typeof ctx.menu_text === "string" && ctx.menu_text.trim()) {
            menuContext = ctx.menu_text;
          }
        }

        let context = buildContextPrompt(ctx);
        if (menuContext) context += "\n\n=== MENUS (most relevant excerpts) ===\n" + menuContext;

        // Generate an answer (or a graceful fallback if the key isn't set yet).
        let answer: string;
        try {
          if (!apiKey) {
            answer =
              "Thanks for your message! Our AI concierge isn't fully switched on yet — " +
              "please reach out to us directly and we'll be happy to help.";
          } else {
            answer = await askOpenAI({
              apiKey,
              model,
              context,
              conciergeName: ctx.concierge_name,
              restaurantName: ctx.name,
              persona: ctx.ai_persona,
              answerLength: ctx.ai_answer_length,
              customInstructions: ctx.ai_custom_instructions,
              history,
              question,
            });
          }
        } catch (err) {
          console.error("[concierge] OpenAI error:", err);
          answer =
            "Sorry — I'm having trouble answering right now. Please try again in a moment, " +
            "or contact the restaurant directly.";
        }

        // Log the guest question + answer (which also increments usage).
        // Owner previews are free and never logged.
        if (!isPreview) {
          const { error: logError } = await supabase.rpc("log_guest_question", {
            p_restaurant_id: restaurantId,
            p_question: question,
            p_answer: answer,
            p_source: "widget",
          });
          if (logError) console.error("[concierge] log error:", logError);
        }

        return json({ answer });
      },
    },
  },
});
