// Server-only helpers shared by the concierge + menu-ingestion routes.
// Handles env loading, OpenAI embeddings, text chunking, and pgvector literals.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export const EMBEDDING_MODEL = "text-embedding-3-small"; // 1536 dims, very cheap

// Local dev: `vite dev` doesn't reliably populate process.env for non-VITE vars
// (and `.env.local` in particular). Read the env files ourselves (server-only)
// so OPENAI_API_KEY is available without exposing it to the client. Real hosting
// env vars always win — we never overwrite an existing value.
let envLoaded = false;
export async function ensureEnv() {
  if (envLoaded) return;
  envLoaded = true;
  try {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    for (const file of [".env.local", ".env"]) {
      let text = "";
      try {
        text = readFileSync(resolve(process.cwd(), file), "utf8");
      } catch {
        continue;
      }
      for (const raw of text.split("\n")) {
        const line = raw.trim();
        if (!line || line.startsWith("#")) continue;
        const eq = line.indexOf("=");
        if (eq === -1) continue;
        const key = line.slice(0, eq).trim();
        let val = line.slice(eq + 1).trim();
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1);
        }
        if (key && process.env[key] === undefined) process.env[key] = val;
      }
    }
  } catch {
    /* fs unavailable (edge runtime) — rely on real env vars */
  }
}

/** Build a server Supabase client. Pass an access token to act as that user (RLS). */
export function serverClient(accessToken?: string) {
  // The Supabase URL + publishable (anon) key are PUBLIC. We reference the
  // EXACT `import.meta.env.VITE_*` literals so Vite inlines them at build time
  // (same as the browser client). This is what makes server routes work on
  // Cloudflare, where process.env has no Supabase vars at runtime.
  const url =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    import.meta.env.VITE_SUPABASE_URL;
  const anon =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !anon) throw new Error("Supabase env not configured");
  return createClient<Database>(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : undefined,
  });
}

/** Format a number[] as a pgvector literal string: [0.1,0.2,...]. */
export function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

/**
 * Split text into overlapping chunks, preferring paragraph boundaries.
 * Tuned for menus / short documents.
 */
export function chunkText(text: string, opts?: { size?: number; overlap?: number }): string[] {
  const size = opts?.size ?? 1200;
  const overlap = opts?.overlap ?? 200;
  const clean = String(text || "")
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!clean) return [];

  const paras = clean.split(/\n\s*\n/);
  const packed: string[] = [];
  let cur = "";
  for (const p of paras) {
    const piece = p.trim();
    if (!piece) continue;
    if (cur && (cur + "\n\n" + piece).length > size) {
      packed.push(cur);
      const tail = cur.slice(Math.max(0, cur.length - overlap));
      cur = tail + "\n\n" + piece;
    } else {
      cur = cur ? cur + "\n\n" + piece : piece;
    }
  }
  if (cur) packed.push(cur);

  // Hard-split anything still oversized.
  const out: string[] = [];
  for (const c of packed) {
    if (c.length <= size * 1.5) {
      out.push(c);
      continue;
    }
    for (let i = 0; i < c.length; i += size - overlap) out.push(c.slice(i, i + size));
  }
  return out.slice(0, 200); // safety cap
}

/** Embed one or more texts via OpenAI. Returns one vector per input. */
export async function embedTexts(apiKey: string, inputs: string[]): Promise<number[][]> {
  if (inputs.length === 0) return [];
  const resp = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: inputs }),
  });
  if (!resp.ok) {
    const detail = await resp.text().catch(() => "");
    throw new Error(`OpenAI embeddings ${resp.status}: ${detail.slice(0, 300)}`);
  }
  const data = await resp.json();
  return (data.data as Array<{ embedding: number[] }>).map((d) => d.embedding);
}
