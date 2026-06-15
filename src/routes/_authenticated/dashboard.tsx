import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { extractPdfText, ingestMenu } from "@/lib/pdf-client";
import {
  Utensils, FileText, Check, Sparkles, Copy, Pencil, LogOut, Loader2, AlertCircle,
  Plus, Trash2, Save, X, MessageSquare, RefreshCw, Upload, HelpCircle, Sparkle,
  Palette, Clock, TrendingUp, Hash,
} from "lucide-react";
import { toast } from "sonner";

type QA = { id: string; question: string; answer: string; sort_order: number };
type Log = { id: string; question: string; answer: string | null; source: string; created_at: string };

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

type Restaurant = Record<string, any> | null;

const PRESET_COLORS = [
  "#7c3aed", "#4f46e5", "#2563eb", "#0891b2", "#16a34a",
  "#ca8a04", "#ea580c", "#dc2626", "#db2777", "#0f172a",
];

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
  const patch = (fields: Record<string, any>) => setR((cur) => ({ ...(cur || {}), ...fields }));

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
          <Button variant="ghost" size="sm" onClick={signOut} className="rounded-full">
            <LogOut className="mr-1.5 h-3.5 w-3.5" /> Sign out
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-10 sm:px-10 sm:py-14">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-accent">Dashboard</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{r.name || "Your restaurant"}</h1>
          <p className="mt-1 text-muted-foreground">{r.cuisine_type || "Welcome back"}</p>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          <StatusCard title="AI Concierge" status="ready" label="Live" icon={<Sparkles className="h-4 w-4" />} detail={r.concierge_name || "Concierge"} />
          <StatusCard
            title="Menu Upload"
            status={menuStatus as any}
            label={menuStatus === "ready" ? "Uploaded" : "Pending"}
            icon={<FileText className="h-4 w-4" />}
            detail={r.menu_pdf_path ? r.menu_pdf_path.split("/").pop() : "No menu uploaded"}
          />
          <StatusCard title="Widget" status="ready" label="Ready to install" icon={<Check className="h-4 w-4" />} detail="Copy snippet below" />
        </div>

        <div className="mt-8 space-y-6">
          <ProfileCard r={r} onSaved={patch} />
          <AppearanceCard r={r} onSaved={patch} />
          <ConciergeTester r={r} />
          <MenuCard r={r} onUpdated={(path) => patch({ menu_pdf_path: path })} />
          <QASection restaurantId={r.id} />
          <HistorySection restaurantId={r.id} />
          <WidgetInstallCard r={r} />
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- Editable profile ---------------------------- */

const PROFILE_FIELDS = [
  "name", "website_url", "phone", "email", "cuisine_type",
  "address", "story", "popular_dishes", "parking_info", "delivery_pickup", "allergy_info",
] as const;
const DIETARY: [string, string][] = [
  ["dietary_vegan", "Vegan"], ["dietary_vegetarian", "Vegetarian"],
  ["dietary_gluten_free", "Gluten Free"], ["dietary_halal", "Halal"],
];

