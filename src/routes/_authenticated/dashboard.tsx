import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Utensils, FileText, Check, Sparkles, Copy, Pencil, LogOut, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

type Restaurant = Record<string, any> | null;

function Dashboard() {
  const navigate = useNavigate();
  const [r, setR] = useState<Restaurant>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("restaurants").select("*").eq("user_id", user.id).maybeSingle();
      if (!data?.onboarding_completed) {
        navigate({ to: "/onboarding", replace: true });
        return;
      }
      setR(data);
      setLoading(false);
    })();
  }, [navigate]);

  if (loading || !r) return <div className="grid min-h-screen place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const signOut = async () => { await supabase.auth.signOut(); navigate({ to: "/" }); };

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const widgetSnippet = `<script src="${origin}/widget.js" data-restaurant="${r.id}" data-color="${r.brand_color || "#7c3aed"}" data-name="${(r.concierge_name || "Concierge").replace(/"/g, "&quot;")}" data-welcome="${(r.welcome_message || "Hello!").replace(/"/g, "&quot;")}" async></script>`;
  const copy = () => { navigator.clipboard.writeText(widgetSnippet); toast.success("Snippet copied"); };

  const menuStatus = r.menu_pdf_path ? "ready" : "missing";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/90 px-6 py-4 backdrop-blur sm:px-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-hero text-primary-foreground">
              <Utensils className="h-3.5 w-3.5" />
            </div>
            <span className="text-sm font-semibold">Maitre</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/onboarding" className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline">Edit profile</Link>
            <Button variant="ghost" size="sm" onClick={signOut} className="rounded-full">
              <LogOut className="mr-1.5 h-3.5 w-3.5" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-10 sm:px-10 sm:py-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-accent">Dashboard</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{r.name || "Your restaurant"}</h1>
            <p className="mt-1 text-muted-foreground">{r.cuisine_type || "Welcome back"}</p>
          </div>
          <Button asChild variant="outline" className="rounded-full"><Link to="/onboarding"><Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit</Link></Button>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          <StatusCard
            title="AI Concierge"
            status="ready"
            label="Live"
            icon={<Sparkles className="h-4 w-4" />}
            detail={r.concierge_name || "Concierge"}
          />
          <StatusCard
            title="Menu Upload"
            status={menuStatus as any}
            label={menuStatus === "ready" ? "Uploaded" : "Pending"}
            icon={<FileText className="h-4 w-4" />}
            detail={r.menu_pdf_path ? r.menu_pdf_path.split("/").pop() : "No menu uploaded"}
          />
          <StatusCard
            title="Widget"
            status="ready"
            label="Ready to install"
            icon={<Check className="h-4 w-4" />}
            detail="Copy snippet below"
          />
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_400px]">
          {/* Profile */}
          <section className="space-y-6">
            <Card title="Restaurant Profile">
              <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
                <Detail label="Website" value={r.website_url} />
                <Detail label="Phone" value={r.phone} />
                <Detail label="Email" value={r.email} />
                <Detail label="Cuisine" value={r.cuisine_type} />
                <div className="sm:col-span-2"><Detail label="Address" value={r.address} /></div>
                <div className="sm:col-span-2"><Detail label="Story" value={r.story} /></div>
                <Detail label="Popular dishes" value={r.popular_dishes} />
                <Detail label="Parking" value={r.parking_info} />
                <Detail label="Delivery & Pickup" value={r.delivery_pickup} />
                <div>
                  <dt className="text-xs uppercase tracking-wider text-muted-foreground">Dietary</dt>
                  <dd className="mt-1.5 flex flex-wrap gap-1.5">
                    {[
                      ["dietary_vegan", "Vegan"], ["dietary_vegetarian", "Vegetarian"],
                      ["dietary_gluten_free", "Gluten Free"], ["dietary_halal", "Halal"],
                    ].filter(([k]) => r[k as string]).map(([, l]) => (
                      <span key={l} className="rounded-full bg-warm/60 px-2.5 py-0.5 text-xs font-medium">{l}</span>
                    ))}
                    {!r.dietary_vegan && !r.dietary_vegetarian && !r.dietary_gluten_free && !r.dietary_halal && (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </dd>
                </div>
              </dl>
            </Card>

            <Card title="Widget Installation">
              <p className="text-sm text-muted-foreground">
                Paste this snippet into your site's <code className="rounded bg-muted px-1.5 py-0.5 text-xs">&lt;/body&gt;</code> tag.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <PlatformGuide name="Wix" steps={["Open Settings → Custom Code", "Add Code to All Pages", "Paste snippet, place in Body End"]} />
                <PlatformGuide name="Squarespace" steps={["Settings → Advanced → Code Injection", "Paste in Footer", "Save"]} />
              </div>
              <div className="mt-5 overflow-hidden rounded-xl border border-border bg-foreground p-4">
                <pre className="overflow-x-auto text-xs leading-relaxed text-background/90">{widgetSnippet}</pre>
              </div>
              <Button onClick={copy} variant="outline" className="mt-4 rounded-full">
                <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy snippet
              </Button>
            </Card>
          </section>

          {/* Chatbot preview */}
          <aside>
            <Card title="Chatbot Preview">
              <PreviewWidget r={r} />
              <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
                Live on your site once installed
              </div>
            </Card>
          </aside>
        </div>
      </div>
    </div>
  );
}

function StatusCard({ title, status, label, icon, detail }: { title: string; status: "ready" | "missing"; label: string; icon: React.ReactNode; detail: string }) {
  return (
    <div className="rounded-2xl border border-border bg-gradient-card p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">{icon}{title}</div>
        <span className={cn(
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
          status === "ready" ? "bg-success/10 text-success" : "bg-accent/15 text-accent",
        )}>
          {status === "ready" ? <Check className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
          {label}
        </span>
      </div>
      <p className="mt-4 truncate text-lg font-semibold">{detail}</p>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
      <h2 className="mb-5 text-lg font-semibold tracking-tight">{title}</h2>
      {children}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-1.5 text-sm">{value || <span className="text-muted-foreground">—</span>}</dd>
    </div>
  );
}

function PlatformGuide({ name, steps }: { name: string; steps: string[] }) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="text-sm font-semibold">{name}</div>
      <ol className="mt-2 space-y-1 text-xs text-muted-foreground">
        {steps.map((s, i) => <li key={i}>{i + 1}. {s}</li>)}
      </ol>
    </div>
  );
}

function PreviewWidget({ r }: { r: any }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border shadow-md">
      <div style={{ background: r.brand_color || "#7c3aed" }} className="flex items-center gap-3 p-4 text-white">
        <div className="grid h-9 w-9 place-items-center rounded-full bg-white/20"><Sparkles className="h-4 w-4" /></div>
        <div>
          <div className="text-sm font-semibold">{r.concierge_name || "Concierge"}</div>
          <div className="text-xs opacity-80">Online</div>
        </div>
      </div>
      <div className="space-y-3 bg-background p-4">
        <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-muted p-3 text-sm">
          {r.welcome_message || "Hello!"}
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          {[r.reservation_button_label, r.order_button_label, r.catering_button_label].filter(Boolean).map((b: string) => (
            <span key={b} style={{ borderColor: r.brand_color, color: r.brand_color }} className="rounded-full border bg-background px-3 py-1.5 text-xs font-medium">{b}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function cn(...c: (string | false | undefined)[]) { return c.filter(Boolean).join(" "); }
