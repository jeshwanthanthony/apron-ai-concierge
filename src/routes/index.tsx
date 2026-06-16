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
      {/* Fullscreen video hero */}
      <section className="relative flex min-h-[100svh] flex-col overflow-hidden">
        {/* Background video */}
        <video
          src="/maitre-ad.mp4"
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          className="absolute inset-0 h-full w-full object-cover"
        />
        {/* Scrim for legibility */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/30 to-black/75" />

        {/* Nav */}
        <header className="relative z-10 px-6 py-6 sm:px-10">
          <nav className="mx-auto flex max-w-6xl items-center justify-between">
            <div className="flex items-center gap-2 text-white">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-white/15 backdrop-blur">
                <Utensils className="h-4 w-4" />
              </div>
              <span className="text-base font-semibold tracking-tight">Maitre</span>
            </div>
            <div className="flex items-center gap-3">
              {signedIn ? (
                <Link
                  to="/dashboard"
                  className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition hover:opacity-90"
                >
                  Go to dashboard <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              ) : (
                <>
                  <Link to="/auth" className="text-sm font-medium text-white/80 hover:text-white">
                    Sign in
                  </Link>
                  <Link
                    to="/auth"
                    className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition hover:opacity-90"
                  >
                    Get started <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </>
              )}
            </div>
          </nav>
        </header>

        {/* Centered hero content */}
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pb-20 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-xs font-medium text-white backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" />
            Now in private beta for Wix &amp; Squarespace restaurants
          </div>
          <h1 className="mt-7 max-w-4xl text-5xl font-semibold leading-[1.05] tracking-tight text-white drop-shadow-[0_2px_20px_rgba(0,0,0,0.5)] sm:text-7xl">
            The AI concierge your restaurant deserves.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-white/90 drop-shadow-[0_1px_10px_rgba(0,0,0,0.5)] sm:text-xl">
            Answer guest questions, take reservations, and showcase your menu — all from one elegant widget that lives on your site.
          </p>

          {/* Attention-grabbing CTA */}
          <div className="relative mt-12">
            <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-white/25" />
            <Link
              to={signedIn ? "/dashboard" : "/auth"}
              className="maitre-attn group inline-flex items-center gap-2.5 rounded-full bg-gradient-hero px-10 py-4 text-lg font-semibold text-primary-foreground shadow-glow ring-4 ring-white/25 transition hover:ring-white/50"
            >
              {signedIn ? "Open your dashboard" : "Try it free"}
              <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
            </Link>
          </div>
          <span className="mt-5 text-sm text-white/75">5-minute onboarding · No credit card</span>
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
          @media (prefers-reduced-motion: reduce) {
            .maitre-attn { animation: none; }
          }
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
