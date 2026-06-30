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
import { PhoneField, AddressAutocomplete } from "@/components/form-fields";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: Onboarding,
});

type DayHours = { closed: boolean; open: string; close: string; kitchen_close: string };

const DAYS: [string, string][] = [
  ["mon", "Monday"], ["tue", "Tuesday"], ["wed", "Wednesday"], ["thu", "Thursday"],
  ["fri", "Friday"], ["sat", "Saturday"], ["sun", "Sunday"],
];
const defaultDay = (): DayHours => ({ closed: false, open: "11:00", close: "22:00", kitchen_close: "" });
const defaultHours = (): Record<string, DayHours> => Object.fromEntries(DAYS.map(([k]) => [k, defaultDay()]));

const ALLERGENS = ["Peanuts", "Tree Nuts", "Dairy", "Eggs", "Gluten / Wheat", "Soy", "Fish", "Shellfish", "Sesame"];

type Form = {
  name: string; website_url: string; address: string; phone: string; emergency_contact: string; email: string;
  hours: Record<string, DayHours>; holiday_hours: string;
  cuisine_type: string; bot_tone: string; story: string; popular_dishes: string; daily_specials: string;
  parking_info: string; delivery_pickup: string;
  reservation_link: string; order_online_link: string; catering_link: string; instagram_link: string; google_maps_link: string;
  pet_policy: string; dress_code: string;
  menu_pdf_path: string; catering_menu_pdf_path: string;
  allergens: string[]; allergy_info: string;
  dietary_vegan: boolean; dietary_vegetarian: boolean; dietary_gluten_free: boolean; dietary_halal: boolean;
  concierge_name: string; brand_color: string; welcome_message: string;
  reservation_button_label: string; order_button_label: string; catering_button_label: string;
};

const empty: Form = {
  name: "", website_url: "", address: "", phone: "", emergency_contact: "", email: "",
  hours: defaultHours(), holiday_hours: "",
  cuisine_type: "", bot_tone: "balanced", story: "", popular_dishes: "", daily_specials: "",
  parking_info: "", delivery_pickup: "",
  reservation_link: "", order_online_link: "", catering_link: "", instagram_link: "", google_maps_link: "",
  pet_policy: "", dress_code: "",
  menu_pdf_path: "", catering_menu_pdf_path: "",
  allergens: [], allergy_info: "",
  dietary_vegan: false, dietary_vegetarian: false, dietary_gluten_free: false, dietary_halal: false,
  concierge_name: "Maître AI", brand_color: "#7c3aed", welcome_message: "Hello! How can I help you today?",
  reservation_button_label: "Reserve a Table", order_button_label: "Order Online", catering_button_label: "Catering Inquiry",
};

const STEPS = [
  { n: 1, title: "Location & Contact", desc: "Where you are and how to reach you" },
  { n: 2, title: "Hours", desc: "When you're open — and when the kitchen closes" },
  { n: 3, title: "Cuisine & Voice", desc: "Your food and how your concierge speaks" },
  { n: 4, title: "Menu & Allergens", desc: "What you serve and safety information" },
  { n: 5, title: "Guest Services", desc: "Reservations, parking, and policies" },
  { n: 6, title: "Your Concierge", desc: "Name, color, and greeting" },
];
const TOTAL = STEPS.length;

type Update = <K extends keyof Form>(k: K, v: Form[K]) => void;