function ProfileCard({ r, onSaved }: { r: any; onSaved: (fields: Record<string, any>) => void }) {
  const seed = () => {
    const o: Record<string, any> = {};
    for (const f of PROFILE_FIELDS) o[f] = r[f] ?? "";
    for (const [k] of DIETARY) o[k] = !!r[k];
    return o;
  };
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, any>>(seed);
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const startEdit = () => { setForm(seed()); setEditing(true); };
  const cancel = () => setEditing(false);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("restaurants").update(form).eq("id", r.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    onSaved(form);
    setEditing(false);
    toast.success("Profile saved");
  };

  if (!editing) {
    const dietary = DIETARY.filter(([k]) => r[k]).map(([, l]) => l);
    return (
      <Card title="Restaurant Profile">
        <div className="mb-5 flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">The core information your concierge uses to answer guests.</p>
          <Button size="sm" variant="outline" onClick={startEdit} className="shrink-0 rounded-full"><Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit</Button>
        </div>
        <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
          <Detail label="Name" value={r.name} />
          <Detail label="Cuisine" value={r.cuisine_type} />
          <Detail label="Website" value={r.website_url} />
          <Detail label="Phone" value={r.phone} />
          <Detail label="Email" value={r.email} />
          <Detail label="Popular dishes" value={r.popular_dishes} />
          <div className="sm:col-span-2"><Detail label="Address" value={r.address} /></div>
          <div className="sm:col-span-2"><Detail label="Story" value={r.story} /></div>
          <Detail label="Parking" value={r.parking_info} />
          <Detail label="Delivery & pickup" value={r.delivery_pickup} />
          <div className="sm:col-span-2"><Detail label="Allergy info" value={r.allergy_info} /></div>
          <div className="sm:col-span-2">
            <dt className="text-xs uppercase tracking-wider text-muted-foreground">Dietary</dt>
            <dd className="mt-1.5 flex flex-wrap gap-1.5">
              {dietary.length ? dietary.map((l) => (
                <span key={l} className="rounded-full bg-warm/60 px-2.5 py-0.5 text-xs font-medium">{l}</span>
              )) : <span className="text-sm text-muted-foreground">—</span>}
            </dd>
          </div>
        </dl>
      </Card>
    );
  }

  return (
    <Card title="Restaurant Profile">
      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Editing — changes apply to your concierge as soon as you save.</p>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" onClick={save} disabled={saving} className="rounded-full">
            {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />} Save
          </Button>
          <Button size="sm" variant="ghost" onClick={cancel} className="rounded-full"><X className="mr-1.5 h-3.5 w-3.5" /> Cancel</Button>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Restaurant name"><Input className={inputCls} value={form.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label="Cuisine"><Input className={inputCls} value={form.cuisine_type} onChange={(e) => set("cuisine_type", e.target.value)} /></Field>
        <Field label="Website"><Input className={inputCls} value={form.website_url} onChange={(e) => set("website_url", e.target.value)} /></Field>
        <Field label="Phone"><Input className={inputCls} value={form.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
        <Field label="Email"><Input className={inputCls} value={form.email} onChange={(e) => set("email", e.target.value)} /></Field>
        <Field label="Popular dishes"><Input className={inputCls} value={form.popular_dishes} onChange={(e) => set("popular_dishes", e.target.value)} /></Field>
        <div className="sm:col-span-2"><Field label="Address"><Input className={inputCls} value={form.address} onChange={(e) => set("address", e.target.value)} /></Field></div>
        <div className="sm:col-span-2"><Field label="Story / about"><Textarea className="min-h-[80px] rounded-xl" value={form.story} onChange={(e) => set("story", e.target.value)} /></Field></div>
        <Field label="Parking"><Input className={inputCls} value={form.parking_info} onChange={(e) => set("parking_info", e.target.value)} /></Field>
        <Field label="Delivery & pickup"><Input className={inputCls} value={form.delivery_pickup} onChange={(e) => set("delivery_pickup", e.target.value)} /></Field>
        <div className="sm:col-span-2"><Field label="Allergy info"><Textarea className="min-h-[60px] rounded-xl" value={form.allergy_info} onChange={(e) => set("allergy_info", e.target.value)} /></Field></div>
      </div>

      <div className="mt-5">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">Dietary options</span>
        <div className="mt-2 flex flex-wrap gap-2">
          {DIETARY.map(([key, label]) => (
            <label key={key} className={cn(
              "flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition",
              form[key] ? "border-foreground bg-warm/50" : "border-border hover:border-foreground/40",
            )}>
              <Checkbox checked={form[key]} onCheckedChange={(v) => set(key, !!v)} />
              {label}
            </label>
          ))}
        </div>
      </div>
    </Card>
  );
}

function Detail({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-1.5 whitespace-pre-wrap text-sm">{value || <span className="text-muted-foreground">—</span>}</dd>
    </div>
  );
}

/* --------------------- Editable chatbot appearance + preview --------------------- */

function AppearanceCard({ r, onSaved }: { r: any; onSaved: (fields: Record<string, any>) => void }) {
  const [form, setForm] = useState({
    concierge_name: r.concierge_name ?? "Concierge",
    brand_color: r.brand_color ?? "#7c3aed",
    welcome_message: r.welcome_message ?? "Hi there! 👋 How can I help you today?",
    reservation_button_label: r.reservation_button_label ?? "Reserve a Table",
    order_button_label: r.order_button_label ?? "Order Online",
    catering_button_label: r.catering_button_label ?? "Catering Inquiry",
  });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("restaurants").update(form).eq("id", r.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    onSaved(form);
    toast.success("Appearance saved");
  };

  return (
    <Card title="Chatbot Appearance">
      <p className="text-sm text-muted-foreground">Customize how your concierge looks and greets guests. The preview updates live.</p>
      <div className="mt-5 grid gap-8 lg:grid-cols-[1fr_340px]">
        {/* Controls */}
        <div className="space-y-4">
          <Field label="Concierge name"><Input className={inputCls} value={form.concierge_name} onChange={(e) => set("concierge_name", e.target.value)} /></Field>
          <Field label="Welcome message"><Textarea className="min-h-[72px] rounded-xl" value={form.welcome_message} onChange={(e) => set("welcome_message", e.target.value)} /></Field>

          <Field label="Brand color">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => set("brand_color", c)}
                    className={cn(
                      "h-8 w-8 rounded-full border-2 transition",
                      form.brand_color.toLowerCase() === c.toLowerCase() ? "border-foreground scale-110" : "border-transparent hover:scale-105",
                    )}
                    style={{ background: c }}
                    aria-label={`Use ${c}`}
                  />
                ))}
              </div>
              <div className="flex items-center gap-3">
                <input type="color" value={form.brand_color} onChange={(e) => set("brand_color", e.target.value)} className="h-10 w-14 cursor-pointer rounded-xl border border-border bg-transparent" />
                <Input className={cn(inputCls, "max-w-[140px]")} value={form.brand_color} onChange={(e) => set("brand_color", e.target.value)} />
                <Palette className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Reserve button"><Input className={inputCls} value={form.reservation_button_label} onChange={(e) => set("reservation_button_label", e.target.value)} /></Field>
            <Field label="Order button"><Input className={inputCls} value={form.order_button_label} onChange={(e) => set("order_button_label", e.target.value)} /></Field>
            <Field label="Catering button"><Input className={inputCls} value={form.catering_button_label} onChange={(e) => set("catering_button_label", e.target.value)} /></Field>
          </div>

          <Button onClick={save} disabled={saving} className="rounded-full bg-gradient-hero shadow-glow">
            {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />} Save appearance
          </Button>
        </div>

        {/* Live preview */}
        <div>
          <PreviewWidget r={{ ...r, ...form }} />
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" /> Live preview
          </div>
        </div>
      </div>
    </Card>
  );
}

