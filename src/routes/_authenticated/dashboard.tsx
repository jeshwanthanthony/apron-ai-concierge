import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { extractPdfText, ingestMenu } from "@/lib/pdf-client";
import { BILLING_ENABLED } from "@/lib/flags";
import { PhoneField, AddressAutocomplete } from "@/components/form-fields";
import {
  Utensils, FileText, Check, Sparkles, Copy, Pencil, LogOut, Loader2, AlertCircle,
  Plus, Trash2, Save, X, MessageSquare, RefreshCw, Upload, HelpCircle, Sparkle,
  Palette, Clock, TrendingUp, Hash, Send, RotateCcw, Store, Code2,
  Image as ImageIcon, ArrowUpRight, Link2, Zap, CreditCard, Crown, Megaphone,
  Phone, Mail, Globe, MapPin,
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

// Max characters a guest can type in one message (tester + live widget).
const GUEST_INPUT_MAX = 300;

// Chat avatar logo shapes (border-radius applied to a square image/box).
const LOGO_SHAPES: { id: string; label: string; radius: string }[] = [
  { id: "circle", label: "Circle", radius: "50%" },
  { id: "rounded", label: "Rounded", radius: "28%" },
  { id: "squircle", label: "Squircle", radius: "40%" },
];
function shapeRadius(shape?: string) {
  return LOGO_SHAPES.find((s) => s.id === shape)?.radius ?? "50%";
}

/** Chat avatar — the uploaded logo (in the chosen shape) or a fallback. */
function BotAvatar({
  logo, shape, accent, size, fallback,
}: { logo?: string; shape?: string; accent: string; size: number; fallback: React.ReactNode }) {
  const borderRadius = shapeRadius(shape);
  if (logo) {
    return <img src={logo} alt="" className="shrink-0 object-cover" style={{ width: size, height: size, borderRadius }} />;
  }
  return (
    <div className="grid shrink-0 place-items-center text-white" style={{ width: size, height: size, borderRadius, background: accent }}>
      {fallback}
    </div>
  );
}

function Dashboard() {
  const navigate = useNavigate();
  const [r, setR] = useState<Restaurant>(null);
  const [loading, setLoading] = useState(true);
  const [usage, setUsage] = useState<{ used_month: number; month_limit: number } | null>(null);

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
      const { data: u } = await supabase.rpc("get_usage", { p_restaurant_id: data.id });
      if (u) setUsage(u as unknown as { used_month: number; month_limit: number });
    })();
  }, [navigate]);

  // Returning from Stripe Checkout.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("upgraded")) {
      toast.success("Welcome to Pro! 🎉 Your plan is active.");
    } else if (params.get("canceled")) {
      toast.message("Checkout canceled — no charge was made.");
    }
    if (params.get("upgraded") || params.get("canceled")) {
      window.history.replaceState({}, "", "/dashboard");
    }
  }, []);

  if (loading || !r) return <div className="grid min-h-screen place-items-center"><Loader2 className="h-6 w-6 animate-spin text-zinc-500" /></div>;

  const signOut = async () => { await supabase.auth.signOut(); navigate({ to: "/" }); };
  const patch = (fields: Record<string, any>) => setR((cur) => ({ ...(cur || {}), ...fields }));

  return (
    <div className="min-h-screen bg-white text-zinc-900">
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/90 px-6 py-4 backdrop-blur sm:px-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-hero text-white">
              <Utensils className="h-3.5 w-3.5" />
            </div>
            <span className="text-base font-semibold tracking-tight">Maitre</span>
            <span className="rounded-full bg-[#ffedd5] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#c2410c]">
              Beta
            </span>
          </Link>
          <button onClick={signOut} className="flex items-center gap-1.5 text-sm font-medium text-zinc-500 transition hover:text-zinc-900">
            <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-12 sm:px-10">
        <div className="mb-10 flex flex-wrap items-start justify-between gap-6">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{r.name || "Your restaurant"}</h1>
            <p className="mt-2 text-lg text-zinc-500">{r.cuisine_type || "Welcome back"}</p>
          </div>
          <UsageCard used={usage?.used_month ?? 0} limit={usage?.month_limit ?? 100} />
        </div>

        {/* Sticky section nav + content */}
        <div className="gap-12 lg:grid lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <div className="sticky top-24">
              <SideNav />
            </div>
          </aside>

          <div className="min-w-0 space-y-8">
            <section id="profile" className="scroll-mt-24 space-y-6">
              <ProfileCard r={r} onSaved={patch} />
            </section>

            <section id="concierge" className="scroll-mt-24 space-y-6">
              <AppearanceCard r={r} onSaved={patch} />
              <ConciergeTester r={r} />
            </section>

            <section id="menu" className="scroll-mt-24 space-y-6">
              <MenuCard r={r} onUpdated={(path) => patch({ menu_pdf_path: path })} />
              <QASection restaurantId={r.id} />
            </section>

            <section id="history" className="scroll-mt-24">
              <HistorySection restaurantId={r.id} />
            </section>

            {BILLING_ENABLED && (
              <section id="usage" className="scroll-mt-24">
                <PlanUsageCard r={r} onSaved={patch} />
              </section>
            )}

            <section id="install" className="scroll-mt-24">
              <WidgetInstallCard r={r} />
            </section>

            <section id="feedback" className="scroll-mt-24">
              <FeedbackCard r={r} />
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------- Sticky section navigation ------------------------ */

type Section = { id: string; label: string; icon: typeof Store };
const ALL_SECTIONS: Section[] = [
  { id: "profile", label: "Restaurant Profile", icon: Store },
  { id: "concierge", label: "Chatbot & Preview", icon: Sparkles },
  { id: "menu", label: "Menu & Q&A", icon: FileText },
  { id: "history", label: "Guest Questions", icon: MessageSquare },
  { id: "usage", label: "Plan & Usage", icon: Zap },
  { id: "install", label: "Install Widget", icon: Code2 },
  { id: "feedback", label: "Give Feedback", icon: Megaphone },
];
// "Plan & Usage" only appears once billing is enabled.
const SECTIONS: Section[] = ALL_SECTIONS.filter((s) => s.id !== "usage" || BILLING_ENABLED);

function SideNav() {
  const [active, setActive] = useState<string>(SECTIONS[0].id);

  useEffect(() => {
    const onScroll = () => {
      const offset = 150;
      let current = SECTIONS[0].id;
      for (const s of SECTIONS) {
        const el = document.getElementById(s.id);
        if (el && el.getBoundingClientRect().top <= offset) current = s.id;
      }
      // When scrolled to the very bottom, force the last section active.
      const doc = document.documentElement;
      if (window.innerHeight + window.scrollY >= doc.scrollHeight - 4) {
        current = SECTIONS[SECTIONS.length - 1].id;
      }
      setActive(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <nav className="space-y-0.5">
      {SECTIONS.map((s) => {
        const on = active === s.id;
        return (
          <button
            key={s.id}
            onClick={() => go(s.id)}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[15px] transition",
              on ? "bg-[#ffedd5] font-semibold text-[#c2410c]" : "font-medium text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900",
            )}
          >
            <s.icon className={cn("h-4 w-4 shrink-0", on ? "text-[#c2410c]" : "text-zinc-400")} />
            {s.label}
          </button>
        );
      })}
    </nav>
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
    o.logo_url = r.logo_url ?? "";
    return o;
  };
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, any>>(seed);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
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

  const uploadLogo = async (file: File) => {
    setUploading(true);
    const safe = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const path = `${r.user_id}/logo-${Date.now()}-${safe}`;
    const up = await supabase.storage.from("logos").upload(path, file, { upsert: true });
    setUploading(false);
    if (up.error) { toast.error(up.error.message); return; }
    const { data } = supabase.storage.from("logos").getPublicUrl(path);
    set("logo_url", data.publicUrl);
    toast.success("Logo updated");
  };

  /* ----------------------------- Read view ----------------------------- */
  if (!editing) {
    const dietary = DIETARY.filter(([k]) => r[k]).map(([, l]) => l);
    const subtitle = [r.cuisine_type, cityFromAddress(r.address)].filter(Boolean).join(" · ");
    return (
      <Card title="Restaurant Profile">
        {/* Identity header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-100 pb-6">
          <div className="flex items-center gap-4">
            <LogoAvatar url={r.logo_url} name={r.name} size={60} />
            <div>
              <div className="text-xl font-semibold tracking-tight">{r.name || "Your restaurant"}</div>
              {subtitle && <div className="mt-0.5 text-sm text-zinc-500">{subtitle}</div>}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <a href="/onboarding?edit=1" className="text-sm font-medium text-[#c2410c] hover:underline">Hours, allergens &amp; more</a>
            <Button size="sm" variant="outline" onClick={startEdit} className="rounded-full border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50">
              <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
            </Button>
          </div>
        </div>

        {/* Details */}
        <dl className="mt-6 grid gap-x-10 gap-y-5 sm:grid-cols-2">
          <DetailRow icon={Phone} label="Phone" value={r.phone} />
          <DetailRow icon={Mail} label="Email" value={r.email} />
          <DetailRow icon={Globe} label="Website" value={r.website_url} />
          <DetailRow icon={Utensils} label="Popular dishes" value={r.popular_dishes} />
          <div className="sm:col-span-2"><DetailRow icon={MapPin} label="Address" value={r.address} /></div>
          <div className="sm:col-span-2"><DetailRow label="Story" value={r.story} /></div>
          <DetailRow label="Parking" value={r.parking_info} />
          <DetailRow label="Delivery & pickup" value={r.delivery_pickup} />
          <div className="sm:col-span-2"><DetailRow label="Allergy info" value={r.allergy_info} /></div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-medium uppercase tracking-wider text-zinc-400">Dietary</dt>
            <dd className="mt-2 flex flex-wrap gap-1.5">
              {dietary.length ? dietary.map((l) => (
                <span key={l} className="rounded-full bg-[#ffedd5] px-2.5 py-1 text-xs font-medium text-[#c2410c]">{l}</span>
              )) : <span className="text-sm text-zinc-400">—</span>}
            </dd>
          </div>
        </dl>
      </Card>
    );
  }

  /* ----------------------------- Edit view ----------------------------- */
  return (
    <Card title="Edit Restaurant Profile">
      <p className="-mt-3 mb-6 text-sm text-zinc-500">Changes apply to your concierge the moment you save.</p>

      {/* Logo + live preview */}
      <div className="grid gap-6 rounded-2xl border border-zinc-200 bg-zinc-50/60 p-5 sm:grid-cols-[1fr_minmax(0,300px)]">
        <div>
          <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">Restaurant logo</span>
          <div className="mt-3 flex items-center gap-4">
            <LogoAvatar url={form.logo_url} name={form.name} size={64} />
            <div className="space-y-2">
              <div className="flex gap-2">
                <label className={cn("inline-flex cursor-pointer items-center rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium hover:bg-zinc-50", uploading && "pointer-events-none opacity-60")}>
                  {uploading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1.5 h-3.5 w-3.5" />}
                  {form.logo_url ? "Change" : "Upload logo"}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLogo(f); }} />
                </label>
                {form.logo_url && (
                  <button onClick={() => set("logo_url", "")} className="rounded-full p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900" aria-label="Remove logo">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              <p className="text-[11px] text-zinc-400">Square image works best (PNG/JPG). Shows on your concierge.</p>
            </div>
          </div>
        </div>
        <div>
          <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">Preview</span>
          <div className="mt-3"><ConciergeHeaderPreview r={{ ...r, ...form }} /></div>
        </div>
      </div>

      {/* Basics */}
      <EditGroup title="Basics">
        <Field label="Restaurant name"><Input className={inputCls} value={form.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label="Cuisine"><Input className={inputCls} value={form.cuisine_type} onChange={(e) => set("cuisine_type", e.target.value)} /></Field>
      </EditGroup>

      {/* Contact */}
      <EditGroup title="Contact & location">
        <Field label="Phone"><PhoneField value={form.phone} onChange={(v) => set("phone", v)} /></Field>
        <Field label="Email"><Input className={inputCls} type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></Field>
        <Field label="Website"><Input className={inputCls} value={form.website_url} onChange={(e) => set("website_url", e.target.value)} /></Field>
        <div className="hidden sm:block" />
        <div className="sm:col-span-2"><Field label="Address"><AddressAutocomplete placeholder="Start typing your address…" value={form.address} onChange={(v) => set("address", v)} /></Field></div>
      </EditGroup>

      {/* Details */}
      <EditGroup title="What guests ask about">
        <Field label="Popular dishes"><Input className={inputCls} value={form.popular_dishes} onChange={(e) => set("popular_dishes", e.target.value)} /></Field>
        <Field label="Parking"><Input className={inputCls} value={form.parking_info} onChange={(e) => set("parking_info", e.target.value)} /></Field>
        <Field label="Delivery & pickup"><Input className={inputCls} value={form.delivery_pickup} onChange={(e) => set("delivery_pickup", e.target.value)} /></Field>
        <div className="hidden sm:block" />
        <div className="sm:col-span-2"><Field label="Story / about"><Textarea className="min-h-[80px] rounded-xl" value={form.story} onChange={(e) => set("story", e.target.value)} /></Field></div>
        <div className="sm:col-span-2"><Field label="Allergy info"><Textarea className="min-h-[60px] rounded-xl" value={form.allergy_info} onChange={(e) => set("allergy_info", e.target.value)} /></Field></div>
      </EditGroup>

      {/* Dietary */}
      <div className="mt-6">
        <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">Dietary options</span>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {DIETARY.map(([key, label]) => (
            <label key={key} className={cn(
              "flex cursor-pointer items-center gap-2 rounded-full border px-3.5 py-2 text-sm transition",
              form[key] ? "border-[#c2410c] bg-[#ffedd5] text-[#c2410c]" : "border-zinc-200 hover:border-zinc-300",
            )}>
              <Checkbox checked={form[key]} onCheckedChange={(v) => set(key, !!v)} />
              {label}
            </label>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="mt-8 flex items-center gap-3 border-t border-zinc-100 pt-6">
        <Button onClick={save} disabled={saving} className="rounded-full bg-gradient-hero text-white hover:opacity-90">
          {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />} Save changes
        </Button>
        <Button variant="ghost" onClick={cancel} className="rounded-full"><X className="mr-1.5 h-3.5 w-3.5" /> Cancel</Button>
      </div>
    </Card>
  );
}

/** Pull a "City, ST" hint from a full address string for the profile subtitle. */
function cityFromAddress(addr?: string): string {
  if (!addr) return "";
  const parts = addr.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 3) return `${parts[parts.length - 3]}, ${parts[parts.length - 2].split(" ")[0]}`;
  return parts.slice(-2).join(", ");
}

function LogoAvatar({ url, name, size }: { url?: string; name?: string; size: number }) {
  const initial = (name?.trim()?.[0] || "M").toUpperCase();
  return url ? (
    <img
      src={url}
      alt=""
      className="shrink-0 rounded-2xl border border-zinc-200 object-cover"
      style={{ width: size, height: size }}
    />
  ) : (
    <div
      className="grid shrink-0 place-items-center rounded-2xl bg-gradient-hero font-semibold text-white"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initial}
    </div>
  );
}

function ConciergeHeaderPreview({ r }: { r: any }) {
  const accent = r.brand_color || "#c2410c";
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 shadow-sm">
      <div className="flex items-center gap-3 p-3.5" style={{ background: accent }}>
        {r.logo_url ? (
          <img src={r.logo_url} alt="" className="h-9 w-9 rounded-full border border-white/30 object-cover" />
        ) : (
          <div className="grid h-9 w-9 place-items-center rounded-full bg-white/20 text-white">
            <Sparkles className="h-4 w-4" />
          </div>
        )}
        <div className="leading-tight text-white">
          <div className="text-sm font-semibold">{r.concierge_name || "Maître AI"}</div>
          <div className="text-[11px] opacity-85">{r.name || "Your restaurant"}</div>
        </div>
      </div>
      <div className="bg-white p-3">
        <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-zinc-100 p-2.5 text-xs text-zinc-700">
          {r.welcome_message || "Hi there! 👋 How can I help you today?"}
        </div>
      </div>
    </div>
  );
}

function EditGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">{title}</div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function DetailRow({ icon: Icon, label, value }: { icon?: any; label: string; value: any }) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-zinc-400">
        {Icon && <Icon className="h-3.5 w-3.5" />} {label}
      </dt>
      <dd className="mt-1.5 whitespace-pre-wrap break-words text-sm text-zinc-900">{value || <span className="text-zinc-400">—</span>}</dd>
    </div>
  );
}

