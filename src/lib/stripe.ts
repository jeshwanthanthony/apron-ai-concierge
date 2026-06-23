// Server-only, dependency-free Stripe helpers.
//
// We talk to the Stripe REST API with `fetch` and verify webhook signatures
// with the Web Crypto API, so this runs natively on Cloudflare's edge runtime
// (no Node-only `stripe` SDK, nothing to install).
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { ensureEnv } from "@/lib/concierge-rag";

const STRIPE_API = "https://api.stripe.com/v1";

export type PaidPlan = "pro_monthly" | "pro_annual";

export function stripeConfig() {
  return {
    secret: process.env.STRIPE_SECRET_KEY || "",
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
    prices: {
      pro_monthly: process.env.STRIPE_PRICE_MONTHLY || "",
      pro_annual: process.env.STRIPE_PRICE_ANNUAL || "",
    } as Record<PaidPlan, string>,
  };
}

/** Map a Stripe price id back to one of our plan ids. */
export function planForPrice(priceId: string | null | undefined): PaidPlan | null {
  if (!priceId) return null;
  const { prices } = stripeConfig();
  if (priceId === prices.pro_monthly) return "pro_monthly";
  if (priceId === prices.pro_annual) return "pro_annual";
  return null;
}

/** Flatten a nested params object into Stripe's bracketed form-encoding. */
function encodeForm(obj: Record<string, unknown>, prefix = ""): string[] {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null) continue;
    const k = prefix ? `${prefix}[${key}]` : key;
    if (typeof value === "object" && !Array.isArray(value)) {
      parts.push(...encodeForm(value as Record<string, unknown>, k));
    } else if (Array.isArray(value)) {
      value.forEach((v, i) => {
        if (typeof v === "object") parts.push(...encodeForm(v as Record<string, unknown>, `${k}[${i}]`));
        else parts.push(`${encodeURIComponent(`${k}[${i}]`)}=${encodeURIComponent(String(v))}`);
      });
    } else {
      parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(value))}`);
    }
  }
  return parts;
}

/** Call the Stripe REST API. Throws on non-2xx. */
export async function stripeRequest<T = any>(
  path: string,
  method: "GET" | "POST",
  params?: Record<string, unknown>,
): Promise<T> {
  await ensureEnv();
  const { secret } = stripeConfig();
  if (!secret) throw new Error("Stripe is not configured (missing STRIPE_SECRET_KEY)");

  const headers: Record<string, string> = {
    Authorization: `Bearer ${secret}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };
  const body = params ? encodeForm(params).join("&") : undefined;
  const resp = await fetch(`${STRIPE_API}${path}`, { method, headers, body });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const msg = (data as any)?.error?.message || `Stripe ${resp.status}`;
    throw new Error(msg);
  }
  return data as T;
}

/** Constant-time-ish string compare. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Verify a Stripe webhook signature using Web Crypto (HMAC-SHA256).
 * Returns the parsed event on success, or null if verification fails.
 */
export async function verifyStripeEvent(
  payload: string,
  sigHeader: string | null,
  toleranceSec = 300,
): Promise<any | null> {
  const { webhookSecret } = stripeConfig();
  if (!webhookSecret || !sigHeader) return null;

  const parts = Object.fromEntries(
    sigHeader.split(",").map((kv) => {
      const idx = kv.indexOf("=");
      return [kv.slice(0, idx).trim(), kv.slice(idx + 1).trim()];
    }),
  ) as Record<string, string>;
  const timestamp = parts["t"];
  const signature = parts["v1"];
  if (!timestamp || !signature) return null;

  // Reject stale timestamps to blunt replay attacks.
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(timestamp)) > toleranceSec) return null;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(webhookSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(`${timestamp}.${payload}`));
  const expected = toHex(mac);
  if (!safeEqual(expected, signature)) return null;

  try {
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

/**
 * Service-role Supabase client. Bypasses RLS — use ONLY in trusted server
 * contexts (e.g. the Stripe webhook updating a restaurant's plan).
 */
export function serviceClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Supabase service role not configured");
  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
