# Launch runbook — going live on Cloudflare

This is the end-to-end checklist to put the app live on **hirematrie.com**.
Do the steps in order. Anything marked **(one-time)** you only ever do once.

> **Billing is currently OFF.** The app is free + unlimited for everyone right
> now (`BILLING_ENABLED = false` in `src/lib/flags.ts`). All the Stripe code and
> usage limits are still in the repo — when you want to charge, flip that flag
> to `true` and do §4–5. Until then, skip the Stripe steps.

---

## 1. Domain — hirematrie.com (already owned)

You already have **hirematrie.com** on Cloudflare, so DNS + SSL are handled.
Nothing to buy — you'll just attach it to the deployment in §2.

---

## 2. Deploy to Cloudflare (one-time setup, then auto-deploys)

The app builds on TanStack Start + Nitro, whose **default target is Cloudflare**,
so this is the native host. Easiest path = connect the GitHub repo so every push
deploys automatically (always-on, global edge = fast everywhere).

1. Cloudflare Dashboard → **Workers & Pages** → **Create** → **Connect to Git**.
2. Pick the `apron-ai-concierge` repo, branch `main` (merge your feature branch
   first), framework preset **Vite**.
   - Build command: `npm run build`
   - Build output: `dist` (Nitro emits the Cloudflare worker/assets here)
3. Add the environment variables (Settings → Variables & Secrets) — see §5.
4. Deploy. You'll get a `*.workers.dev` URL to test immediately.
5. **Custom domain:** Settings → Domains & Routes → add **hirematrie.com** (and
   `www.hirematrie.com`). Cloudflare wires DNS + SSL automatically.

> If the build needs a Nitro preset nudge, set the build env var
> `NITRO_PRESET=cloudflare_pages` (or `cloudflare_module`). Start without it; only
> add it if the deploy log asks for a preset.

---

## 3. Point Supabase + Google at the live domain (one-time)

So sign-in works on the real URL:

- **Supabase** → Authentication → URL Configuration:
  - Site URL: `https://hirematrie.com`
  - Redirect URLs: add `https://hirematrie.com/**`
- **Google Cloud Console** → your OAuth client → Authorized JavaScript origins:
  add `https://hirematrie.com`. (The redirect URI stays the Supabase callback
  `https://<project>.supabase.co/auth/v1/callback` — already set.)

This is all you need to **launch free**. The sections below are only for when
you turn billing back on.

---

## 4. Stripe setup — LATER (billing is off for now)

> Skip this until you flip `BILLING_ENABLED = true` in `src/lib/flags.ts`.
> Everything below already exists in the code; you just need a Stripe account
> and the env vars in §5.

1. Create a free account at https://dashboard.stripe.com.
2. **Products** → add two recurring prices:
   - *Pro Monthly* — $19.00 / month → copy the **Price ID** (`price_…`)
   - *Pro Annual* — $179.00 / year → copy the **Price ID**
3. **Developers → API keys** → copy the **Secret key** (`sk_live_…`; use
   `sk_test_…` while testing).
4. **Developers → Webhooks** → Add endpoint:
   - URL: `https://YOURDOMAIN/api/stripe-webhook`
   - Events: `checkout.session.completed`, `customer.subscription.updated`,
     `customer.subscription.deleted`
   - Copy the **Signing secret** (`whsec_…`).
5. **Billing portal** (so customers can cancel): Settings → Billing → Customer
   portal → activate.

---

## 5. Environment variables to set on Cloudflare

Mark the secret ones as **encrypted**. (Names match `.env.example`.)

**Needed now (free launch):**

| Variable | Where it comes from |
| --- | --- |
| `OPENAI_API_KEY` | OpenAI dashboard |
| `OPENAI_MODEL` | optional, defaults to `gpt-4.1-mini` |
| `PUBLIC_APP_URL` | `https://hirematrie.com` |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` | already in `.env` (public) |

**Later (only when billing is on):**

| Variable | Where it comes from |
| --- | --- |
| `STRIPE_SECRET_KEY` | Stripe → API keys |
| `STRIPE_WEBHOOK_SECRET` | Stripe → Webhooks endpoint |
| `STRIPE_PRICE_MONTHLY` | Stripe → Products (monthly Price ID) |
| `STRIPE_PRICE_ANNUAL` | Stripe → Products (annual Price ID) |
| `SUPABASE_URL` | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → API → **service_role** (secret!) |

---

## 6. Smoke test the live site

1. Sign in with Google on `https://hirematrie.com`.
2. Complete onboarding, upload a menu, test the concierge.
3. Embed the widget on a test site; ask a few questions as a "guest" — they
   should all answer freely (no limits while billing is off).

That's the launch. 🎉

---

## When you're ready to charge (the saved pricing)

Everything below is already built — flip `BILLING_ENABLED = true` in
`src/lib/flags.ts`, do §4–5, then test the upgrade flow with Stripe test card
`4242 4242 4242 4242` (any future expiry/CVC).

| Plan | Price | Includes |
| --- | --- | --- |
| Free | $0 | 20 guest messages total + ~12/day; owner tests free |
| Pro Monthly | $19/mo | unlimited guest messages, no daily cap |
| Pro Annual | $179/yr | ~$14.92/mo (save 22%) |

Margins are healthy: gpt-4.1-mini costs a fraction of a cent per reply, so even a
busy restaurant's monthly AI cost is ~$1–3 against $19 revenue.
