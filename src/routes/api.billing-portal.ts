import { createFileRoute } from "@tanstack/react-router";
import { ensureEnv, serverClient } from "@/lib/concierge-rag";
import { stripeConfig, stripeRequest } from "@/lib/stripe";

/**
 * Owner-only endpoint that opens the Stripe Billing Portal so a paying
 * restaurant can update their card, change plan, or cancel.
 *
 *   POST /api/billing-portal  (Authorization: Bearer <user token>)  ->  { url }
 */

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export const Route = createFileRoute("/api/billing-portal")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        await ensureEnv();
        if (!stripeConfig().secret) return json({ error: "Billing isn't configured yet." }, 503);

        const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
        const token = authHeader && /^bearer /i.test(authHeader) ? authHeader.slice(7).trim() : null;
        if (!token) return json({ error: "Unauthorized" }, 401);

        const supabase = serverClient(token);
        const { data: userData, error: userErr } = await supabase.auth.getUser(token);
        if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);

        const { data: restaurant } = await supabase
          .from("restaurants")
          .select("stripe_customer_id")
          .eq("user_id", userData.user.id)
          .maybeSingle();
        if (!restaurant?.stripe_customer_id) return json({ error: "No billing account yet." }, 404);

        const origin =
          request.headers.get("origin") ||
          (process.env.PUBLIC_APP_URL ?? new URL(request.url).origin);

        const portal = await stripeRequest<{ url: string }>("/billing_portal/sessions", "POST", {
          customer: restaurant.stripe_customer_id,
          return_url: `${origin}/dashboard`,
        });

        return json({ url: portal.url });
      },
    },
  },
});
