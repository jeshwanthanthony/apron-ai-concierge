import { useEffect, useRef, useState } from "react";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { MapPin, Loader2 } from "lucide-react";

/**
 * International phone input — flag dropdown + country code auto-fill + live
 * formatting (powered by react-phone-number-input / libphonenumber-js).
 * Stores the value in E.164 form (e.g. +14155550142).
 */
export function PhoneField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <PhoneInput
      international
      defaultCountry="US"
      countryCallingCodeEditable={false}
      value={value || undefined}
      onChange={(v) => onChange(v || "")}
      placeholder={placeholder}
      className="arc-phone"
    />
  );
}

type Suggestion = { label: string; line1: string; line2: string };

/**
 * Address autocomplete — suggestions as you type, no API key (proxied through
 * /api/geocode → OpenStreetMap). Selecting a suggestion fills the field.
 */
export function AddressAutocomplete({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Suggestion[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const search = (q: string) => {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 3) {
      setItems([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setItems(Array.isArray(data.suggestions) ? data.suggestions : []);
        setOpen(true);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    }, 280);
  };

  const pick = (s: Suggestion) => {
    onChange(s.label);
    setOpen(false);
    setItems([]);
  };

  return (
    <div ref={boxRef} className="relative">
      <div className="flex h-10 items-center gap-2 rounded-xl border border-input bg-white px-3 focus-within:border-zinc-400">
        <MapPin className="h-4 w-4 shrink-0 text-zinc-400" />
        <input
          value={value}
          placeholder={placeholder}
          onChange={(e) => {
            onChange(e.target.value);
            search(e.target.value);
          }}
          onFocus={() => items.length && setOpen(true)}
          className="h-full flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          autoComplete="off"
        />
        {loading && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-zinc-400" />}
      </div>

      {open && items.length > 0 && (
        <div className="absolute z-30 mt-1.5 w-full overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg">
          {items.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => pick(s)}
              className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition hover:bg-zinc-50"
            >
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
              <span className="min-w-0 text-sm">
                <span className="font-medium text-zinc-900">{s.line1 || s.label}</span>
                {s.line2 && <span className="text-zinc-500"> {s.line2}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
