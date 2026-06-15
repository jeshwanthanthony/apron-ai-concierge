import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, ArrowRight, Check, Loader2, Sparkles, Upload, FileText, X, Utensils } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { extractPdfText, ingestMenu } from "@/lib/pdf-client";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: Onboarding,
});

type Form = {
  name: string; website_url: string; address: string; phone: string; email: string;
  cuisine_type: string; story: string; popular_dishes: string; parking_info: string; delivery_pickup: string;
  reservation_link: string; order_online_link: string; catering_link: string; instagram_link: string; google_maps_link: string;
  menu_pdf_path: string; catering_menu_pdf_path: string; allergy_info: string;
  dietary_vegan: boolean; dietary_vegetarian: boolean; dietary_gluten_free: boolean; dietary_halal: boolean;
  concierge_name: string; brand_color: string; welcome_message: string;
  reservation_button_label: string; order_button_label: string; catering_button_label: string;
};

const empty: Form = {
  name: "", website_url: "", address: "", phone: "", email: "",
  cuisine_type: "", story: "", popular_dishes: "", parking_info: "", delivery_pickup: "",
  reservation_link: "", order_online_link: "", catering_link: "", instagram_link: "", google_maps_link: "",
  menu_pdf_path: "", catering_menu_pdf_path: "", allergy_info: "",
  dietary_vegan: false, dietary_vegetarian: false, dietary_gluten_free: false, dietary_halal: false,
  concierge_name: "Concierge", brand_color: "#7c3aed", welcome_message: "Hello! How can I help you today?",
  reservation_button_label: "Reserve a Table", order_button_label: "Order Online", catering_button_label: "Catering Inquiry",
};

const STEPS = [
  { n: 1, title: "Restaurant Information", desc: "The essentials guests need to know" },
  { n: 2, title: "Restaurant Profile", desc: "What makes your restaurant special" },
  { n: 3, title: "Customer Links", desc: "Where guests take action" },
  { n: 4, title: "Menu & Dietary", desc: "Upload menus and dietary info" },
  { n: 5, title: "AI Concierge", desc: "Customize your assistant" },
];

