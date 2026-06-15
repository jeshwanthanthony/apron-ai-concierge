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
  add("Popular dishes", ctx.popular_dishes);
  add("Parking", ctx.parking_info);
  add("Delivery & pickup", ctx.delivery_pickup);
  add("Allergy info", ctx.allergy_info);
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
  history: HistoryItem[];
  question: string;
}): Promise<string> {
  const system =
    `You are ${opts.conciergeName || "the concierge"}, the friendly AI assistant for ${opts.restaurantName || "this restaurant"}. ` +
    "Answer guest questions using ONLY the information provided below. " +
    "Be warm, concise (1-3 sentences), and helpful. " +
    "If a relevant link is available (reservations, ordering, catering), share it. " +
    "If the information is not provided, politely say you're not sure and suggest contacting the restaurant directly. " +
    "Never invent prices, hours, or menu items that aren't given.\n\n" +
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
    body: JSON.stringify({ model: opts.model, messages, temperature: 0.3, max_tokens: 400 }),
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

        let payload: { restaurantId?: string; question?: string; history?: HistoryItem[] };
        try {
          payload = await request.json();
        } catch {
          return json({ error: "Invalid JSON body" }, 400);
        }

        const restaurantId = (payload.restaurantId || "").trim();
        const question = (payload.question || "").trim();
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
              match_count: 6,
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

        // Log the guest question + answer to the restaurant's history (best-effort).
        const { error: logError } = await supabase.rpc("log_guest_question", {
          p_restaurant_id: restaurantId,
          p_question: question,
          p_answer: answer,
          p_source: "widget",
        });
        if (logError) console.error("[concierge] log error:", logError);

        return json({ answer } satisfies { answer: string });
      },
    },
  },
});