/* --------------------- Live concierge tester (real AI chat) --------------------- */

type Msg = { role: "user" | "assistant"; content: string };

function ConciergeTester({ r }: { r: any }) {
  const color = r.brand_color || "#7c3aed";
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: r.welcome_message || "Hi there! 👋 How can I help you today?" },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  const ask = async (text?: string) => {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    setInput("");
    const history = messages.filter((m) => m.role === "user" || m.role === "assistant").slice(-8);
    setMessages((m) => [...m, { role: "user", content: q }]);
    setBusy(true);
    try {
      const res = await fetch("/api/concierge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId: r.id, question: q, history }),
      });
      const data = await res.json().catch(() => ({}));
      const reply = res.ok && data.answer ? data.answer : data.error || "Something went wrong.";
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Couldn't reach the concierge. Is the dev server running?" }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Test Your Concierge">
      <p className="text-sm text-muted-foreground">
        Chat with your live AI concierge right here — the same answers guests get. Great for testing without installing the widget.
      </p>
      <div className="mt-4 overflow-hidden rounded-2xl border border-border">
        <div className="flex h-[360px] flex-col bg-warm/10">
          <div className="flex-1 space-y-2.5 overflow-y-auto p-4">
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm",
                  m.role === "user" ? "ml-auto rounded-tr-sm text-white" : "rounded-tl-sm border border-border bg-card",
                )}
                style={m.role === "user" ? { background: color } : undefined}
              >
                {m.content}
              </div>
            ))}
            {busy && <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-border bg-card px-3.5 py-2 text-sm opacity-60">…</div>}
          </div>
          <div className="flex gap-2 border-t border-border bg-background p-3">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") ask(); }}
              placeholder="Ask about your menu, hours, reservations…"
              className="h-10 rounded-full"
              disabled={busy}
            />
            <Button onClick={() => ask()} disabled={busy} className="rounded-full" style={{ background: color }}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send"}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------- Menu (RAG) -------------------------------- */

function MenuCard({ r, onUpdated }: { r: any; onUpdated: (path: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [chunks, setChunks] = useState<number | null>(null);

  const loadChunks = async () => {
    const { count } = await supabase
      .from("menu_chunks")
      .select("*", { count: "exact", head: true })
      .eq("restaurant_id", r.id);
    setChunks(count ?? 0);
  };
  useEffect(() => { loadChunks(); /* eslint-disable-next-line */ }, [r.id]);

  const replace = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      setStatus("Uploading…");
      const filePath = `${r.user_id}/${Date.now()}-${file.name}`;
      const up = await supabase.storage.from("menus").upload(filePath, file, { upsert: true });
      if (up.error) throw up.error;
      const { error } = await supabase.from("restaurants").update({ menu_pdf_path: filePath }).eq("id", r.id);
      if (error) throw error;
      onUpdated(filePath);

      setStatus("Reading menu…");
      const text = await extractPdfText(file);
      if (!text.trim()) {
        toast.message("Menu uploaded, but no text was found (is it a scanned image?). The concierge will use your profile + Q&A.");
        return;
      }
      setStatus("Teaching your concierge…");
      const n = await ingestMenu(text, "menu");
      setChunks(n);
      toast.success(`Menu uploaded and indexed for AI (${n} sections).`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Menu upload failed");
    } finally {
      setBusy(false);
      setStatus("");
    }
  };

  const remove = async () => {
    const { error } = await supabase.from("restaurants").update({ menu_pdf_path: null, menu_text: null }).eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    await supabase.from("menu_chunks").delete().eq("restaurant_id", r.id).eq("source", "menu");
    setChunks(0);
    onUpdated("");
    toast.success("Menu removed");
  };

  return (
    <Card title="Menu PDF">
      <p className="text-sm text-muted-foreground">
        Upload your menu and your concierge will read it — guests can ask about dishes, prices, and ingredients.
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-warm/20 p-4">
        <div className="flex min-w-0 items-center gap-3">
          <FileText className="h-5 w-5 shrink-0 text-primary" />
          <span className="truncate text-sm">
            {r.menu_pdf_path ? r.menu_pdf_path.split("/").pop() : <span className="text-muted-foreground">No menu uploaded</span>}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <label className={cn(
            "inline-flex cursor-pointer items-center rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-warm/40",
            busy && "pointer-events-none opacity-60",
          )}>
            {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1.5 h-3.5 w-3.5" />}
            {busy ? (status || "Working…") : r.menu_pdf_path ? "Replace" : "Upload"}
            <input type="file" accept="application/pdf" className="hidden" onChange={replace} disabled={busy} />
          </label>
          {r.menu_pdf_path && !busy && (
            <button onClick={remove} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Remove menu">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      {r.menu_pdf_path && chunks !== null && (
        chunks > 0 ? (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-success">
            <Sparkle className="h-3 w-3" /> Indexed for AI ({chunks} sections) — your concierge reads this menu.
          </p>
        ) : (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-accent">
            <AlertCircle className="h-3 w-3" /> Uploaded but not indexed yet. Click <strong>Replace</strong> and re-select your menu PDF to let the AI read it.
          </p>
        )
      )}
    </Card>
  );
}

/* ------------------------------- Custom Q&A -------------------------------- */

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

      <div className="mt-5 space-y-3 rounded-2xl border border-border bg-warm/20 p-4">
        <Input placeholder="Question (e.g. Do you take walk-ins?)" value={q} onChange={(e) => setQ(e.target.value)} className="h-10 rounded-xl bg-background" />
        <Textarea placeholder="Answer" value={a} onChange={(e) => setA(e.target.value)} className="min-h-[72px] rounded-xl bg-background" />
        <Button onClick={add} disabled={saving} className="rounded-full">
          {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1.5 h-3.5 w-3.5" />}
          Add Q&A
        </Button>
      </div>

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

/* --------------------- Guest question history (tabs + realtime) --------------------- */

const STOP = new Set([
  "the", "and", "for", "are", "you", "your", "can", "could", "would", "with", "what", "when", "where",
  "how", "does", "did", "have", "has", "any", "our", "their", "this", "that", "there", "from", "about",
  "will", "should", "they", "them", "but", "not", "get", "got", "use", "into", "out", "want", "need",
  "please", "tell", "know", "like", "make", "give", "take", "also", "more", "much", "many",
]);

function normalizeQ(s: string) {
  return s.toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();
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
      .limit(500);
    setLogs(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // Live sync: new guest questions stream in without a manual refresh.
    const channel = supabase
      .channel(`qlogs-${restaurantId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "question_logs", filter: `restaurant_id=eq.${restaurantId}` },
        (payload) => setLogs((prev) => (prev.some((l) => l.id === (payload.new as Log).id) ? prev : [payload.new as Log, ...prev])),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    /* eslint-disable-next-line */
  }, [restaurantId]);

  const remove = async (id: string) => {
    const { error } = await supabase.from("question_logs").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setLogs((l) => l.filter((x) => x.id !== id));
  };

  // Group identical/near-identical questions and count them.
  const frequent = useMemo(() => {
    const map = new Map<string, { question: string; count: number; last: string }>();
    for (const l of logs) {
      const key = normalizeQ(l.question);
      if (!key) continue;
      const ex = map.get(key);
      if (ex) { ex.count++; if (l.created_at > ex.last) ex.last = l.created_at; }
      else map.set(key, { question: l.question, count: 1, last: l.created_at });
    }
    return [...map.values()].sort((a, b) => b.count - a.count || (a.last < b.last ? 1 : -1));
  }, [logs]);

  // Keyword frequency across questions → "topics" guests care about.
  const topics = useMemo(() => {
    const counts = new Map<string, number>();
    for (const l of logs) {
      const seen = new Set<string>();
      for (const w of normalizeQ(l.question).split(" ")) {
        if (w.length < 3 || STOP.has(w) || seen.has(w)) continue;
        seen.add(w);
        counts.set(w, (counts.get(w) || 0) + 1);
      }
    }
    return [...counts.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 20);
  }, [logs]);

  return (
    <Card title="Guest Questions">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          What guests ask your concierge — synced live. {logs.length > 0 && <span className="text-foreground">{logs.length} total</span>}
        </p>
        <Button variant="ghost" size="sm" onClick={load} className="rounded-full"><RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
          <MessageSquare className="h-6 w-6" />
          No guest questions yet. They'll appear here live once people start chatting with your concierge.
        </div>
      ) : (
        <Tabs defaultValue="recent" className="mt-5">
          <TabsList>
            <TabsTrigger value="recent"><Clock className="mr-1.5 h-3.5 w-3.5" /> Recent</TabsTrigger>
            <TabsTrigger value="frequent"><TrendingUp className="mr-1.5 h-3.5 w-3.5" /> Most asked</TabsTrigger>
            <TabsTrigger value="topics"><Hash className="mr-1.5 h-3.5 w-3.5" /> Topics</TabsTrigger>
          </TabsList>

          <TabsContent value="recent" className="mt-4 space-y-3">
            {logs.map((log) => (
              <div key={log.id} className="rounded-2xl border border-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium">{log.question}</p>
                  <button onClick={() => remove(log.id)} className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
                {log.answer && <p className="mt-1.5 whitespace-pre-wrap text-sm text-muted-foreground">{log.answer}</p>}
                <p className="mt-2 text-xs text-muted-foreground/70">{new Date(log.created_at).toLocaleString()}</p>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="frequent" className="mt-4 space-y-2">
            {frequent.map((f, i) => (
              <div key={i} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
                <p className="min-w-0 text-sm">{f.question}</p>
                <span className={cn(
                  "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                  f.count > 1 ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground",
                )}>
                  {f.count}× {f.count > 1 ? "asked" : ""}
                </span>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="topics" className="mt-4">
            {topics.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Not enough questions yet to spot recurring topics.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {topics.map(([word, n]) => (
                  <span key={word} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-warm/30 px-3 py-1.5 text-sm">
                    {word} <span className="rounded-full bg-accent/15 px-1.5 text-xs font-semibold text-accent">{n}</span>
                  </span>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </Card>
  );
}

/* ------------------------------ Widget install ----------------------------- */

function WidgetInstallCard({ r }: { r: any }) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const widgetSnippet = `<script src="${origin}/widget.js" data-restaurant="${r.id}" data-color="${r.brand_color || "#7c3aed"}" data-name="${(r.concierge_name || "Concierge").replace(/"/g, "&quot;")}" data-welcome="${(r.welcome_message || "Hello!").replace(/"/g, "&quot;")}" async></script>`;
  const copy = () => { navigator.clipboard.writeText(widgetSnippet); toast.success("Snippet copied"); };

  return (
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
  );
}

/* --------------------------------- Shared --------------------------------- */

const inputCls = "h-10 rounded-xl";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</label>
      {children}
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
