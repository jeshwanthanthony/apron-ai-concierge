import { createFileRoute } from "@tanstack/react-router";
import { ensureEnv, serverClient } from "@/lib/concierge-rag";

/**
 * Public widget appearance config: GET /api/widget-config?r=<restaurantId>
 *
 * The embeddable widget fetches this on load so dashboard appearance changes
 * (color, name, welcome, button labels/links) apply live — without the owner
 * having to re-copy the snippet.
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const json = (body: unknown, status = 200, extraHeaders: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS, ...extraHeaders },
  });

export const Route = createFileRoute("/api/widget-config")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),

      GET: async ({ request }) => {
        await ensureEnv();
        const id = new URL(request.url).searchParams.get("r")?.trim();
        if (!id) return json({ error: "missing restaurant id" }, 400);

        const supabase = serverClient();
        const { data, error } = await supabase.rpc("get_widget_config", { p_restaurant_id: id });
        if (error) return json({ error: "Could not load config" }, 500);
        if (!data) return json({ error: "Unknown restaurant" }, 404);

        // Cache briefly at the edge so it's snappy but still reflects edits quickly.
        return json(data, 200, { "Cache-Control": "public, max-age=30" });
      },
    },
  },
});
