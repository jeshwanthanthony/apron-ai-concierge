// Browser-side helpers for turning an uploaded menu PDF into AI-searchable text.
import { supabase } from "@/integrations/supabase/client";

/** Extract plain text from a PDF File in the browser (lazy-loads unpdf). */
export async function extractPdfText(file: File): Promise<string> {
  const { getDocumentProxy, extractText } = await import("unpdf");
  const buffer = new Uint8Array(await file.arrayBuffer());
  const pdf = await getDocumentProxy(buffer);
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join("\n\n") : String(text || "");
}

/** Send extracted menu text to the server to be chunked + embedded for RAG. */
export async function ingestMenu(
  text: string,
  source: "menu" | "catering_menu" = "menu",
): Promise<number> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("You must be signed in");

  const res = await fetch("/api/ingest-menu", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ text, source }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Failed to index menu");
  return data.chunks ?? 0;
}

/**
 * Index a single named menu (multi-menu model). The server stores the text on
 * the menus row and re-embeds just that menu's chunks, tagging each with the
 * menu name so the concierge can tell guests which menu a dish is on.
 */
export async function ingestNamedMenu(opts: {
  menuId: string;
  name: string;
  text: string;
}): Promise<number> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("You must be signed in");

  const res = await fetch("/api/ingest-menu", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ menuId: opts.menuId, name: opts.name, text: opts.text }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Failed to index menu");
  return data.chunks ?? 0;
}
