import { createFileRoute } from "@tanstack/react-router";
import { ensureEnv } from "@/lib/concierge-rag";
import { verifyStripeEvent, serviceClient, planForPrice, type PaidPlan } from "@/lib/stripe";

/**
 * Stripe webhook receiver.
 *
 *   POST /api/stripe-webhook  (Stripe-Signature: ...)
 *
 * Verifies the signature (Web Crypto HMAC), then keeps each restaurant's plan in
 * sync with its Stripe subscription. Runs with the Supabase service role so it
 * can update any restaurant by its Stripe customer id (bypassing RLS).
 *
 * Configure in Stripe: send `checkout.session.completed`,
 * `customer.subscription.updated`, and `customer.subscription.deleted`.
 */

const ok = (body: unknown = { received: true }) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
const bad = (msg: string, status = 400) =>
  new Response(JSON.stringify({ error: msg }), { status, headers: { "Content-Type": "application/json" } });

function planFromSubscription(sub: any): PaidPlan | null {
  const metaPlan = sub?.metadata?.plan;
  if (metaPlan === "pro_monthly" || metaPlan === "pro_annual") return metaPlan;
  const priceId = sub?.items?.data?.[0]?.price?.id;
  return planForPrice(priceId);
}

export const Route = createFileRoute("/api/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        await ensureEnv();

        const payload = await request.text();
        const sig = request.headers.get("stripe-signature");
        const event = await verifyStripeEvent(payload, sig);
        if (!event) return bad("Invalid signature", 400);

        let supabase;
        try {
          supabase = serviceClient();
        } catch {
          // No service role configured — acknowledge so Stripe stops retrying,
          // but log loudly so it's noticed during setup.
          console.error("[stripe-webhook] SUPABASE_SERVICE_ROLE_KEY not set");
          return ok({ received: true, skipped: true });
        }

        const updateByCustomer = async (
          customerId: string,
          fields: { plan: string; plan_status: string; stripe_subscription_id?: string | null },
        ) => {
          if (!customerId) return;
          const { error } = await supabase
            .from("restaurants")
            .update(fields)
            .eq("stripe_customer_id", customerId);
          if (error) console.error("[stripe-webhook] update error:", error.message);
        };

        try {
          switch (event.type) {
            case "checkout.session.completed": {
              const session = event.data.object;
              const customerId = session.customer as string;
              const subscriptionId = session.subscription as string | null;
              let plan: PaidPlan | null =
                session.metadata?.plan === "pro_monthly" || session.metadata?.plan === "pro_annual"
                  ? session.metadata.plan
                  : null;

              // Pull the subscription to confirm the plan + status.
              if (subscriptionId && !plan) {
                const { stripeRequest } = await import("@/lib/stripe");
                const sub = await stripeRequest(`/subscriptions/${subscriptionId}`, "GET");
                plan = planFromSubscription(sub);
              }
              await updateByCustomer(customerId, {
                plan: plan ?? "pro_monthly",
                plan_status: "active",
                stripe_subscription_id: subscriptionId,
              });
              break;
            }

            case "customer.subscription.updated": {
              const sub = event.data.object;
              const customerId = sub.customer as string;
              const status = sub.status as string; // active, past_due, canceled, ...
              const plan = planFromSubscription(sub);
              const active = status === "active" || status === "trialing";
              await updateByCustomer(customerId, {
                plan: active ? (plan ?? "pro_monthly") : "free",
                plan_status: status,
                stripe_subscription_id: sub.id,
              });
              break;
            }

            case "customer.subscription.deleted": {
              const sub = event.data.object;
              const customerId = sub.customer as string;
              await updateByCustomer(customerId, {
                plan: "free",
                plan_status: "canceled",
                stripe_subscription_id: null,
              });
              break;
            }

            default:
              // Ignore everything else.
              break;
          }
        } catch (err) {
          console.error("[stripe-webhook] handler error:", err);
          // Still 200 so Stripe doesn't hammer retries on a transient issue we've logged.
        }

        return ok();
      },
    },
  },
});
