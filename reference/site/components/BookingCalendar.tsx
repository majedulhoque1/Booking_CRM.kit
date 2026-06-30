import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, ChevronLeft, Clock, CalendarDays } from "lucide-react";
import { useLanguage } from "@/lib/language";
import { Calendar } from "@/components/ui/calendar";
import {
  getAvailableSlots,
  requestBooking,
  type AvailableSlot,
} from "@/lib/booking";

// Two-step public booking: pick day+time (from get_available_slots) → enter details
// (request_booking). Proven flow — do not rewrite the logic; only theme it and FILL the
// client specifics below. External deps the consuming app supplies: useLanguage (i18n),
// the shadcn Calendar, and the theme classes (card-soft / btn-accent / CSS tokens).

const inputCls =
  "w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20 transition";

// FILL: branch/location options from the brand brief. One generic branch by default.
const BRANCHES = ["Main"] as const;
const WINDOW_DAYS = 45;

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtTime(t: string, lang: "en" | "bn"): string {
  const [h, m] = t.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return new Intl.DateTimeFormat(lang === "bn" ? "bn-BD" : "en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

function fmtFullDate(d: Date, lang: "en" | "bn"): string {
  return new Intl.DateTimeFormat(lang === "bn" ? "bn-BD" : "en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(d);
}

type Step = "select" | "details";

export function BookingCalendar() {
  const { lang } = useLanguage();
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [step, setStep] = useState<Step>("select");
  const [selectedDay, setSelectedDay] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [form, setForm] = useState({ parent_name: "", child_age: "", phone: "", branch: BRANCHES[0], concern: "" });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const L = lang === "bn"
    ? {
        pickDay: "একটি তারিখ বেছে নিন", pickTime: "সময় বেছে নিন",
        pickDayHint: "উপলব্ধ সময় দেখতে একটি তারিখে ক্লিক করুন।",
        tz: "সব সময় স্থানীয় সময়",
        details: "আপনার তথ্য দিন", back: "পেছনে",
        name: "অভিভাবকের নাম", age: "শিশুর বয়স",
        phone: "ফোন নম্বর", branch: "পছন্দের শাখা", concern: "সংক্ষিপ্ত উদ্বেগ (ঐচ্ছিক)",
        submit: "অ্যাপয়েন্টমেন্ট অনুরোধ করুন",
        noSlots: "এই মুহূর্তে কোনো ফাঁকা সময় নেই। অনুগ্রহ করে পরে আবার দেখুন।",
        noTimes: "এই দিনে কোনো ফাঁকা সময় নেই।",
        taken: "দুঃখিত, সময়টি এইমাত্র নেওয়া হয়েছে। অন্য একটি বেছে নিন।",
        thanks: "ধন্যবাদ! আপনার অনুরোধ পেয়েছি। আমাদের কোঅর্ডিনেটর নিশ্চিত করতে শীঘ্রই কল করবেন।",
        loadFail: "সময়সূচী লোড করা যায়নি। পরে আবার চেষ্টা করুন।",
      }
    : {
        pickDay: "Pick a date", pickTime: "Pick a time",
        pickDayHint: "Select a date to see available times.",
        tz: "All times are shown in local time",
        details: "Your details", back: "Back",
        name: "Parent / Guardian Name", age: "Child's Age",
        phone: "Phone Number", branch: "Preferred Branch", concern: "Brief concern (optional)",
        submit: "Request appointment",
        noSlots: "No free slots are available right now. Please check back later.",
        noTimes: "No free times on this day.",
        taken: "Sorry, that slot was just taken. Please pick another.",
        thanks: "Thank you! We've received your request. Our coordinator will call shortly to confirm.",
        loadFail: "Couldn't load the schedule. Please try again later.",
      };

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const from = toDateStr(new Date());
      const toDate = new Date();
      toDate.setDate(toDate.getDate() + WINDOW_DAYS);
      const data = await getAvailableSlots(from, toDateStr(toDate));
      setSlots(data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const byDate = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const s of slots) {
      if (!map.has(s.slot_date)) map.set(s.slot_date, []);
      map.get(s.slot_date)!.push(s.slot_time);
    }
    return map;
  }, [slots]);

  const availableDays = useMemo(() => new Set(byDate.keys()), [byDate]);
  const selectedDateStr = selectedDay ? toDateStr(selectedDay) : null;
  const times = selectedDateStr ? (byDate.get(selectedDateStr) ?? []) : [];

  function chooseTime(t: string) {
    setSelectedTime(t);
    setMessage(null);
    setStep("details");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedDateStr || !selectedTime) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await requestBooking({
        name: form.parent_name,
        phone: form.phone,
        childAge: Number(form.child_age) || 0,
        branch: form.branch,
        concern: form.concern,
        date: selectedDateStr,
        time: selectedTime,
        language: lang,
      });
      if (res.status === "ok") {
        setDone(true);
      } else if (res.status === "slot_taken" || res.status === "invalid_slot") {
        setMessage(L.taken);
        setSelectedTime(null);
        setStep("select");
        await load();
      } else {
        setMessage(L.loadFail);
      }
    } catch {
      setMessage(L.loadFail);
    } finally {
      setSubmitting(false);
    }
  }

  // ── States ──────────────────────────────────────────────────────────────────

  if (done) {
    return (
      <div className="card-soft p-8 text-center" style={{ background: "color-mix(in oklab, var(--color-supporting) 8%, white)" }}>
        <CheckCircle2 className="mx-auto mb-3 text-supporting" size={42} />
        <p className={`text-foreground font-medium ${lang === "bn" ? "font-bangla" : ""}`}>{L.thanks}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="card-soft p-10 flex items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="animate-spin" size={18} />
      </div>
    );
  }

  if (loadError) {
    return <div className="card-soft p-8 text-center text-destructive">{L.loadFail}</div>;
  }

  if (availableDays.size === 0) {
    return <div className="card-soft p-8 text-center text-muted-foreground">{L.noSlots}</div>;
  }

  // ── Details step ──────────────────────────────────────────────────────────────

  if (step === "details" && selectedDay && selectedTime) {
    return (
      <div className={`card-soft p-6 sm:p-8 ${lang === "bn" ? "font-bangla" : ""}`}>
        <button
          type="button"
          onClick={() => { setStep("select"); setSelectedTime(null); }}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-secondary transition mb-4"
        >
          <ChevronLeft size={16} /> {L.back}
        </button>

        <div className="rounded-xl border border-secondary/20 bg-secondary/[0.06] p-4 mb-6 space-y-1.5">
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <CalendarDays size={16} className="text-secondary" /> {fmtFullDate(selectedDay, lang)}
          </p>
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Clock size={16} className="text-secondary" /> {fmtTime(selectedTime, lang)}
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground">{L.details}</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label={L.name}>
              <input required type="text" className={inputCls} value={form.parent_name}
                onChange={(e) => setForm({ ...form, parent_name: e.target.value })} />
            </Field>
            {/* FILL: child_age is the reference intake field (→ contacts.details). Swap for your own. */}
            <Field label={L.age}>
              <input required type="number" min={0} max={30} className={inputCls} value={form.child_age}
                onChange={(e) => setForm({ ...form, child_age: e.target.value })} />
            </Field>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label={L.phone}>
              <input required type="tel" className={inputCls} value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label={L.branch}>
              <select required className={inputCls} value={form.branch}
                onChange={(e) => setForm({ ...form, branch: e.target.value })}>
                {BRANCHES.map((b) => <option key={b}>{b}</option>)}
              </select>
            </Field>
          </div>
          <Field label={L.concern}>
            <textarea rows={3} className={inputCls} value={form.concern}
              onChange={(e) => setForm({ ...form, concern: e.target.value })} />
          </Field>
          {message && <p className="text-sm text-destructive">{message}</p>}
          <button type="submit" disabled={submitting}
            className="btn-accent w-full sm:w-auto disabled:opacity-60">
            {submitting ? <Loader2 className="animate-spin" size={16} /> : L.submit}
          </button>
        </form>
      </div>
    );
  }

  // ── Select step (calendar + times) ──────────────────────────────────────────

  return (
    <div className={`card-soft p-4 sm:p-6 ${lang === "bn" ? "font-bangla" : ""}`}>
      {message && <p className="mb-4 text-sm text-destructive">{message}</p>}
      <div className="grid gap-6 md:grid-cols-[auto_1fr]">
        {/* Calendar */}
        <div className="flex justify-center md:border-r md:border-border md:pr-6">
          <Calendar
            mode="single"
            selected={selectedDay}
            onSelect={(d) => { setSelectedDay(d ?? undefined); setSelectedTime(null); }}
            startMonth={new Date()}
            disabled={(day) => !availableDays.has(toDateStr(day))}
            className="p-0"
          />
        </div>

        {/* Times */}
        <div className="min-w-0">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-foreground">
              {selectedDay ? fmtFullDate(selectedDay, lang) : L.pickDay}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">{L.tz}</p>
          </div>

          {!selectedDay ? (
            <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground text-center px-4">
              {L.pickDayHint}
            </div>
          ) : times.length === 0 ? (
            <p className="text-sm text-muted-foreground">{L.noTimes}</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-72 overflow-y-auto pr-1">
              {times.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => chooseTime(t)}
                  className="rounded-lg border border-secondary/40 bg-background px-3 py-2.5 text-sm font-medium text-secondary hover:bg-secondary hover:text-secondary-foreground transition"
                >
                  {fmtTime(t, lang)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-semibold text-foreground mb-1.5">{label}</span>
      {children}
    </label>
  );
}
