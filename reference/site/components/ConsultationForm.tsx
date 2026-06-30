import { useState } from "react";
import { useLanguage } from "@/lib/language";
import { CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// Lightweight "call me back" inquiry form. Writes DIRECTLY into public.inquiries as anon
// (contract 0008 grants anon INSERT-only — there is no submit_inquiry RPC). Because the
// insert is unauthenticated, a hidden honeypot field is the abuse guard: real users never
// fill it; bots that auto-fill every input are silently dropped (no DB write).
export function ConsultationForm() {
  const { lang } = useLanguage();
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", message: "" });
  const [trap, setTrap] = useState(""); // honeypot — must stay empty

  const L = lang === "bn"
    ? {
        name: "আপনার নাম", phone: "ফোন নম্বর", message: "আমরা কীভাবে সাহায্য করতে পারি?",
        placeholder: "সংক্ষেপে লিখুন আপনি কী জানতে চান...",
        submit: "বার্তা পাঠান",
        micro: "আমাদের কেয়ার কোঅর্ডিনেটর ২৪ ঘণ্টার মধ্যে আপনাকে কল করবেন। আপনার তথ্য সম্পূর্ণ গোপনীয়।",
        thanks: "ধন্যবাদ। আমাদের কেয়ার কোঅর্ডিনেটর ২৪ ঘণ্টার মধ্যে আপনার সাথে যোগাযোগ করবেন।",
      }
    : {
        name: "Your Name", phone: "Phone Number", message: "How can we help?",
        placeholder: "Briefly tell us what you'd like to know...",
        submit: "Send Message",
        micro: "Our care coordinator will call you within 24 hours. Your information is completely private.",
        thanks: "Thank you. Our care coordinator will reach out to you within 24 hours.",
      };

  if (sent) {
    return (
      <div className="card-soft p-8 text-center" style={{ background: "color-mix(in oklab, var(--color-supporting) 8%, white)" }}>
        <CheckCircle2 className="mx-auto mb-3 text-supporting" size={42} />
        <p className={`text-foreground font-medium ${lang === "bn" ? "font-bangla" : ""}`}>{L.thanks}</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        // Honeypot: a filled trap means a bot — pretend success, write nothing.
        if (trap) { setSent(true); return; }
        setSubmitting(true);
        setError(null);
        const { error } = await supabase.from("inquiries").insert({
          type: "contact",
          name: form.name,
          phone: form.phone,
          message: form.message || null,
          language: lang,
        });
        setSubmitting(false);
        if (error) setError(error.message);
        else setSent(true);
      }}
      className={`card-soft p-6 sm:p-8 space-y-4 ${lang === "bn" ? "font-bangla" : ""}`}
    >
      {/* Honeypot: visually hidden, off-screen, not tab-reachable. Leave empty. */}
      <input
        type="text" tabIndex={-1} autoComplete="off" value={trap}
        onChange={(e) => setTrap(e.target.value)}
        aria-hidden="true"
        style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
      />
      <Field label={L.name}>
        <input required type="text" className={inputCls} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
      </Field>
      <Field label={L.phone}>
        <input required type="tel" className={inputCls} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
      </Field>
      <Field label={L.message}>
        <textarea required rows={4} placeholder={L.placeholder} className={inputCls} value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} />
      </Field>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <button type="submit" disabled={submitting} className="btn-accent w-full sm:w-auto disabled:opacity-60">{L.submit}</button>
      <p className="text-xs italic text-muted-foreground">{L.micro}</p>
    </form>
  );
}

const inputCls = "w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20 transition";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-semibold text-foreground mb-1.5">{label}</span>
      {children}
    </label>
  );
}
