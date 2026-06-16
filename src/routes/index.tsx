import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sparkles, MessageCircle, Utensils, ArrowRight, Check } from "lucide-react";
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
      {/* Nav */}
      <header className="px-6 py-6 sm:px-10">
        <nav className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-hero text-primary-foreground">
              <Utensils className="h-4 w-4" />
            </div>
            <span className="text-base font-semibold tracking-tight">Maitre</span>
          </div>
          <div className="flex items-center gap-3">
            {signedIn ? (
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90"
              >
                Go to dashboard <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <>
                <Link to="/auth" className="text-sm font-medium text-muted-foreground hover:text-foreground">
                  Sign in
                </Link>
                <Link
                  to="/auth"
                  className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90"
                >
                  Get started <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </>
            )}
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section className="px-6 pb-24 pt-16 sm:px-10 sm:pt-24">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-medium text-muted-foreground shadow-sm">
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            Now in private beta for Wix & Squarespace restaurants
          </div>
          <h1 className="mt-8 text-5xl font-semibold leading-[1.05] tracking-tight sm:text-7xl">
            The AI concierge <br className="hidden sm:block" />
            <span className="text-gradient-hero">your restaurant deserves.</span>
          </h1>
          <p className="mx-auto mt-7 max-w-2xl text-lg text-muted-foreground sm:text-xl">
            Answer guest questions, take reservations, and showcase your menu — all from one elegant widget that lives on your site.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-hero px-7 py-3.5 text-base font-medium text-primary-foreground shadow-glow transition hover:opacity-95"
            >
              Set up your concierge <ArrowRight className="h-4 w-4" />
            </Link>
            <span className="text-sm text-muted-foreground">5-minute onboarding · No credit card</span>
          </div>
        </div>

        {/* Preview Card */}
        <div className="mx-auto mt-20 max-w-3xl">
          <div className="overflow-hidden rounded-3xl border border-border bg-gradient-card shadow-elegant">
            <div className="flex items-center gap-2 border-b border-border px-5 py-3">
              <div className="h-2.5 w-2.5 rounded-full bg-muted" />
              <div className="h-2.5 w-2.5 rounded-full bg-muted" />
              <div className="h-2.5 w-2.5 rounded-full bg-muted" />
              <div className="ml-3 text-xs text-muted-foreground">trattoria-roma.com</div>
            </div>
            <div className="grid gap-4 p-8 sm:grid-cols-[1fr_auto]">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full bg-warm/60 px-3 py-1 text-xs font-medium">
                  <MessageCircle className="h-3 w-3" /> Concierge · Online
                </div>
                <p className="text-lg">
                  <span className="text-muted-foreground">Buongiorno!</span> I'd love to help you plan your visit. Looking for a table tonight?
                </p>
                <div className="flex flex-wrap gap-2 pt-2">
                  <span className="rounded-full border border-border bg-card px-3 py-1.5 text-xs">Reserve a table</span>
                  <span className="rounded-full border border-border bg-card px-3 py-1.5 text-xs">View menu</span>
                  <span className="rounded-full border border-border bg-card px-3 py-1.5 text-xs">Catering</span>
                </div>
              </div>
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-hero text-primary-foreground sm:h-16 sm:w-16">
                <Sparkles className="h-6 w-6" />
              </div>
            </div>
          </div>
        </div>
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
