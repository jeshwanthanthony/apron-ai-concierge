import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Utensils, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — AI Restaurant Concierge" },
      { name: "description", content: "Sign in or create your restaurant concierge account." },
    ],
  }),
  component: AuthPage,
});

// Impact stats that fade/slide through on the sign-up panel, instead of a
// single static testimonial.
const STATS: { value: string; label: string }[] = [
  { value: "80%", label: "of guest questions answered before they ever reach your host stand" },
  { value: "24/7", label: "instant answers — your AI concierge never clocks out" },
  { value: "3 min", label: "to set up and drop onto your website" },
  { value: "100%", label: "on-brand — your menu, your hours, your voice" },
  { value: "0 apps", label: "for guests to download — it lives right on your site" },
];

function RotatingStat() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % STATS.length), 3800);
    return () => clearInterval(t);
  }, []);
  const s = STATS[i];
  return (
    <div className="space-y-6">
      <div key={i} className="animate-in fade-in slide-in-from-bottom-3 duration-700">
        <div className="text-6xl font-semibold tracking-tight">{s.value}</div>
        <p className="mt-3 max-w-md text-lg font-medium leading-snug tracking-tight opacity-90">
          {s.label}
        </p>
      </div>
      <div className="flex gap-1.5">
        {STATS.map((_, idx) => (
          <span
            key={idx}
            className={
              "h-1.5 rounded-full transition-all duration-500 " +
              (idx === i ? "w-6 bg-white" : "w-1.5 bg-white/40")
            }
          />
        ))}
      </div>
    </div>
  );
}

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Surface an OAuth error that Google/Supabase may append to the callback URL.
    const params = new URLSearchParams(
      window.location.search + "&" + window.location.hash.replace(/^#/, ""),
    );
    const oauthError = params.get("error_description") || params.get("error");
    if (oauthError) toast.error(decodeURIComponent(oauthError.replace(/\+/g, " ")));

    const goIfAuthed = (session: Session | null) => {
      if (session) navigate({ to: "/onboarding", replace: true });
    };

    // Fires once the OAuth `?code=` is exchanged for a session (Google flow),
    // and also covers users who are already signed in.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => goIfAuthed(session));

    // getSession() awaits the in-flight URL code exchange, so this resolves
    // with the session even on the first paint after the OAuth redirect.
    supabase.auth.getSession().then(({ data }) => goIfAuthed(data.session));

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/onboarding" },
        });
        if (error) throw error;
        toast.success("Welcome! Let's set up your concierge.");
        navigate({ to: "/onboarding", replace: true });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/onboarding", replace: true });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Auth failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    // Native Supabase OAuth: redirects the browser to Google, then back to
    // /auth with a `?code=` that the client exchanges for a session. On first
    // sign-in, the `handle_new_user` DB trigger saves the account automatically.
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin + "/auth",
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) {
      toast.error(error.message);
      setLoading(false);
    }
    // On success the browser navigates away to Google; nothing else runs here.
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left - brand */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-hero p-12 text-primary-foreground lg:flex">
        <Link to="/" className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-white/15 backdrop-blur">
            <Utensils className="h-4 w-4" />
          </div>
          <span className="font-semibold">Maitre</span>
        </Link>
        <RotatingStat />
        <div className="text-xs opacity-60">© Maitre · Built for restaurants</div>
      </div>

      {/* Right - form */}
      <div className="flex items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-sm space-y-8">
          <Link to="/" className="flex items-center gap-2 lg:hidden">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-hero text-primary-foreground">
              <Utensils className="h-4 w-4" />
            </div>
            <span className="font-semibold">Maitre</span>
          </Link>

          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              {mode === "signup" ? "Create your account" : "Welcome back"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {mode === "signup" ? "Start your 5-minute setup." : "Sign in to your dashboard."}
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={handleGoogle}
            className="h-11 w-full rounded-full"
          >
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
            </svg>
            Continue with Google
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-3 text-muted-foreground">or email</span>
            </div>
          </div>

          <form onSubmit={handleEmail} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 rounded-xl" />
            </div>
            <Button type="submit" disabled={loading} className="h-11 w-full rounded-full bg-gradient-hero shadow-glow">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "signup" ? "Create account" : "Sign in"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            {mode === "signup" ? "Already have an account?" : "New here?"}{" "}
            <button onClick={() => setMode(mode === "signup" ? "signin" : "signup")} className="font-medium text-foreground underline-offset-4 hover:underline">
              {mode === "signup" ? "Sign in" : "Create one"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