function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<Form>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [userId, setUserId] = useState<string>("");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data } = await supabase.from("restaurants").select("*").eq("user_id", user.id).maybeSingle();
      if (data) {
        if (data.onboarding_completed) {
          navigate({ to: "/dashboard", replace: true });
          return;
        }
        setForm({ ...empty, ...Object.fromEntries(Object.entries(data).filter(([, v]) => v !== null)) } as Form);
        setStep(data.onboarding_step || 1);
      }
      setLoading(false);
    })();
  }, [navigate]);

  const update = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const persist = async (nextStep: number, completed = false) => {
    setSaving(true);
    const { error } = await supabase
      .from("restaurants")
      .update({ ...form, onboarding_step: nextStep, onboarding_completed: completed })
      .eq("user_id", userId);
    setSaving(false);
    if (error) { toast.error(error.message); return false; }
    return true;
  };

  const next = async () => {
    const ok = await persist(Math.min(step + 1, 5));
    if (ok) setStep((s) => Math.min(s + 1, 5));
  };

  const back = () => setStep((s) => Math.max(s - 1, 1));

  const finish = async () => {
    const ok = await persist(5, true);
    if (ok) setDone(true);
  };

  if (loading) {
    return <div className="grid min-h-screen place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (done) return <SuccessScreen onContinue={() => navigate({ to: "/dashboard" })} />;

  return (
    <div className="min-h-screen bg-gradient-soft">
      <header className="border-b border-border bg-background/80 px-6 py-4 backdrop-blur sm:px-10">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-hero text-primary-foreground">
              <Utensils className="h-3.5 w-3.5" />
            </div>
            <span className="text-sm font-semibold">Maitre</span>
          </div>
          <button onClick={() => supabase.auth.signOut().then(() => navigate({ to: "/" }))} className="text-xs text-muted-foreground hover:text-foreground">
            Sign out
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-12 sm:px-10 sm:py-16">
        <Progress step={step} />

        <div className="mt-12 grid gap-12 lg:grid-cols-[280px_1fr]">
          <aside className="hidden lg:block">
            <div className="sticky top-8 space-y-1">
              {STEPS.map((s) => (
                <button
                  key={s.n}
                  onClick={() => s.n < step && setStep(s.n)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-xl p-3 text-left transition",
                    s.n === step && "bg-card shadow-sm",
                    s.n < step && "cursor-pointer text-muted-foreground hover:bg-card/50",
                    s.n > step && "cursor-default text-muted-foreground/60",
                  )}
                >
                  <div className={cn(
                    "mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-medium",
                    s.n < step && "bg-success text-success-foreground",
                    s.n === step && "bg-foreground text-background",
                    s.n > step && "border border-border",
                  )}>
                    {s.n < step ? <Check className="h-3 w-3" /> : s.n}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{s.title}</div>
                    <div className="text-xs opacity-70">{s.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </aside>

          <main>
            <div className="mb-8">
              <p className="text-xs font-medium uppercase tracking-wider text-accent">Step {step} of 5</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{STEPS[step - 1].title}</h1>
              <p className="mt-2 text-muted-foreground">{STEPS[step - 1].desc}</p>
            </div>

            <div className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-10">
              {step === 1 && <Step1 form={form} update={update} />}
              {step === 2 && <Step2 form={form} update={update} />}
              {step === 3 && <Step3 form={form} update={update} />}
              {step === 4 && <Step4 form={form} update={update} userId={userId} />}
              {step === 5 && <Step5 form={form} update={update} />}
            </div>

            <div className="mt-8 flex items-center justify-between">
              <Button variant="ghost" onClick={back} disabled={step === 1} className="rounded-full">
                <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
              </Button>
              {step < 5 ? (
                <Button onClick={next} disabled={saving} className="rounded-full bg-gradient-hero px-6 shadow-glow">
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Continue <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={finish} disabled={saving} className="rounded-full bg-gradient-hero px-6 shadow-glow">
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  Launch concierge
                </Button>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

function Progress({ step }: { step: number }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Onboarding progress</span>
        <span className="font-medium text-foreground">{Math.round((step / 5) * 100)}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-gradient-hero transition-all duration-500 ease-out"
          style={{ width: `${(step / 5) * 100}%` }}
        />
      </div>
    </div>
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

const inputCls = "h-11 rounded-xl";

function Step1({ form, update }: { form: Form; update: <K extends keyof Form>(k: K, v: Form[K]) => void }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Field label="Restaurant Name">
          <Input className={inputCls} placeholder="Trattoria Roma" value={form.name} onChange={(e) => update("name", e.target.value)} />
        </Field>
      </div>
      <Field label="Website URL"><Input className={inputCls} placeholder="https://yoursite.com" value={form.website_url} onChange={(e) => update("website_url", e.target.value)} /></Field>
      <Field label="Phone Number"><Input className={inputCls} placeholder="(555) 123-4567" value={form.phone} onChange={(e) => update("phone", e.target.value)} /></Field>
      <div className="sm:col-span-2">
        <Field label="Address"><Input className={inputCls} placeholder="123 Main St, City, State" value={form.address} onChange={(e) => update("address", e.target.value)} /></Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Email"><Input className={inputCls} type="email" placeholder="hello@yoursite.com" value={form.email} onChange={(e) => update("email", e.target.value)} /></Field>
      </div>
    </div>
  );
}

function Step2({ form, update }: { form: Form; update: <K extends keyof Form>(k: K, v: Form[K]) => void }) {
  return (
    <div className="space-y-5">
      <Field label="Cuisine Type"><Input className={inputCls} placeholder="Italian, Mediterranean" value={form.cuisine_type} onChange={(e) => update("cuisine_type", e.target.value)} /></Field>
      <Field label="Restaurant Story" hint="A short story about your restaurant. Helps the concierge sound like you.">
        <Textarea rows={4} className="rounded-xl" placeholder="Founded in 1995, we bring authentic Roman recipes..." value={form.story} onChange={(e) => update("story", e.target.value)} />
      </Field>
      <Field label="Popular Dishes" hint="Comma separated">
        <Textarea rows={2} className="rounded-xl" placeholder="Cacio e Pepe, Saltimbocca alla Romana, Tiramisu" value={form.popular_dishes} onChange={(e) => update("popular_dishes", e.target.value)} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Parking Information"><Input className={inputCls} placeholder="Street parking & valet" value={form.parking_info} onChange={(e) => update("parking_info", e.target.value)} /></Field>
        <Field label="Delivery & Pickup"><Input className={inputCls} placeholder="DoorDash, in-house pickup" value={form.delivery_pickup} onChange={(e) => update("delivery_pickup", e.target.value)} /></Field>
      </div>
    </div>
  );
}

function Step3({ form, update }: { form: Form; update: <K extends keyof Form>(k: K, v: Form[K]) => void }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Field label="Reservation Link"><Input className={inputCls} placeholder="https://opentable.com/..." value={form.reservation_link} onChange={(e) => update("reservation_link", e.target.value)} /></Field>
      <Field label="Order Online Link"><Input className={inputCls} placeholder="https://order.toasttab.com/..." value={form.order_online_link} onChange={(e) => update("order_online_link", e.target.value)} /></Field>
      <Field label="Catering Inquiry Link"><Input className={inputCls} placeholder="https://yoursite.com/catering" value={form.catering_link} onChange={(e) => update("catering_link", e.target.value)} /></Field>
      <Field label="Instagram Link"><Input className={inputCls} placeholder="https://instagram.com/..." value={form.instagram_link} onChange={(e) => update("instagram_link", e.target.value)} /></Field>
      <div className="sm:col-span-2">
        <Field label="Google Maps Link"><Input className={inputCls} placeholder="https://goo.gl/maps/..." value={form.google_maps_link} onChange={(e) => update("google_maps_link", e.target.value)} /></Field>
      </div>
    </div>
  );
}

function Step4({ form, update, userId }: { form: Form; update: <K extends keyof Form>(k: K, v: Form[K]) => void; userId: string }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <FileUpload label="Menu PDF" path={form.menu_pdf_path} userId={userId} source="menu" onChange={(p) => update("menu_pdf_path", p)} />
        <FileUpload label="Catering Menu PDF" path={form.catering_menu_pdf_path} userId={userId} source="catering_menu" onChange={(p) => update("catering_menu_pdf_path", p)} />
      </div>
      <Field label="Allergy Information" hint="Anything guests should know about allergens, cross-contamination, etc.">
        <Textarea rows={3} className="rounded-xl" placeholder="We can accommodate most allergies. Please notify your server..." value={form.allergy_info} onChange={(e) => update("allergy_info", e.target.value)} />
      </Field>
      <div>
        <Label className="mb-3 block text-sm font-medium">Dietary Options</Label>
        <div className="grid gap-3 sm:grid-cols-2">
          {([
            ["dietary_vegan", "Vegan"], ["dietary_vegetarian", "Vegetarian"],
            ["dietary_gluten_free", "Gluten Free"], ["dietary_halal", "Halal"],
          ] as const).map(([key, label]) => (
            <label key={key} className={cn(
              "flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition",
              form[key] ? "border-foreground bg-warm/40" : "border-border hover:border-foreground/40",
            )}>
              <Checkbox checked={form[key]} onCheckedChange={(v) => update(key, !!v)} />
              <span className="text-sm font-medium">{label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

function FileUpload({ label, path, userId, onChange, source }: { label: string; path: string; userId: string; onChange: (p: string) => void; source?: "menu" | "catering_menu" }) {
  const [uploading, setUploading] = useState(false);
  const handle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const filePath = `${userId}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("menus").upload(filePath, file, { upsert: true });
    if (error) { setUploading(false); toast.error(error.message); return; }
    onChange(filePath);
    toast.success("Uploaded");

    // Index the document for the AI concierge (best-effort; never blocks setup).
    if (source) {
      try {
        const text = await extractPdfText(file);
        if (text.trim()) {
          const n = await ingestMenu(text, source);
          toast.success(`Indexed for your concierge (${n} sections).`);
        }
      } catch (err) {
        console.error("[onboarding] menu index failed", err);
      }
    }
    setUploading(false);
  };
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      {path ? (
        <div className="flex items-center justify-between rounded-xl border border-border bg-warm/30 p-4">
          <div className="flex items-center gap-3 min-w-0">
            <FileText className="h-5 w-5 shrink-0 text-primary" />
            <span className="truncate text-sm">{path.split("/").pop()}</span>
          </div>
          <button onClick={() => onChange("")} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-background p-6 transition hover:border-foreground/40 hover:bg-warm/20">
          {uploading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : <Upload className="h-5 w-5 text-muted-foreground" />}
          <span className="mt-2 text-xs text-muted-foreground">{uploading ? "Uploading..." : "Click to upload PDF"}</span>
          <input type="file" accept="application/pdf" className="hidden" onChange={handle} disabled={uploading} />
        </label>
      )}
    </div>
  );
}

function Step5({ form, update }: { form: Form; update: <K extends keyof Form>(k: K, v: Form[K]) => void }) {
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div className="space-y-5">
        <Field label="Concierge Name"><Input className={inputCls} value={form.concierge_name} onChange={(e) => update("concierge_name", e.target.value)} /></Field>
        <Field label="Brand Color">
          <div className="flex items-center gap-3">
            <input type="color" value={form.brand_color} onChange={(e) => update("brand_color", e.target.value)} className="h-11 w-14 cursor-pointer rounded-xl border border-border bg-transparent" />
            <Input className={inputCls} value={form.brand_color} onChange={(e) => update("brand_color", e.target.value)} />
          </div>
        </Field>
        <Field label="Welcome Message">
          <Textarea rows={3} className="rounded-xl" value={form.welcome_message} onChange={(e) => update("welcome_message", e.target.value)} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="Reservation Button"><Input className={inputCls} value={form.reservation_button_label} onChange={(e) => update("reservation_button_label", e.target.value)} /></Field>
          <Field label="Order Button"><Input className={inputCls} value={form.order_button_label} onChange={(e) => update("order_button_label", e.target.value)} /></Field>
          <Field label="Catering Button"><Input className={inputCls} value={form.catering_button_label} onChange={(e) => update("catering_button_label", e.target.value)} /></Field>
        </div>
      </div>
      <div>
        <Label className="mb-3 block text-sm font-medium">Live preview</Label>
        <ChatPreview form={form} />
      </div>
    </div>
  );
}

export function ChatPreview({ form }: { form: Form }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border shadow-elegant">
      <div style={{ background: form.brand_color }} className="flex items-center gap-3 p-4 text-white">
        <div className="grid h-9 w-9 place-items-center rounded-full bg-white/20">
          <Sparkles className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-semibold">{form.concierge_name || "Concierge"}</div>
          <div className="text-xs opacity-80">Online · typically replies instantly</div>
        </div>
      </div>
      <div className="space-y-3 bg-background p-4">
        <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-muted p-3 text-sm">
          {form.welcome_message || "Hello!"}
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          {[form.reservation_button_label, form.order_button_label, form.catering_button_label].filter(Boolean).map((b) => (
            <span key={b} style={{ borderColor: form.brand_color, color: form.brand_color }} className="rounded-full border bg-background px-3 py-1.5 text-xs font-medium">{b}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function SuccessScreen({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="grid min-h-screen place-items-center bg-gradient-soft px-6">
      <div className="max-w-lg text-center">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-gradient-hero text-primary-foreground shadow-glow">
          <Check className="h-10 w-10" strokeWidth={2.5} />
        </div>
        <h1 className="mt-8 text-4xl font-semibold tracking-tight sm:text-5xl">You're all set.</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Your AI concierge is ready to welcome guests. Let's get it on your site.
        </p>
        <Button onClick={onContinue} className="mt-8 h-12 rounded-full bg-gradient-hero px-8 shadow-glow">
          Go to dashboard <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
