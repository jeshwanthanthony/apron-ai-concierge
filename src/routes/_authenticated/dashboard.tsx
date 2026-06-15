import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Utensils, FileText, Check, Sparkles, Copy, Pencil, LogOut, Loader2, AlertCircle,
  Plus, Trash2, Save, X, MessageSquare, RefreshCw, Upload, HelpCircle,
} from "lucide-react";
import { toast } from "sonner";

type QA = { id: string; question: string; answer: string; sort_order: number };
type Log = { id: string; question: string; answer: string | null; source: string; created_at: string };

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
                <PlatformGuide name="Wix" steps={["Settings → Custom Code (NOT HTML Embed — embeds run in an isolated iframe)", "Add Custom Code → All Pages → Body - end", "Paste snippet and save"]} />
                <PlatformGuide name="Squarespace" steps={["Settings → Advanced → Code Injection", "Paste snippet in Footer", "Save"]} />
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

        {/* Menu file, custom Q&A, and guest question history */}
        <div className="mt-6 space-y-6">
          <MenuCard r={r} onUpdated={(path) => setR({ ...r, menu_pdf_path: path })} />
          <QASection restaurantId={r.id} />
          <HistorySection restaurantId={r.id} />
        </div>
      </div>
    </div>
  );
}

function MenuCard({ r, onUpdated }: { r: any; onUpdated: (path: string) => void }) {
  const [uploading, setUploading] = useState(false);

  const replace = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const filePath = `${r.user_id}/${Date.now()}-${file.name}`;
    const up = await supabase.storage.from("menus").upload(filePath, file, { upsert: true });
    if (up.error) { setUploading(false); toast.error(up.error.message); return; }
    const { error } = await supabase.from("restaurants").update({ menu_pdf_path: filePath }).eq("id", r.id);
    setUploading(false);
    if (error) { toast.error(error.message); return; }
    onUpdated(filePath);
    toast.success("Menu updated");
  };

  const remove = async () => {
    const { error } = await supabase.from("restaurants").update({ menu_pdf_path: null }).eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    onUpdated("");
    toast.success("Menu removed");
  };

  return (
    <Card title="Menu PDF">
      <p className="text-sm text-muted-foreground">The menu guests can ask your concierge about.</p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-warm/20 p-4">
        <div className="flex min-w-0 items-center gap-3">
          <FileText className="h-5 w-5 shrink-0 text-primary" />
          <span className="truncate text-sm">
            {r.menu_pdf_path ? r.menu_pdf_path.split("/").pop() : <span className="text-muted-foreground">No menu uploaded</span>}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <label className="inline-flex cursor-pointer items-center rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-warm/40">
            {uploading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1.5 h-3.5 w-3.5" />}
            {r.menu_pdf_path ? "Replace" : "Upload"}
            <input type="file" accept="application/pdf" className="hidden" onChange={replace} disabled={uploading} />
          </label>
          {r.menu_pdf_path && (
            <button onClick={remove} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Remove menu">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}

function QASection({ restaurantId }: { restaurantId: string }) {
  const [items, setItems] = useState<QA[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [a, setA] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQ, setEditQ] = useState("");
  const [editA, setEditA] = useState("");

  const load = async () => {
    const { data } = await supabase
      .from("qa_pairs")
      .select("id, question, answer, sort_order")
      .eq("restaurant_id", restaurantId)
      .order("sort_order")
      .order("created_at");
    setItems(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [restaurantId]);

  const add = async () => {
    if (!q.trim() || !a.trim()) { toast.error("Add both a question and an answer"); return; }
    setSaving(true);
    const { error } = await supabase.from("qa_pairs").insert({
      restaurant_id: restaurantId, question: q.trim(), answer: a.trim(), sort_order: items.length,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setQ(""); setA(""); toast.success("Q&A added"); load();
  };

  const startEdit = (item: QA) => { setEditingId(item.id); setEditQ(item.question); setEditA(item.answer); };
  const cancelEdit = () => { setEditingId(null); setEditQ(""); setEditA(""); };

  const saveEdit = async (id: string) => {
    if (!editQ.trim() || !editA.trim()) { toast.error("Question and answer can't be empty"); return; }
    const { error } = await supabase.from("qa_pairs").update({ question: editQ.trim(), answer: editA.trim() }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    cancelEdit(); toast.success("Saved"); load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("qa_pairs").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted"); load();
  };

  return (
    <Card title="Custom Q&A">
      <p className="text-sm text-muted-foreground">
        Write your own questions and answers. Your concierge will prefer these when guests ask something similar.
      </p>

      {/* Add new */}
      <div className="mt-5 space-y-3 rounded-2xl border border-border bg-warm/20 p-4">
        <Input placeholder="Question (e.g. Do you take walk-ins?)" value={q} onChange={(e) => setQ(e.target.value)} className="h-10 rounded-xl bg-background" />
        <Textarea placeholder="Answer" value={a} onChange={(e) => setA(e.target.value)} className="min-h-[72px] rounded-xl bg-background" />
        <Button onClick={add} disabled={saving} className="rounded-full">
          {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1.5 h-3.5 w-3.5" />}
          Add Q&A
        </Button>
      </div>

      {/* List */}
      <div className="mt-5 space-y-3">
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
            <HelpCircle className="h-6 w-6" />
            No custom Q&A yet. Add your first one above.
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="rounded-2xl border border-border p-4">
              {editingId === item.id ? (
                <div className="space-y-3">
                  <Input value={editQ} onChange={(e) => setEditQ(e.target.value)} className="h-10 rounded-xl" />
                  <Textarea value={editA} onChange={(e) => setEditA(e.target.value)} className="min-h-[72px] rounded-xl" />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => saveEdit(item.id)} className="rounded-full"><Save className="mr-1.5 h-3.5 w-3.5" /> Save</Button>
                    <Button size="sm" variant="ghost" onClick={cancelEdit} className="rounded-full"><X className="mr-1.5 h-3.5 w-3.5" /> Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{item.question}</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{item.answer}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button onClick={() => startEdit(item)} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Edit"><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => remove(item.id)} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

function HistorySection({ restaurantId }: { restaurantId: string }) {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("question_logs")
      .select("id, question, answer, source, created_at")
      .eq("restaurant_id", restaurantId)
      .order("created_at", { ascending: false })
      .limit(200);
    setLogs(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [restaurantId]);

  const remove = async (id: string) => {
    const { error } = await supabase.from("question_logs").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setLogs((l) => l.filter((x) => x.id !== id));
  };

  return (
    <Card title="Guest Questions">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Every question guests have asked your concierge — newest first.</p>
        <Button variant="ghost" size="sm" onClick={load} className="rounded-full"><RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh</Button>
      </div>

      <div className="mt-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
            <MessageSquare className="h-6 w-6" />
            No guest questions yet. They'll appear here once people start chatting with your concierge.
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="rounded-2xl border border-border p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium">{log.question}</p>
                <button onClick={() => remove(log.id)} className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
              {log.answer && <p className="mt-1.5 whitespace-pre-wrap text-sm text-muted-foreground">{log.answer}</p>}
              <p className="mt-2 text-xs text-muted-foreground/70">{new Date(log.created_at).toLocaleString()}</p>
            </div>
          ))
        )}
      </div>
    </Card>
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
