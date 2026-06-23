# Launch runbook — going live on Cloudflare

This is the end-to-end checklist to put the app on a custom domain with real
Stripe billing. Do the steps in order. Anything marked **(one-time)** you only
ever do once.

---

## 1. Pick & buy the domain (one-time)

Buy through **Cloudflare Registrar** if you can — then DNS/SSL is automatic and
there's no markup. (Dashboard → Domain Registration → Register Domains.)

Some brandable ideas for an AI restaurant concierge (check availability — `.com`
first, `.ai` is a nice premium alternative):

- **maitre.ai** / **getmaitre.com** / **trymaitre.com**
- **maitreai.com** / **maitrehq.com**
- **tablewhisper.com** / **conciergeai.app**
- **hostai.restaurant** / **frontofhouse.ai**

> Tip: keep it short, easy to say on a phone, and matching the in-app brand
> name ("Maître"). `getmaitre.com` / `trymaitre.com` are safe, on-brand picks if
> the bare `maitre.*` names are taken.

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
5. **Custom domain:** Settings → Domains & Routes → add your domain. Cloudflare
   wires DNS + SSL automatically (since the domain is on Cloudflare).

> If the build needs a Nitro preset nudge, set the build env var
> `NITRO_PRESET=cloudflare_pages` (or `cloudflare_module`). Start without it; only
> add it if the deploy log asks for a preset.

---

## 3. Point Supabase + Google at the live domain (one-time)

So sign-in works on the real URL:

- **Supabase** → Authentication → URL Configuration:
  - Site URL: `https://YOURDOMAIN`
  - Redirect URLs: add `https://YOURDOMAIN/**`
- **Google Cloud Console** → your OAuth client → Authorized JavaScript origins:
  add `https://YOURDOMAIN`. (The redirect URI stays the Supabase callback
  `https://<project>.supabase.co/auth/v1/callback` — already set.)

---

## 4. Stripe setup (one-time)

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

| Variable | Where it comes from |
| --- | --- |
| `OPENAI_API_KEY` | OpenAI dashboard |
| `OPENAI_MODEL` | optional, defaults to `gpt-4.1-mini` |
| `STRIPE_SECRET_KEY` | Stripe → API keys |
| `STRIPE_WEBHOOK_SECRET` | Stripe → Webhooks endpoint |
| `STRIPE_PRICE_MONTHLY` | Stripe → Products (monthly Price ID) |
| `STRIPE_PRICE_ANNUAL` | Stripe → Products (annual Price ID) |
| `SUPABASE_URL` | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → API → **service_role** (secret!) |
| `PUBLIC_APP_URL` | `https://YOURDOMAIN` |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` | already in `.env` (public) |

---

## 6. Smoke test the live site

1. Sign in with Google on the real domain.
2. Complete onboarding, upload a menu, test the concierge (owner tests are free).
3. Embed the widget on a test site; ask ~2 questions as a "guest".
4. Click **Upgrade** → pay with a Stripe **test card** `4242 4242 4242 4242`
   (any future expiry/CVC) → confirm you land back on `/dashboard?upgraded=1`
   and the plan badge flips to **Pro** (the webhook did its job).
5. **Manage plan** → confirm the Stripe billing portal opens.

When everything passes on test keys, swap Stripe to **live** keys and you're
open for business.

---

## Pricing recap

| Plan | Price | Includes |
| --- | --- | --- |
| Free | $0 | 20 guest messages total + ~12/day; owner tests free |
| Pro Monthly | $19/mo | unlimited guest messages, no daily cap |
| Pro Annual | $179/yr | ~$14.92/mo (save 22%) |

Margins are healthy: gpt-4.1-mini costs a fraction of a cent per reply, so even a
busy restaurant's monthly AI cost is ~$1–3 against $19 revenue.