/* --------------------- Editable chatbot appearance + preview --------------------- */

type ActionBtn = { label: string; url: string; image: string };

function AppearanceCard({ r, onSaved }: { r: any; onSaved: (fields: Record<string, any>) => void }) {
  const [form, setForm] = useState({
    concierge_name: r.concierge_name ?? "Maître AI",
    brand_color: r.brand_color ?? "#7c3aed",
    welcome_message: r.welcome_message ?? "Hi there! 👋 How can I help you today?",
    logo_url: r.logo_url ?? "",
    logo_shape: r.logo_shape ?? "circle",
  });
  const [actions, setActions] = useState<ActionBtn[]>(() => {
    const a = r.action_buttons;
    if (Array.isArray(a) && a.length) {
      return a.slice(0, 3).map((b: any) => ({ label: b?.label || "", url: b?.url || "", image: b?.image || "" }));
    }
    return [
      { label: r.reservation_button_label || "Reserve a Table", url: r.reservation_link || "", image: "" },
      { label: r.order_button_label || "Order Online", url: r.order_online_link || "", image: "" },
      { label: r.catering_button_label || "Catering Inquiry", url: r.catering_link || "", image: "" },
    ];
  });
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const uploadLogo = async (file: File) => {
    setUploadingLogo(true);
    const safe = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const path = `${r.user_id}/logo-${Date.now()}-${safe}`;
    const up = await supabase.storage.from("logos").upload(path, file, { upsert: true });
    setUploadingLogo(false);
    if (up.error) { toast.error(up.error.message); return; }
    const { data } = supabase.storage.from("logos").getPublicUrl(path);
    set("logo_url", data.publicUrl);
    toast.success("Logo added");
  };

  const setAction = (i: number, patch: Partial<ActionBtn>) =>
    setActions((a) => a.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const addAction = () => setActions((a) => (a.length >= 3 ? a : [...a, { label: "New button", url: "", image: "" }]));
  const removeAction = (i: number) => setActions((a) => a.filter((_, idx) => idx !== i));

  const uploadImage = async (i: number, file: File) => {
    const path = `${r.user_id}/btn-${Date.now()}-${file.name}`;
    const up = await supabase.storage.from("logos").upload(path, file, { upsert: true });
    if (up.error) { toast.error(up.error.message); return; }
    const { data } = supabase.storage.from("logos").getPublicUrl(path);
    setAction(i, { image: data.publicUrl });
    toast.success("Image added");
  };

  const save = async () => {
    setSaving(true);
    const cleanActions = actions
      .filter((a) => a.label.trim() || a.url.trim())
      .map((a) => ({ label: a.label.trim(), url: a.url.trim(), image: a.image }));
    const payload = { ...form, action_buttons: cleanActions };
    const { error } = await supabase.from("restaurants").update(payload).eq("id", r.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    onSaved(payload);
    toast.success("Appearance saved");
  };

  return (
    <Card title="Chatbot Appearance">
      <p className="text-sm text-zinc-500">Customize how your concierge looks, greets guests, and the action buttons it shows. The preview updates live.</p>
      <div className="mt-5 grid gap-8 lg:grid-cols-[1fr_340px]">
        {/* Controls */}
        <div className="space-y-5">
          <Field label="Concierge name"><Input className={inputCls} value={form.concierge_name} onChange={(e) => set("concierge_name", e.target.value)} /></Field>

          <Field label="Chat logo">
            <div className="flex items-center gap-4">
              <BotAvatar logo={form.logo_url} shape={form.logo_shape} accent={form.brand_color} size={52} fallback={<Sparkles className="h-5 w-5" strokeWidth={1.5} />} />
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <label className={cn("inline-flex cursor-pointer items-center rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium hover:bg-zinc-50", uploadingLogo && "pointer-events-none opacity-60")}>
                    {uploadingLogo ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1.5 h-3.5 w-3.5" />}
                    {form.logo_url ? "Change logo" : "Upload logo"}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLogo(f); }} />
                  </label>
                  {form.logo_url && (
                    <button onClick={() => set("logo_url", "")} className="rounded-full p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900" aria-label="Remove logo">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="flex gap-1.5">
                  {LOGO_SHAPES.map((sh) => {
                    const on = form.logo_shape === sh.id;
                    return (
                      <button
                        key={sh.id}
                        type="button"
                        onClick={() => set("logo_shape", sh.id)}
                        className={cn("flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition",
                          on ? "border-[#c2410c] bg-[#ffedd5] text-[#c2410c]" : "border-zinc-200 text-zinc-500 hover:bg-zinc-50")}
                      >
                        <span className="h-3.5 w-3.5 bg-current" style={{ borderRadius: sh.radius }} />
                        {sh.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-zinc-400">Replaces the default sparkle/initial in the chat — shows in the tester and on your website.</p>
          </Field>

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
                      form.brand_color.toLowerCase() === c.toLowerCase() ? "border-zinc-900 scale-110" : "border-transparent hover:scale-105",
                    )}
                    style={{ background: c }}
                    aria-label={`Use ${c}`}
                  />
                ))}
              </div>
              <div className="flex items-center gap-3">
                <input type="color" value={form.brand_color} onChange={(e) => set("brand_color", e.target.value)} className="h-10 w-14 cursor-pointer rounded-xl border border-zinc-200 bg-transparent" />
                <Input className={cn(inputCls, "max-w-[140px]")} value={form.brand_color} onChange={(e) => set("brand_color", e.target.value)} />
                <Palette className="h-4 w-4 text-zinc-500" />
              </div>
            </div>
          </Field>

          {/* Action buttons */}
          <div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Action buttons <span className="text-zinc-500">(up to 3)</span></span>
              {actions.length < 3 && (
                <Button size="sm" variant="ghost" onClick={addAction} className="rounded-full"><Plus className="mr-1 h-3.5 w-3.5" /> Add</Button>
              )}
            </div>
            <p className="mt-1 text-xs text-zinc-500">Each becomes a clickable picture-card in the chat that opens its link.</p>
            <div className="mt-3 space-y-3">
              {actions.map((a, i) => (
                <div key={i} className="rounded-2xl border border-zinc-200 p-3">
                  <div className="flex items-start gap-3">
                    {/* Image / upload thumb */}
                    <label className="group relative grid h-14 w-14 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50">
                      {a.image ? (
                        <img src={a.image} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="grid h-full w-full place-items-center text-white" style={{ background: `linear-gradient(135deg, ${form.brand_color}, rgba(0,0,0,.3))` }}>
                          <ImageIcon className="h-5 w-5 opacity-90" />
                        </div>
                      )}
                      <span className="absolute inset-0 hidden place-items-center bg-black/40 text-[10px] font-medium text-white group-hover:grid">Change</span>
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(i, f); }} />
                    </label>

                    <div className="min-w-0 flex-1 space-y-2">
                      <Input className="h-9 rounded-lg" placeholder="Button name (e.g. Reserve a Table)" value={a.label} onChange={(e) => setAction(i, { label: e.target.value })} />
                      <div className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2">
                        <Link2 className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                        <input className="h-8 w-full bg-transparent text-sm outline-none" placeholder="https://link-to-open.com" value={a.url} onChange={(e) => setAction(i, { url: e.target.value })} />
                      </div>
                    </div>

                    <button onClick={() => removeAction(i)} className="shrink-0 rounded-full p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900" aria-label="Remove button">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
              {actions.length === 0 && (
                <p className="rounded-xl border border-dashed border-zinc-200 p-4 text-center text-sm text-zinc-500">No buttons. Add up to 3.</p>
              )}
            </div>
          </div>

          <Button onClick={save} disabled={saving} className="rounded-full bg-gradient-hero text-white hover:opacity-90">
            {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />} Save appearance
          </Button>
        </div>

        {/* Live preview */}
        <div>
          <PreviewWidget r={{ ...r, ...form }} actions={actions} />
          <div className="mt-3 flex items-center gap-2 text-xs text-zinc-500">
            <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> Live preview
          </div>
        </div>
      </div>
    </Card>
  );
}

/* --------------------- Live concierge tester (real AI chat) --------------------- */

type Msg = { role: "user" | "assistant"; content: string };

function ConciergeTester({ r }: { r: any }) {
  const accent = r.brand_color || "#7c3aed";
  const logo = r.logo_url as string | undefined;
  const shape = r.logo_shape as string | undefined;
  const name = r.concierge_name || "Maître AI";
  const welcome = r.welcome_message || "Hi there! 👋 How can I help you today?";
  const suggestions = [r.reservation_button_label, r.order_button_label, r.catering_button_label].filter(Boolean) as string[];

  const [messages, setMessages] = useState<Msg[]>([{ role: "assistant", content: welcome }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const ask = async (text?: string) => {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    setInput("");
    const history = messages.slice(-8);
    setMessages((m) => [...m, { role: "user", content: q }]);
    setBusy(true);
    try {
      const res = await fetch("/api/concierge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId: r.id, question: q, history, source: "preview" }),
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

  const reset = () => setMessages([{ role: "assistant", content: welcome }]);
  const initial = (name.charAt(0) || "C").toUpperCase();

  return (
    <Card title="Test Your Concierge">
      <p className="text-sm text-zinc-500">
        Chat with your live AI concierge — the exact experience your guests get. No widget install needed.
      </p>

      <div className="mt-4 overflow-hidden rounded-[20px] border border-zinc-200 bg-white shadow-elegant">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-zinc-200 px-5 py-4">
          <div className="relative">
            <BotAvatar logo={logo} shape={shape} accent={accent} size={36} fallback={<Sparkles className="h-3.5 w-3.5" strokeWidth={1.5} />} />
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-card" />
          </div>
          <div className="flex-1 leading-tight">
            <div className="text-[13px] font-semibold tracking-tight">{name}</div>
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
              <span>Online</span><span className="opacity-40">·</span><span>Live preview</span>
            </div>
          </div>
          <button onClick={reset} className="rounded-full p-1.5 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900" aria-label="Reset chat" title="Reset">
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="h-[360px] overflow-y-auto bg-zinc-50 px-5 py-5">
          <div className="flex flex-col gap-3">
            {messages.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md px-3.5 py-2.5 text-sm leading-relaxed text-white shadow-sm" style={{ background: accent }}>
                    {m.content}
                  </div>
                </div>
              ) : (
                <div key={i} className="flex items-end gap-2">
                  <BotAvatar logo={logo} shape={shape} accent={accent} size={28} fallback={<span className="text-[10px] font-semibold">{initial}</span>} />
                  <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-md border border-zinc-200 bg-white px-3.5 py-2.5 text-sm leading-relaxed shadow-sm">
                    {m.content}
                  </div>
                </div>
              ),
            )}
            {busy && (
              <div className="flex items-end gap-2">
                <BotAvatar logo={logo} shape={shape} accent={accent} size={28} fallback={<span className="text-[10px] font-semibold">{initial}</span>} />
                <div className="rounded-2xl rounded-bl-md border border-zinc-200 bg-white px-3.5 py-3 shadow-sm">
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-300 [animation-delay:-0.3s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-300 [animation-delay:-0.15s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-300" />
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Suggestions */}
        {messages.length <= 1 && !busy && suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 border-t border-zinc-200 bg-white px-5 pt-3">
            {suggestions.map((s) => (
              <button key={s} onClick={() => ask(s)} className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-900 transition hover:bg-[#c2410c] hover:text-white">
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Note: dashboard tests are always free — they never count toward usage. */}

        {/* Composer */}
        <form onSubmit={(e) => { e.preventDefault(); ask(); }} className="border-t border-zinc-200 bg-white px-3 py-3">
          <div className="flex items-center justify-end px-1 pb-1.5">
            <span className={cn("text-[11px] tabular-nums", input.length >= GUEST_INPUT_MAX ? "font-semibold text-red-500" : "font-medium text-zinc-600")}>
              {input.length}/{GUEST_INPUT_MAX}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about reservations, menu, hours…"
              disabled={busy}
              maxLength={GUEST_INPUT_MAX}
              className="flex-1 rounded-full border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm outline-none transition placeholder:text-zinc-500 focus:bg-white"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-white transition disabled:cursor-not-allowed disabled:opacity-40"
              style={{ background: accent }}
              aria-label="Send"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            </button>
          </div>
        </form>
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
      <p className="text-sm text-zinc-500">
        Upload your menu and your concierge will read it — guests can ask about dishes, prices, and ingredients.
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
        <div className="flex min-w-0 items-center gap-3">
          <FileText className="h-5 w-5 shrink-0 text-zinc-700" />
          <span className="truncate text-sm">
            {r.menu_pdf_path ? r.menu_pdf_path.split("/").pop() : <span className="text-zinc-500">No menu uploaded</span>}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <label className={cn(
            "inline-flex cursor-pointer items-center rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium hover:bg-zinc-50",
            busy && "pointer-events-none opacity-60",
          )}>
            {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1.5 h-3.5 w-3.5" />}
            {busy ? (status || "Working…") : r.menu_pdf_path ? "Replace" : "Upload"}
            <input type="file" accept="application/pdf" className="hidden" onChange={replace} disabled={busy} />
          </label>
          {r.menu_pdf_path && !busy && (
            <button onClick={remove} className="rounded-full p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900" aria-label="Remove menu">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      {r.menu_pdf_path && chunks !== null && (
        chunks > 0 ? (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600">
            <Sparkle className="h-3 w-3" /> Indexed for AI ({chunks} sections) — your concierge reads this menu.
          </p>
        ) : (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-[#c2410c]">
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
      <p className="text-sm text-zinc-500">
        Write your own questions and answers. Your concierge will prefer these when guests ask something similar.
      </p>

      <div className="mt-5 space-y-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
        <Input placeholder="Question (e.g. Do you take walk-ins?)" value={q} onChange={(e) => setQ(e.target.value)} className="h-10 rounded-xl bg-white" />
        <Textarea placeholder="Answer" value={a} onChange={(e) => setA(e.target.value)} className="min-h-[72px] rounded-xl bg-white" />
        <Button onClick={add} disabled={saving} className="rounded-full">
          {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1.5 h-3.5 w-3.5" />}
          Add Q&A
        </Button>
      </div>

      <div className="mt-5 space-y-3">
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-zinc-500" /></div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-zinc-500">
            <HelpCircle className="h-6 w-6" />
            No custom Q&A yet. Add your first one above.
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="rounded-2xl border border-zinc-200 p-4">
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
                    <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-500">{item.answer}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button onClick={() => startEdit(item)} className="rounded-full p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900" aria-label="Edit"><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => remove(item.id)} className="rounded-full p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900" aria-label="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
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
        <p className="text-sm text-zinc-500">
          What guests ask your concierge — synced live. {logs.length > 0 && <span className="text-zinc-900">{logs.length} total</span>}
        </p>
        <Button variant="ghost" size="sm" onClick={load} className="rounded-full"><RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-zinc-500" /></div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-zinc-500">
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
              <div key={log.id} className="rounded-2xl border border-zinc-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium">{log.question}</p>
                  <button onClick={() => remove(log.id)} className="shrink-0 rounded-full p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900" aria-label="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
                {log.answer && <p className="mt-1.5 whitespace-pre-wrap text-sm text-zinc-500">{log.answer}</p>}
                <p className="mt-2 text-xs text-zinc-400">{new Date(log.created_at).toLocaleString()}</p>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="frequent" className="mt-4 space-y-2">
            {frequent.map((f, i) => (
              <div key={i} className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 p-3">
                <p className="min-w-0 text-sm">{f.question}</p>
                <span className={cn(
                  "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                  f.count > 1 ? "bg-[#ffedd5] text-[#c2410c]" : "bg-zinc-100 text-zinc-500",
                )}>
                  {f.count}× {f.count > 1 ? "asked" : ""}
                </span>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="topics" className="mt-4">
            {topics.length === 0 ? (
              <p className="py-6 text-center text-sm text-zinc-500">Not enough questions yet to spot recurring topics.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {topics.map(([word, n]) => (
                  <span key={word} className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm">
                    {word} <span className="rounded-full bg-[#ffedd5] px-1.5 text-xs font-semibold text-[#c2410c]">{n}</span>
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

/* ------------------------------ Plan & usage ------------------------------- */

type PlanId = "free" | "pro_monthly" | "pro_annual";

const PLAN_META: Record<PlanId, { name: string; badge: string }> = {
  free: { name: "Free Trial", badge: "bg-zinc-100 text-zinc-600" },
  pro_monthly: { name: "Pro · Monthly", badge: "bg-[#ffedd5] text-[#c2410c]" },
  pro_annual: { name: "Pro · Annual", badge: "bg-emerald-50 text-emerald-600" },
};

// Pro plans include a generous monthly message allowance (effectively
// unlimited for a typical independent restaurant).
const PRO_INCLUDED = 1500;

type Usage = { plan: string; used: number; limit: number; used_today: number; daily_limit: number; allowed: boolean; reason: string | null };

function PlanUsageCard({ r, onSaved }: { r: any; onSaved: (fields: Record<string, any>) => void }) {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadUsage = async () => {
    const { data } = await supabase.rpc("get_usage", { p_restaurant_id: r.id });
    if (data) setUsage(data as unknown as Usage);
  };
  useEffect(() => { loadUsage(); /* eslint-disable-next-line */ }, [r.id]);

  const plan: PlanId = (["free", "pro_monthly", "pro_annual"].includes(r.plan) ? r.plan : "free") as PlanId;
  const isFree = plan === "free";
  const used = usage?.used ?? Number(r.messages_used ?? 0);
  const freeLimit = usage?.limit ?? Number(r.free_message_limit ?? 20);
  const usedToday = usage?.used_today ?? 0;
  const dailyLimit = usage?.daily_limit ?? Number(r.daily_free_limit ?? 12);
  const limit = isFree ? freeLimit : PRO_INCLUDED;
  const pct = Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
  const remaining = Math.max(0, limit - used);
  const out = isFree && usage ? usage.allowed === false : false;
  const dailyReached = isFree && usage?.reason === "daily";

  const meterColor = out ? "#dc2626" : pct > 75 ? "#ea580c" : isFree ? "#c2410c" : "#16a34a";

  // Real billing: start a Stripe Checkout session and redirect to it.
  const subscribe = async (target: PlanId) => {
    if (target === "free") return;
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan: target }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
        window.location.href = data.url; // → Stripe hosted checkout
        return;
      }
      toast.error(data.error || "Couldn't start checkout. Please try again.");
    } catch {
      toast.error("Couldn't reach billing. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  // Paying customers manage / cancel via the Stripe billing portal.
  const manage = async () => {
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/billing-portal", {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) { window.location.href = data.url; return; }
      toast.error(data.error || "Couldn't open billing portal.");
    } catch {
      toast.error("Couldn't reach billing. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const resetDemo = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("reset_demo_usage", { p_restaurant_id: r.id });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    onSaved({ plan: "free", messages_used: 0 });
    loadUsage();
    toast.success("Demo usage reset — you're back on the free plan.");
  };

  return (
    <Card title="Plan & Usage">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-500">
          Track how many AI messages your concierge has answered guests and manage your plan.
        </p>
        <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold", PLAN_META[plan].badge)}>
          {plan === "free" ? <Zap className="h-3 w-3" /> : <Crown className="h-3 w-3" />}
          {PLAN_META[plan].name}
        </span>
      </div>

      {/* Usage meter */}
      <div className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-3xl font-semibold tracking-tight">
              {used.toLocaleString()}
              <span className="text-lg font-medium text-zinc-400"> / {limit.toLocaleString()}</span>
            </div>
            <div className="mt-1 text-sm text-zinc-500">
              {isFree ? "free guest messages used" : "guest messages this month"}
            </div>
          </div>
          {isFree && (
            <div className={cn("text-right text-sm font-medium", out ? "text-red-600" : "text-zinc-500")}>
              {out ? (dailyReached ? "Daily limit reached" : "Free messages used up") : `${remaining} left`}
            </div>
          )}
        </div>
        <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-zinc-200">
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: meterColor }} />
        </div>

        {isFree && (
          <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
            <span>Today: <span className="font-medium text-zinc-700">{usedToday}</span> / {dailyLimit} daily</span>
            <span>Owner test chats are always free</span>
          </div>
        )}

        {out && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {dailyReached
                ? "You've hit today's free message cap. It resets tomorrow — or upgrade for unlimited guest messages."
                : "Your free guest messages are used up. Upgrade to keep your concierge answering guests 24/7."}
            </span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        {plan === "free" ? (
          <Button onClick={() => setShowUpgrade(true)} className="rounded-full bg-gradient-hero text-white hover:opacity-90">
            <Crown className="mr-1.5 h-3.5 w-3.5" /> Upgrade plan
          </Button>
        ) : (
          <Button onClick={manage} disabled={busy} variant="outline" className="rounded-full border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50">
            <CreditCard className="mr-1.5 h-3.5 w-3.5" /> Manage plan
          </Button>
        )}
        {isFree && (
          <button onClick={resetDemo} disabled={busy} className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 transition hover:text-zinc-900 disabled:opacity-50">
            <RotateCcw className="h-3.5 w-3.5" /> Reset free usage
          </button>
        )}
      </div>

      {showUpgrade && (
        <UpgradeModal current={plan} busy={busy} onClose={() => setShowUpgrade(false)} onSelect={subscribe} />
      )}
    </Card>
  );
}

const PLANS: Array<{
  id: PlanId; name: string; price: string; cadence: string; note?: string;
  highlight?: boolean; features: string[];
}> = [
  {
    id: "pro_monthly",
    name: "Pro",
    price: "$19",
    cadence: "/month",
    features: [
      "Unlimited guest messages (fair use)",
      "No daily caps",
      "Reads your menu PDF (RAG)",
      "Unlimited custom Q&A",
      "Live guest-question analytics",
      "Custom branding & action buttons",
    ],
  },
  {
    id: "pro_annual",
    name: "Pro Annual",
    price: "$179",
    cadence: "/year",
    note: "Save 22% — ~$14.92/mo",
    highlight: true,
    features: [
      "Everything in Pro, billed yearly",
      "2 months free vs monthly",
      "Priority support",
      "Lock in early-bird pricing",
    ],
  },
];

function UpgradeModal({
  current, busy, onClose, onSelect,
}: { current: PlanId; busy: boolean; onClose: () => void; onSelect: (p: PlanId) => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-zinc-900/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-zinc-200 px-6 py-5">
          <div>
            <h3 className="text-xl font-semibold tracking-tight">Choose your plan</h3>
            <p className="mt-1 text-sm text-zinc-500">Simple pricing, less than a single missed reservation. Cancel anytime.</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900"><X className="h-4 w-4" /></button>
        </div>

        <div className="grid gap-4 p-6 sm:grid-cols-2">
          {PLANS.map((p) => {
            const isCurrent = current === p.id;
            return (
              <div
                key={p.id}
                className={cn(
                  "relative flex flex-col rounded-2xl border p-5",
                  p.highlight ? "border-[#c2410c] ring-1 ring-[#c2410c]" : "border-zinc-200",
                )}
              >
                {p.highlight && (
                  <span className="absolute -top-2.5 left-5 rounded-full bg-[#c2410c] px-2.5 py-0.5 text-[11px] font-semibold text-white">Best value</span>
                )}
                <div className="text-sm font-semibold text-zinc-900">{p.name}</div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-semibold tracking-tight">{p.price}</span>
                  <span className="text-sm text-zinc-500">{p.cadence}</span>
                </div>
                {p.note && <div className="mt-1 text-xs font-medium text-emerald-600">{p.note}</div>}
                <ul className="mt-4 flex-1 space-y-2">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-zinc-600">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#c2410c]" /> {f}
                    </li>
                  ))}
                </ul>
                <Button
                  onClick={() => onSelect(p.id)}
                  disabled={busy || isCurrent}
                  className={cn(
                    "mt-5 w-full rounded-full",
                    p.highlight ? "bg-[#c2410c] text-white hover:bg-[#9a3412]" : "bg-gradient-hero text-white hover:opacity-90",
                  )}
                >
                  {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                  {isCurrent ? "Current plan" : `Choose ${p.name}`}
                </Button>
              </div>
            );
          })}
        </div>

        <div className="border-t border-zinc-200 bg-zinc-50 px-6 py-3 text-center text-xs text-zinc-400">
          Secure checkout powered by Stripe. Cancel anytime from your dashboard.
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ Widget install ----------------------------- */

function WidgetInstallCard({ r }: { r: any }) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const widgetSnippet = `<script src="${origin}/widget.js" data-restaurant="${r.id}" data-color="${r.brand_color || "#7c3aed"}" data-name="${(r.concierge_name || "Maître AI").replace(/"/g, "&quot;")}" data-welcome="${(r.welcome_message || "Hello!").replace(/"/g, "&quot;")}" async></script>`;
  const copy = () => { navigator.clipboard.writeText(widgetSnippet); toast.success("Snippet copied"); };

  return (
    <Card title="Widget Installation">
      <p className="text-sm text-zinc-500">
        Paste this snippet into your site's <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs">&lt;/body&gt;</code> tag.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <PlatformGuide name="Wix" steps={["Settings → Custom Code (NOT HTML Embed — embeds run in an isolated iframe)", "Add Custom Code → All Pages → Body - end", "Paste snippet and save"]} />
        <PlatformGuide name="Squarespace" steps={["Settings → Advanced → Code Injection", "Paste snippet in Footer", "Save"]} />
      </div>
      <div className="mt-5 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-900 p-4">
        <pre className="overflow-x-auto text-xs leading-relaxed text-zinc-100">{widgetSnippet}</pre>
      </div>
      <Button onClick={copy} variant="outline" className="mt-4 rounded-full">
        <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy snippet
      </Button>
    </Card>
  );
}

/* ----------------------- Beta usage ring (header) ------------------------- */

function UsageCard({ used, limit }: { used: number; limit: number }) {
  const safeLimit = Math.max(1, limit);
  const pct = Math.min(100, (used / safeLimit) * 100);
  const radius = 22;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (pct / 100) * circ;
  const over = used >= limit;
  const color = over ? "#dc2626" : pct > 80 ? "#ea580c" : "#c2410c";
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-zinc-200 bg-white px-5 py-4 shadow-sm">
      <div className="relative grid place-items-center">
        <svg width="56" height="56" viewBox="0 0 56 56" className="-rotate-90">
          <circle cx="28" cy="28" r={radius} fill="none" stroke="#f2f2f2" strokeWidth="5" />
          <circle
            cx="28"
            cy="28"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="5"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </svg>
        <span className="absolute text-[11px] font-bold tabular-nums" style={{ color }}>
          {Math.round(pct)}%
        </span>
      </div>
      <div>
        <div className="text-xl font-semibold leading-none tabular-nums">
          <span className={over ? "text-red-600" : "text-zinc-900"}>{used}</span>
          <span className="text-zinc-300">/{limit}</span>
        </div>
        <div className="mt-1.5 text-xs font-medium text-zinc-600">guest messages this month</div>
        <div className="mt-0.5 text-[11px] text-zinc-400">Beta limit · resets monthly</div>
      </div>
    </div>
  );
}

/* --------------------------------- Feedback ------------------------------- */

function FeedbackCard({ r }: { r: any }) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const submit = async () => {
    if (!subject.trim() || !message.trim()) {
      toast.error("Add a subject and a message");
      return;
    }
    setSending(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("feedback").insert({
      restaurant_id: r.id,
      user_id: user?.id ?? null,
      email: user?.email ?? null,
      subject: subject.trim().slice(0, 200),
      message: message.trim().slice(0, 4000),
    });
    setSending(false);
    if (error) { toast.error(error.message); return; }
    setSubject("");
    setMessage("");
    toast.success("Thanks! Your feedback was sent. 🙏");
  };

  return (
    <Card title="Give us feedback">
      <p className="text-sm text-zinc-500">
        Found a bug, want a feature, or have an idea? Send it straight to the team — we read every message.
      </p>
      <div className="mt-5 space-y-3">
        <Field label="Subject">
          <Input
            className={inputCls}
            value={subject}
            maxLength={200}
            onChange={(e) => setSubject(e.target.value)}
          />
        </Field>
        <Field label="Message">
          <Textarea
            className="min-h-[120px] rounded-xl"
            placeholder="Tell us what's on your mind…"
            value={message}
            maxLength={4000}
            onChange={(e) => setMessage(e.target.value)}
          />
        </Field>
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-400">{message.length}/4000</span>
          <Button onClick={submit} disabled={sending} className="rounded-full bg-gradient-hero text-white hover:opacity-90">
            {sending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1.5 h-3.5 w-3.5" />}
            Send feedback
          </Button>
        </div>
      </div>
    </Card>
  );
}

/* --------------------------------- Shared --------------------------------- */

const inputCls = "h-10 rounded-xl";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs uppercase tracking-wider text-zinc-500">{label}</label>
      {children}
    </div>
  );
}

function StatusCard({ title, status, label, icon, detail }: { title: string; status: "ready" | "missing"; label: string; icon: React.ReactNode; detail: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-zinc-200 bg-gradient-card p-6 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 text-sm font-medium text-zinc-500">{icon}{title}</div>
        <span className={cn(
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
          status === "ready" ? "bg-emerald-50 text-emerald-600" : "bg-[#ffedd5] text-[#c2410c]",
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
    <div className="rounded-xl border border-zinc-200 bg-white p-6 sm:p-8">
      <h2 className="mb-6 text-xl font-semibold tracking-tight text-zinc-900">{title}</h2>
      {children}
    </div>
  );
}

function PlatformGuide({ name, steps }: { name: string; steps: string[] }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="text-sm font-semibold">{name}</div>
      <ol className="mt-2 space-y-1 text-xs text-zinc-500">
        {steps.map((s, i) => <li key={i}>{i + 1}. {s}</li>)}
      </ol>
    </div>
  );
}

function PreviewWidget({ r, actions }: { r: any; actions?: ActionBtn[] }) {
  const color = r.brand_color || "#7c3aed";
  const list = (actions && actions.length
    ? actions
    : [
        { label: r.reservation_button_label, url: "", image: "" },
        { label: r.order_button_label, url: "", image: "" },
        { label: r.catering_button_label, url: "", image: "" },
      ]
  ).filter((b) => b && (b.label || b.image)).slice(0, 3);

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 shadow-md">
      <div style={{ background: color }} className="flex items-center gap-3 p-4 text-white">
        {r.logo_url ? (
          <img src={r.logo_url} alt="" className="h-9 w-9 border border-white/30 object-cover" style={{ borderRadius: shapeRadius(r.logo_shape) }} />
        ) : (
          <div className="grid h-9 w-9 place-items-center bg-white/20" style={{ borderRadius: shapeRadius(r.logo_shape) }}><Sparkles className="h-4 w-4" /></div>
        )}
        <div>
          <div className="text-sm font-semibold">{r.concierge_name || "Maître AI"}</div>
          <div className="text-xs opacity-80">Online</div>
        </div>
      </div>
      <div className="space-y-3 bg-white p-4">
        <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-zinc-100 p-3 text-sm">
          {r.welcome_message || "Hello!"}
        </div>
        {list.length > 0 && (
          <div className="grid grid-cols-3 gap-2 pt-1">
            {list.map((b, i) => (
              <div key={i} className="overflow-hidden rounded-xl border border-zinc-200">
                <div
                  className="grid h-11 place-items-center bg-cover bg-center text-white"
                  style={b.image ? { backgroundImage: `url(${b.image})` } : { background: `linear-gradient(135deg, ${color}, rgba(0,0,0,.3))` }}
                >
                  {!b.image && <ArrowUpRight className="h-3.5 w-3.5" />}
                </div>
                <div className="truncate px-1.5 py-1 text-center text-[10px] font-medium">{b.label || "Button"}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function cn(...c: (string | false | undefined)[]) { return c.filter(Boolean).join(" "); }
