// Master switch for monetization.
//
// While `false`: no usage limits, no daily caps, no "out of messages"
// notifications, and the dashboard "Plan & Usage" section + Stripe upgrade
// flow are hidden. The concierge answers every guest for free.
//
// Flip to `true` to re-enable everything we already built — the usage gate in
// /api/concierge, the Plan & Usage card, and Stripe billing (/api/checkout,
// /api/stripe-webhook, /api/billing-portal). All of that code stays in the
// repo on purpose, so turning paid plans back on is a one-line change here
// (plus setting the Stripe env vars — see DEPLOY.md).
export const BILLING_ENABLED = true;
