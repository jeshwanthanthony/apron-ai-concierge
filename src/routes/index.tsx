import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sparkles, Utensils, ArrowRight, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AI Restaurant Concierge — Premium AI for independent restaurants" },
      { name: "description", content: "A beautiful AI concierge for your restaurant website. Built for Wix and Squarespace." },
      { property: "og:title", content: "AI Restaurant Concierge" },
      { property: "og:description", content: "A beautiful AI concierge for your restaurant website." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setSignedIn(!!session));
    return () => subscription.unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Nav — just the logo. The CTA below handles sign up / dashboard. */}
      <header className="px-6 py-6 sm:px-10">
        <nav className="mx-auto flex max-w-6xl items-center justify-between">
          <Link to={signedIn ? "/dashboard" : "/"} className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-hero text-primary-foreground">
              <Utensils className="h-4 w-4" />
            </div>
            <span className="text-base font-semibold tracking-tight">Maitre</span>
          </Link>
        </nav>
      </header>

      {/* Hero — headline left, video window right */}
      <section className="px-6 pb-20 pt-8 sm:px-10 lg:pt-16">
        <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-14">
          {/* Left: pitch */}
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-medium text-muted-foreground shadow-sm">
              <Sparkles className="h-3.5 w-3.5 text-accent" />
              Now in private beta for Wix &amp; Squarespace restaurants
            </div>
            <h1 className="mt-6 text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
              The AI concierge <span className="text-gradient-hero">your restaurant deserves.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground lg:mx-0">
              Answer guest questions, take reservations, and showcase your menu — all from one elegant widget that lives on your site.
            </p>
            <p className="mt-8 text-sm text-muted-foreground">5-minute onboarding · No credit card</p>
          </div>

          {/* Right: video window with the jumping CTA overlaid */}
          <div className="relative overflow-hidden rounded-3xl border border-border bg-foreground shadow-elegant">
            <video
              src="/maitre-ad.mp4"
              autoPlay
              loop
              muted
              playsInline
              preload="auto"
              className="block aspect-video w-full object-cover"
            />
            {/* Bottom scrim covers the watermark and anchors the CTA */}
            <div className="absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-black/75 via-black/35 to-transparent p-6 pt-16">
              <div className="relative">
                <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-white/25" />
                <Link
                  to={signedIn ? "/dashboard" : "/auth"}
                  className="maitre-attn group inline-flex items-center gap-2.5 rounded-full bg-gradient-hero px-8 py-3.5 text-base font-semibold text-primary-foreground shadow-glow ring-4 ring-white/25 transition hover:ring-white/50"
                >
                  {signedIn ? "Open your dashboard" : "Try it free"}
                  <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
                </Link>
              </div>
            </div>
          </div>
        </div>

        <style>{`
          @keyframes maitre-attn {
            0%, 100% { transform: translateY(0) rotate(0deg); }
            8%  { transform: translateY(-12px) rotate(-3deg); }
            16% { transform: translateY(0) rotate(3deg); }
            24% { transform: translateY(-7px) rotate(-2deg); }
            32% { transform: translateY(0) rotate(1deg); }
            40% { transform: translateY(0) rotate(0deg); }
          }
          .maitre-attn { animation: maitre-attn 2.2s ease-in-out infinite; will-change: transform; }
          .maitre-attn:hover { animation-play-state: paused; transform: scale(1.06); }
          @media (prefers-reduced-motion: reduce) { .maitre-attn { animation: none; } }
        `}</style>
      </section>

      {/* Features */}
      <section className="border-t border-border bg-gradient-soft px-6 py-24 sm:px-10">
        <div className="mx-auto max-w-5xl">
          <h2 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
            Everything your guests need, beautifully presented.
          </h2>
          <div className="mt-14 grid gap-6 sm:grid-cols-3">
            {[
              { t: "Reservations", d: "Send guests to your booking link with one tap, in any language." },
              { t: "Menu intelligence", d: "Upload a PDF — we handle allergens, dietary tags, and questions." },
              { t: "Brand-perfect", d: "Pick a color, set a tone. Your concierge feels like part of your site." },
            ].map((f) => (
              <div key={f.t} className="rounded-2xl border border-border bg-card p-7 shadow-sm">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-warm">
                  <Check className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mt-5 text-lg font-semibold">{f.t}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-border px-6 py-10 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Maitre · AI Restaurant Concierge
      </footer>
    </div>
  );
}
