import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useContacts, type Contact } from "@/hooks/useContacts";
import { Save } from "lucide-react";

// Minimal CRM (contract `contacts`): list leads, edit the single `notes` field inline.
// Intake fields live in `details` jsonb and are shown read-only. Dependency-light.
function NotesEditor({ contact, onSave }: { contact: Contact; onSave: (notes: string) => Promise<void> }) {
  const [notes, setNotes] = useState(contact.notes ?? "");
  const [saving, setSaving] = useState(false);
  const dirty = notes !== (contact.notes ?? "");
  return (
    <div className="flex items-start gap-2">
      <textarea
        rows={2}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Add a note…"
        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20"
      />
      <button
        type="button"
        disabled={!dirty || saving}
        onClick={async () => { setSaving(true); await onSave(notes); setSaving(false); }}
        className="mt-0.5 rounded-md p-2 text-muted-foreground hover:bg-surface hover:text-accent disabled:opacity-30"
        aria-label="Save note" title="Save note"
      >
        <Save className="h-4 w-4" />
      </button>
    </div>
  );
}

export function CRM() {
  const { contacts, isLoading, saveNotes } = useContacts();

  return (
    <div className="space-y-6">
      <PageHeader title="CRM" description="Leads captured from bookings and inquiries. Add private notes." />

      {isLoading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">Loading contacts…</div>
      ) : contacts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
          No contacts yet.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {contacts.map((c) => (
            <div key={c.id} className="space-y-3 rounded-xl border border-border bg-surface p-4 shadow-card">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-semibold text-foreground">{c.name}</h3>
                <span className="text-xs text-muted-foreground">
                  {new Date(c.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                </span>
              </div>
              <ul className="space-y-0.5 text-sm text-muted-foreground">
                {c.phone && <li>📞 {c.phone}</li>}
                {c.email && <li>✉️ {c.email}</li>}
                {c.branch && <li>📍 {c.branch}</li>}
                {Object.entries(c.details ?? {}).map(([k, v]) => (
                  <li key={k} className="text-xs">{k}: {String(v)}</li>
                ))}
              </ul>
              <NotesEditor contact={c} onSave={(notes) => saveNotes({ id: c.id, notes })} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
