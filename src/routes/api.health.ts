import { createFileRoute } from "@tanstack/react-router";
import { ensureEnv, serverClient } from "@/lib/concierge-rag";

/**
 * Health / deploy check: GET /api/health
 *
 * Lets us confirm — in one click — whether the DEPLOYED worker has the current
 * build and can reach Supabase. If `supabaseReachable` is true, the concierge
 * and widget-config will work. BUILD bumps whenever this file is rebuilt, so a
 * stale deploy is obvious.
 */

const BUILD = "2026-07-creds-inline-1";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    },
  });

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        await ensureEnv();
        const out: Record<string, unknown> = { ok: true, build: BUILD };
        try {
          const sb = serverClient();
          out.supabaseConfigured = true;
          const { error } = await sb.from("restaurants").select("id").limit(1);
          out.supabaseReachable = !error;
          if (error) out.dbError = error.message;
        } catch (e) {
          out.supabaseConfigured = false;
          out.error = e instanceof Error ? e.message : String(e);
        }
        out.hasOpenAIKey = !!process.env.OPENAI_API_KEY;
        return json(out);
      },
    },
  },
});
