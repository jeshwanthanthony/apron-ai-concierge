import { createFileRoute } from "@tanstack/react-router";

/**
 * Free address autocomplete proxy (no API key needed).
 *
 *   GET /api/geocode?q=214+columbus  ->  { suggestions: [{ label, ... }] }
 *
 * Proxies OpenStreetMap's Photon geocoder server-side so the browser never
 * hits a third-party origin (no CORS, no key, no billing). Swap the upstream
 * for Google Places later if you want — the client contract stays the same.
 */

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=60" },
  });

function labelFor(p: Record<string, any>): { line1: string; line2: string; label: string } {
  const line1 = [p.housenumber, p.street || p.name].filter(Boolean).join(" ").trim();
  const line2 = [p.city || p.town || p.village, p.state, p.postcode, p.country]
    .filter(Boolean)
    .join(", ");
  const label = [line1, line2].filter(Boolean).join(", ");
  return { line1: line1 || p.name || "", line2, label };
}

export const Route = createFileRoute("/api/geocode")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const q = new URL(request.url).searchParams.get("q")?.trim() || "";
        if (q.length < 3) return json({ suggestions: [] });

        try {
          const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6&lang=en`;
          const res = await fetch(url, { headers: { "User-Agent": "maitre-concierge/1.0" } });
          if (!res.ok) return json({ suggestions: [] });
          const data = await res.json();
          const suggestions = (data.features || [])
            .map((f: any) => labelFor(f.properties || {}))
            .filter((s: { label: string }) => s.label.length > 0);
          return json({ suggestions });
        } catch {
          return json({ suggestions: [] });
        }
      },
    },
  },
});
