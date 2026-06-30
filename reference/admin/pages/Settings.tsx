import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useSettings } from "@/hooks/useSettings";

// Settings screen — edits public.site_settings (the runtime config the contract RPCs read).
// Plain controlled inputs (no form lib) to stay dependency-light. Theme tokens for styling.
const inputCls =
  "w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20 transition";

export function Settings() {
  const { settings, isLoading, update } = useSettings();
  const [timezone, setTimezone] = useState("");
  const [staffPhone, setStaffPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setTimezone(settings.timezone ?? "UTC");
      setStaffPhone(settings.notify_staff_phone ?? "");
    }
  }, [isLoading, settings.timezone, settings.notify_staff_phone]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    await update({ key: "timezone", value: timezone.trim() || "UTC" });
    await update({ key: "notify_staff_phone", value: staffPhone.trim() });
    setSaving(false);
    setSaved(true);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Runtime config the booking + analytics RPCs read." />

      {isLoading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">Loading settings…</div>
      ) : (
        <form onSubmit={onSave} className="max-w-md space-y-4 rounded-xl border border-border bg-surface p-5">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-foreground">Timezone (IANA)</span>
            <input className={inputCls} value={timezone} onChange={(e) => setTimezone(e.target.value)}
              placeholder="e.g. Asia/Dhaka" />
            <span className="mt-1 block text-xs text-muted-foreground">
              Used for slot math + analytics day-bucketing. Match the site's ANALYTICS_TZ.
            </span>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-foreground">Staff notify phone</span>
            <input className={inputCls} value={staffPhone} onChange={(e) => setStaffPhone(e.target.value)}
              placeholder="(empty = staff alerts off)" />
          </label>
          <div className="flex items-center gap-3">
            <button type="submit" disabled={saving} className="btn-accent disabled:opacity-60">
              {saving ? "Saving…" : "Save"}
            </button>
            {saved && <span className="text-sm text-supporting">Saved.</span>}
          </div>
        </form>
      )}
    </div>
  );
}
