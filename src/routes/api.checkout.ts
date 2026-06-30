import { createFileRoute } from "@tanstack/react-router";
import { ensureEnv, serverClient } from "@/lib/concierge-rag";
import { stripeConfig, stripeRequest, STRIPE_SETUP_FEE_PRICE, type PaidPlan } from "@/lib/stripe";

/**
 * Owner-only endpoint that starts a Stripe Checkout subscription.
 *
 *   POST /api/checkout  (Authorization: Bearer <user token>)
 *        { plan: "pro_monthly" | "pro_annual" }  ->  { url }
 *
 * Creates (or reuses) the restaurant's Stripe customer, opens a subscription
 * Checkout Session for the chosen plan, and returns the hosted-checkout URL for
 * the browser to redirect to. The actual plan flip happens later in the Stripe
 * webhook once payment succeeds.
 */

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export const Route = createFileRoute("/api/checkout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        await ensureEnv();

        const cfg = stripeConfig();
        if (!cfg.secret) return json({ error: "Billing isn't configured yet." }, 503);

        const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
        const token = authHeader && /^bearer /i.test(authHeader) ? authHeader.slice(7).trim() : null;
        if (!token) return json({ error: "Unauthorized" }, 401);

        let body: { plan?: string; withSetup?: boolean };
        try {
          body = await request.json();
        } catch {
          return json({ error: "Invalid JSON body" }, 400);
        }

        const plan = body.plan as PaidPlan;
        if (plan !== "pro_monthly" && plan !== "pro_quarterly" && plan !== "pro_annual") {
          return json({ error: "Invalid plan" }, 400);
        }
        const priceId = cfg.prices[plan];
        if (!priceId) return json({ error: `No Stripe price configured for ${plan}` }, 503);

        // Optional one-time setup fee, billed once on the first invoice.
        const lineItems: Array<{ price: string; quantity: number }> = [{ price: priceId, quantity: 1 }];
        if (body.withSetup) lineItems.push({ price: STRIPE_SETUP_FEE_PRICE, quantity: 1 });

        const supabase = serverClient(token);
        const { data: userData, error: userErr } = await supabase.auth.getUser(token);
        if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);
        const user = userData.user;

        const { data: restaurant, error: restErr } = await supabase
          .from("restaurants")
          .select("id, name, stripe_customer_id")
          .eq("user_id", user.id)
          .maybeSingle();
        if (restErr) return json({ error: restErr.message }, 500);
        if (!restaurant) return json({ error: "No restaurant for this user" }, 404);

        // Reuse an existing Stripe customer or create one tied to this restaurant.
        let customerId = restaurant.stripe_customer_id;
        if (!customerId) {
          const customer = await stripeRequest<{ id: string }>("/customers", "POST", {
            email: user.email,
            name: restaurant.name || undefined,
            metadata: { restaurant_id: restaurant.id, user_id: user.id },
          });
          customerId = customer.id;
          await supabase.from("restaurants").update({ stripe_customer_id: customerId }).eq("id", restaurant.id);
        }

        const origin =
          request.headers.get("origin") ||
          (process.env.PUBLIC_APP_URL ?? new URL(request.url).origin);

        const session = await stripeRequest<{ url: string }>("/checkout/sessions", "POST", {
          mode: "subscription",
          customer: customerId,
          client_reference_id: restaurant.id,
          allow_promotion_codes: true,
          "line_items": lineItems,
          subscription_data: { metadata: { restaurant_id: restaurant.id, plan } },
          metadata: { restaurant_id: restaurant.id, plan },
          success_url: `${origin}/dashboard?upgraded=1`,
          cancel_url: `${origin}/dashboard?canceled=1`,
        });

        return json({ url: session.url });
      },
    },
  },
});