function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<Form>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [userId, setUserId] = useState<string>("");
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    (async () => {
      const isEdit = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("edit") === "1";
      setEditMode(isEdit);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data } = await supabase.from("restaurants").select("*").eq("user_id", user.id).maybeSingle();
      if (data) {
        if (data.onboarding_completed && !isEdit) {
          navigate({ to: "/dashboard", replace: true });
          return;
        }
        const loaded = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== null));
        const merged = { ...empty, ...loaded } as Form;
        // Ensure every day exists and has all fields (older/partial data is healed).
        const lh = (merged.hours || {}) as Record<string, Partial<DayHours>>;
        merged.hours = Object.fromEntries(DAYS.map(([k]) => [k, { ...defaultDay(), ...(lh[k] || {}) }]));
        if (!Array.isArray(merged.allergens)) merged.allergens = [];
        setForm(merged);
        if (!isEdit) setStep(data.onboarding_step || 1);
      }
      setLoading(false);
    })();
  }, [navigate]);

  const update: Update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const persist = async (nextStep: number, completed = false) => {
    setSaving(true);
    const payload: Record<string, any> = { ...form, onboarding_step: nextStep };
    if (completed) payload.onboarding_completed = true;
    const { error } = await supabase.from("restaurants").update(payload as never).eq("user_id", userId);
    setSaving(false);
    if (error) { toast.error(error.message); return false; }
    return true;
  };

  const validate = (): string | null => {
    if (step === 1) {
      if (!form.name.trim()) return "Please add your restaurant name.";
      if (!form.address.trim()) return "Please add your address.";
      if (!form.phone.trim()) return "Please add a phone number.";
    }
    if (step === 3 && !form.cuisine_type.trim()) return "Please add your cuisine type.";
    return null;
  };

  const next = async () => {
    const err = validate();
    if (err) { toast.error(err); return; }
    const ok = await persist(Math.min(step + 1, TOTAL), editMode);
    if (ok) setStep((s) => Math.min(s + 1, TOTAL));
  };

  const back = () => setStep((s) => Math.max(s - 1, 1));

  const jump = async (n: number) => {
    const ok = await persist(Math.max(n, step), editMode);
    if (ok) setStep(n);
  };

  const finish = async () => {
    const ok = await persist(TOTAL, true);
    if (ok) {
      if (editMode) { toast.success("Saved"); navigate({ to: "/dashboard" }); }
      else setDone(true);
    }
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
          {editMode ? (
            <button onClick={() => navigate({ to: "/dashboard" })} className="text-xs text-muted-foreground hover:text-foreground">
              Back to dashboard
            </button>
          ) : (
            <button onClick={() => supabase.auth.signOut().then(() => navigate({ to: "/" }))} className="text-xs text-muted-foreground hover:text-foreground">
              Sign out
            </button>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-12 sm:px-10 sm:py-16">
        <Progress step={step} />

        <div className="mt-12 grid gap-12 lg:grid-cols-[280px_1fr]">
          <aside className="hidden lg:block">
            <div className="sticky top-8 space-y-1">
              {STEPS.map((s) => {
                const clickable = editMode || s.n <= step;
                return (
                  <button
                    key={s.n}
                    onClick={() => clickable && jump(s.n)}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-xl p-3 text-left transition",
                      s.n === step && "bg-card shadow-sm",
                      clickable && s.n !== step && "cursor-pointer text-muted-foreground hover:bg-card/50",
                      !clickable && "cursor-default text-muted-foreground/60",
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
                );
              })}
            </div>
          </aside>

          <main>
            <div className="mb-8">
              <p className="text-xs font-medium uppercase tracking-wider text-accent">
                {editMode ? "Edit details" : `Step ${step} of ${TOTAL}`}
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{STEPS[step - 1].title}</h1>
              <p className="mt-2 text-muted-foreground">{STEPS[step - 1].desc}</p>
            </div>

            <div className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-10">
              {step === 1 && <Step1 form={form} update={update} />}
              {step === 2 && <Step2 form={form} update={update} />}
              {step === 3 && <Step3 form={form} update={update} />}
              {step === 4 && <Step4 form={form} update={update} userId={userId} />}
              {step === 5 && <Step5 form={form} update={update} />}
              {step === 6 && <Step6 form={form} update={update} />}
            </div>

            <div className="mt-8 flex items-center justify-between">
              <Button variant="ghost" onClick={back} disabled={step === 1} className="rounded-full">
                <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
              </Button>
              {step < TOTAL ? (
                <Button onClick={next} disabled={saving} className="rounded-full bg-gradient-hero px-6 shadow-glow">
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {editMode ? "Save & continue" : "Continue"} <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={finish} disabled={saving} className="rounded-full bg-gradient-hero px-6 shadow-glow">
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  {editMode ? "Save changes" : "Launch concierge"}
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
  const pct = Math.round((step / TOTAL) * 100);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Setup progress</span>
        <span className="font-medium text-foreground">{pct}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-gradient-hero transition-all duration-500 ease-out" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Field({ label, children, hint, required }: { label: string; children: React.ReactNode; hint?: string; required?: boolean }) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">
        {label} {required && <span className="text-accent">*</span>}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

const inputCls = "h-11 rounded-xl";
const timeCls = "h-9 rounded-lg border border-border bg-background px-2 text-sm outline-none focus:border-foreground";

function Segmented({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(([val, label]) => (
        <button
          key={val}
          type="button"
          onClick={() => onChange(val)}
          className={cn(
            "rounded-full border px-4 py-2 text-sm font-medium transition",
            value === val ? "border-foreground bg-foreground text-background" : "border-border hover:border-foreground/40",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------ Step 1: Location & Contact ------------------------------ */
function Step1({ form, update }: { form: Form; update: Update }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Field label="Restaurant Name" required>
          <Input className={inputCls} placeholder="Trattoria Roma" value={form.name} onChange={(e) => update("name", e.target.value)} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Physical Address" required hint="Used for directions, delivery zones, and hours timezone.">
          <AddressAutocomplete placeholder="Start typing your address…" value={form.address} onChange={(v) => update("address", v)} />
        </Field>
      </div>
      <Field label="Main Phone Number" required>
        <PhoneField placeholder="(415) 555-0142" value={form.phone} onChange={(v) => update("phone", v)} />
      </Field>
      <Field label="Manager / Emergency Contact" hint="Where the concierge routes urgent calls or escalations.">
        <PhoneField placeholder="(415) 555-0199" value={form.emergency_contact} onChange={(v) => update("emergency_contact", v)} />
      </Field>
      <Field label="Email"><Input className={inputCls} type="email" placeholder="hello@yoursite.com" value={form.email} onChange={(e) => update("email", e.target.value)} /></Field>
      <Field label="Website"><Input className={inputCls} placeholder="https://yoursite.com" value={form.website_url} onChange={(e) => update("website_url", e.target.value)} /></Field>
    </div>
  );
}

/* ------------------------------ Step 2: Hours ------------------------------ */
function Step2({ form, update }: { form: Form; update: Update }) {
  const setDay = (day: string, patch: Partial<DayHours>) =>
    update("hours", { ...form.hours, [day]: { ...(form.hours[day] || defaultDay()), ...patch } });

  return (
    <div className="space-y-6">
      <Field label="Weekly Hours" hint="Uncheck a day to mark it closed. Set a separate kitchen-closing time if it differs from the dining room.">
        <div className="space-y-2.5">
          {DAYS.map(([key, label]) => {
            const d = form.hours[key] || defaultDay();
            return (
              <div key={key} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border bg-background p-3">
                <label className="flex w-[120px] items-center gap-2">
                  <Checkbox checked={!d.closed} onCheckedChange={(v) => setDay(key, { closed: !v })} />
                  <span className="text-sm font-medium">{label}</span>
                </label>
                {d.closed ? (
                  <span className="text-sm text-muted-foreground">Closed</span>
                ) : (
                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <input type="time" value={d.open} onChange={(e) => setDay(key, { open: e.target.value })} className={timeCls} />
                    <span>–</span>
                    <input type="time" value={d.close} onChange={(e) => setDay(key, { close: e.target.value })} className={timeCls} />
                    <span className="ml-2 text-xs">Kitchen closes</span>
                    <input type="time" value={d.kitchen_close} onChange={(e) => setDay(key, { kitchen_close: e.target.value })} className={timeCls} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Field>
      <Field label="Holiday & Special Hours" hint="Any exceptions guests should know — e.g. closed on Thanksgiving, limited hours on Dec 24.">
        <Textarea rows={3} className="rounded-xl" placeholder="Closed Thanksgiving & Christmas Day. Dec 24: 11am–4pm." value={form.holiday_hours} onChange={(e) => update("holiday_hours", e.target.value)} />
      </Field>
    </div>
  );
}

/* ------------------------------ Step 3: Cuisine & Voice ------------------------------ */
function Step3({ form, update }: { form: Form; update: Update }) {
  return (
    <div className="space-y-6">
      <Field label="Cuisine Type" required>
        <Input className={inputCls} placeholder="Italian · Wood-fired pizza" value={form.cuisine_type} onChange={(e) => update("cuisine_type", e.target.value)} />
      </Field>
      <Field label="Concierge Voice & Tone" hint="How your AI host speaks to guests.">
        <Segmented
          value={form.bot_tone}
          onChange={(v) => update("bot_tone", v)}
          options={[["casual", "Casual & Friendly"], ["balanced", "Warm & Balanced"], ["formal", "Polished & Formal"]]}
        />
      </Field>
      <Field label="Restaurant Story" hint="A short story about your restaurant — helps the concierge sound like you.">
        <Textarea rows={4} className="rounded-xl" placeholder="Founded in 1995, we bring authentic Roman recipes to North Beach..." value={form.story} onChange={(e) => update("story", e.target.value)} />
      </Field>
      <Field label="Popular Dishes" hint="Comma separated.">
        <Textarea rows={2} className="rounded-xl" placeholder="Cacio e Pepe, Saltimbocca alla Romana, Tiramisu" value={form.popular_dishes} onChange={(e) => update("popular_dishes", e.target.value)} />
      </Field>
      <Field label="Daily Specials / Notes" hint="Anything not on the printed menu the concierge should mention.">
        <Textarea rows={2} className="rounded-xl" placeholder="Tuesday: half-price bottles. Weekend brunch 10am–2pm." value={form.daily_specials} onChange={(e) => update("daily_specials", e.target.value)} />
      </Field>
    </div>
  );
}

/* ------------------------------ Step 4: Menu & Allergens ------------------------------ */
function Step4({ form, update, userId }: { form: Form; update: Update; userId: string }) {
  const toggleAllergen = (a: string) =>
    update("allergens", form.allergens.includes(a) ? form.allergens.filter((x) => x !== a) : [...form.allergens, a]);

  return (
    <div className="space-y-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <FileUpload label="Menu PDF" path={form.menu_pdf_path} userId={userId} source="menu" onChange={(p) => update("menu_pdf_path", p)} />
        <FileUpload label="Catering Menu PDF" path={form.catering_menu_pdf_path} userId={userId} source="catering_menu" onChange={(p) => update("catering_menu_pdf_path", p)} />
      </div>

      <Field label="Allergens Present in the Kitchen" hint="The concierge will flag these and always remind guests to notify staff about severe allergies.">
        <div className="flex flex-wrap gap-2">
          {ALLERGENS.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => toggleAllergen(a)}
              className={cn(
                "rounded-full border px-3.5 py-2 text-sm font-medium transition",
                form.allergens.includes(a) ? "border-foreground bg-foreground text-background" : "border-border hover:border-foreground/40",
              )}
            >
              {a}
            </button>
          ))}
        </div>
      </Field>

      <div>
        <Label className="mb-3 block text-sm font-medium">Dietary Options Offered</Label>
        <div className="grid gap-3 sm:grid-cols-2">
          {([
            ["dietary_vegan", "Vegan"], ["dietary_vegetarian", "Vegetarian"],
            ["dietary_gluten_free", "Gluten-Free options"], ["dietary_halal", "Halal"],
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

      <Field label="Allergen & Safety Disclaimer" hint="Your kitchen's cross-contamination policy, in your words.">
        <Textarea rows={3} className="rounded-xl" placeholder="We handle nuts and shellfish in a shared kitchen. Please notify your server of any severe allergies on arrival." value={form.allergy_info} onChange={(e) => update("allergy_info", e.target.value)} />
      </Field>
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

/* ------------------------------ Step 5: Guest Services ------------------------------ */
function Step5({ form, update }: { form: Form; update: Update }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Reservation Link" hint="OpenTable, Resy, SevenRooms, etc."><Input className={inputCls} placeholder="https://opentable.com/your-restaurant" value={form.reservation_link} onChange={(e) => update("reservation_link", e.target.value)} /></Field>
        <Field label="Order Online Link"><Input className={inputCls} placeholder="https://order.toasttab.com/..." value={form.order_online_link} onChange={(e) => update("order_online_link", e.target.value)} /></Field>
        <Field label="Catering Inquiry Link"><Input className={inputCls} placeholder="https://yoursite.com/catering" value={form.catering_link} onChange={(e) => update("catering_link", e.target.value)} /></Field>
        <Field label="Delivery & Pickup"><Input className={inputCls} placeholder="DoorDash, Uber Eats, in-house pickup" value={form.delivery_pickup} onChange={(e) => update("delivery_pickup", e.target.value)} /></Field>
      </div>

      <Field label="Parking & Transit" hint="Frees your host stand from repeat calls.">
        <Textarea rows={2} className="rounded-xl" placeholder="Street parking and free validation at the 4th St garage. Two blocks from Powell St BART." value={form.parking_info} onChange={(e) => update("parking_info", e.target.value)} />
      </Field>

      <Field label="Pet & Patio Policy">
        <Segmented
          value={form.pet_policy}
          onChange={(v) => update("pet_policy", v)}
          options={[["patio", "Dogs welcome on patio"], ["service_only", "Service animals only"], ["none", "No pets"]]}
        />
      </Field>

      <Field label="Dress Code">
        <Segmented
          value={form.dress_code}
          onChange={(v) => update("dress_code", v)}
          options={[["", "None"], ["casual", "Casual"], ["smart_casual", "Smart Casual"], ["business_formal", "Business / Formal"]]}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Instagram"><Input className={inputCls} placeholder="https://instagram.com/..." value={form.instagram_link} onChange={(e) => update("instagram_link", e.target.value)} /></Field>
        <Field label="Google Maps"><Input className={inputCls} placeholder="https://goo.gl/maps/..." value={form.google_maps_link} onChange={(e) => update("google_maps_link", e.target.value)} /></Field>
      </div>
    </div>
  );
}

/* ------------------------------ Step 6: Concierge ------------------------------ */
function Step6({ form, update }: { form: Form; update: Update }) {
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
