import { createFileRoute } from "@tanstack/react-router";
import { ensureEnv, serverClient, chunkText, embedTexts, toVectorLiteral } from "@/lib/concierge-rag";

/**
 * Owner-only endpoint that indexes a restaurant's menu for RAG.
 *
 *   POST /api/ingest-menu  (Authorization: Bearer <user token>)
 *        { source?: "menu" | "catering_menu", text }  ->  { chunks }
 *
 * The dashboard extracts the PDF's text in the browser and posts it here. We
 * chunk it, embed each chunk via OpenAI, and store the vectors in menu_chunks
 * (replacing any previous chunks for that source). Writes use the caller's token
 * so row-level security still applies.
 */

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const Route = createFileRoute("/api/ingest-menu")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        await ensureEnv();

        const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
        const token = authHeader && /^bearer /i.test(authHeader) ? authHeader.slice(7).trim() : null;
        if (!token) return json({ error: "Unauthorized" }, 401);

        let body: { source?: string; text?: string };
        try {
          body = await request.json();
        } catch {
          return json({ error: "Invalid JSON body" }, 400);
        }

        const source = body.source === "catering_menu" ? "catering_menu" : "menu";
        const text = (body.text || "").toString();

        const supabase = serverClient(token);

        // Identify the caller and their restaurant (RLS-scoped).
        const { data: userData, error: userErr } = await supabase.auth.getUser(token);
        if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);

        const { data: restaurant, error: restErr } = await supabase
          .from("restaurants")
          .select("id")
          .eq("user_id", userData.user.id)
          .maybeSingle();
        if (restErr) return json({ error: restErr.message }, 500);
        if (!restaurant) return json({ error: "No restaurant for this user" }, 404);
        const restaurantId = restaurant.id;

        // Keep a copy of the full text (fallback + transparency), then re-index.
        await supabase.from("restaurants").update({ menu_text: text.slice(0, 50000) }).eq("id", restaurantId);
        await supabase.from("menu_chunks").delete().eq("restaurant_id", restaurantId).eq("source", source);

        const chunks = chunkText(text);
        if (chunks.length === 0) return json({ chunks: 0 });

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) return json({ error: "OPENAI_API_KEY is not set on the server" }, 400);

        let embeddings: number[][];
        try {
          embeddings = await embedTexts(apiKey, chunks);
        } catch (err) {
          console.error("[ingest-menu] embedding error:", err);
          return json({ error: "Failed to generate embeddings" }, 502);
        }

        const rows = chunks.map((content, i) => ({
          restaurant_id: restaurantId,
          source,
          chunk_index: i,
          content,
          embedding: toVectorLiteral(embeddings[i]),
        }));

        const { error: insErr } = await supabase.from("menu_chunks").insert(rows);
        if (insErr) return json({ error: insErr.message }, 500);

        return json({ chunks: rows.length });
      },
    },
  },
});
