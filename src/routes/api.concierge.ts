import { createFileRoute } from "@tanstack/react-router";
import { ensureEnv, serverClient, embedTexts, toVectorLiteral } from "@/lib/concierge-rag";

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
  tone?: string;
  history: HistoryItem[];
  question: string;
}): Promise<string> {
  const toneLine =
    opts.tone === "casual"
      ? "Speak casually and warmly, like a friendly neighborhood spot — relaxed, upbeat, and approachable."
      : opts.tone === "formal"
        ? "Speak with polished, refined hospitality, like an upscale fine-dining maître d' — gracious and composed."
        : "Speak warmly and professionally — friendly but composed.";

  const system =
    `You are ${opts.conciergeName || "the concierge"}, the AI host for ${opts.restaurantName || "this restaurant"} — a gracious host who genuinely loves welcoming guests.\n\n` +
    "Voice & style:\n" +
    `- ${toneLine}\n` +
    "- Be personable and genuinely engaging — never robotic or curt.\n" +
    "- Write 2-4 flowing sentences (a touch longer when the guest clearly wants detail). Paint a small, inviting picture rather than a flat one-liner.\n" +
    "- Open with a brief, friendly acknowledgement, then answer, then — when natural — a gentle next step or invitation (e.g. offer the reservation link, or suggest a dish).\n" +
    "- An occasional tasteful emoji (✨🍷🥂🌿) is welcome when it fits; never overdo it. No markdown headings; keep any list to 3 items max.\n\n" +
    "Accuracy:\n" +
    "- Ground every fact in the RESTAURANT INFORMATION and MENU below; prefer the owner-provided Q&A when it fits.\n" +
    "- When a guest wants to book, order, or cater, share the matching link if provided.\n" +
    "- If a specific detail isn't given, say so gracefully and offer to connect them with the restaurant — never invent prices, hours, or dishes.\n" +
    "- For severe-allergy questions, be careful: share what's known and always advise notifying staff on arrival.\n" +
    "- Recommend popular or fitting dishes when it helps, drawn only from the menu/info. Match the guest's language.\n\n" +
    "=== RESTAURANT INFORMATION ===\n" +
    opts.context;

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
    body: JSON.stringify({ model: opts.model, messages, temperature: 0.6, max_tokens: 600 }),
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
        // The free plan includes 20 lifetime guest messages plus a soft daily
        // cap. When the allowance is spent we respond gracefully WITHOUT calling
        // OpenAI or logging (which would burn more usage).
        if (!isPreview) {
          const { data: usageData } = await supabase.rpc("get_usage", {
            p_restaurant_id: restaurantId,
          });
          const usage = (usageData as { allowed?: boolean; reason?: string } | null) ?? null;
          if (usage && usage.allowed === false) {
            const answer =
              usage.reason === "daily"
                ? `Thanks for stopping by! ${ctx.name}'s AI concierge has answered all it can ` +
                  `for today — please check back tomorrow, or reach out to the restaurant directly. ✨`
                : `Thanks so much for stopping by! ${ctx.name}'s AI concierge has reached its free ` +
                  `limit for now. Please reach out to the restaurant directly and they'll be ` +
                  `delighted to help. ✨`;
            return json({ answer, limited: true, reason: usage.reason ?? "trial" });
          }
        }

        const apiKey = process.env.OPENAI_API_KEY;
        const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

        // RAG: embed the question and retrieve the most relevant menu chunks.
        // Falls back to the full menu text if retrieval yields nothing.
        let menuContext = "";
        if (apiKey) {
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
        if (!menuContext && typeof ctx.menu_text === "string" && ctx.menu_text.trim()) {
          menuContext = ctx.menu_text;
        }

        let context = buildContextPrompt(ctx);
        if (menuContext) context += "\n\n=== MENU (most relevant excerpts) ===\n" + menuContext;

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
              tone: ctx.bot_tone,
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
