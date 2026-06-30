import { PageHeader } from "@/components/PageHeader";
import { StatusBadge, type StatusTone } from "@/components/StatusBadge";
import { useSubmissions, type Submission, type SubmissionStatus } from "@/hooks/useSubmissions";
import { CheckCircle2, MessageCircle, Trash2, UserPlus } from "lucide-react";

// Submissions = inbound inquiries (contract `inquiries`). Plain table to avoid a DataTable
// dependency. Statuses: new -> contacted -> closed.
const TONE: Record<SubmissionStatus, StatusTone> = { new: "blue", contacted: "yellow", closed: "gray" };
const digits = (p: string) => p.replace(/[^\d]/g, "");

export function Submissions() {
  const { submissions, isLoading, setStatus, remove, convertToContact } = useSubmissions();

  async function onConvert(s: Submission) {
    if (s.status === "closed") return;
    if (confirm(`Add "${s.name}" to the CRM as a contact (and close this inquiry)?`)) await convertToContact(s);
  }
  async function onDelete(s: Submission) {
    if (confirm(`Delete the inquiry from "${s.name}"? This cannot be undone.`)) await remove(s.id);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Submissions" description="Incoming inquiries from the website. Review, contact, then add to CRM." />

      {isLoading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">Loading submissions…</div>
      ) : submissions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
          No submissions yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Phone</th>
                <th className="px-4 py-3 font-semibold">Message</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Date</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {submissions.map((r) => (
                <tr key={r.id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3 font-medium text-foreground">{r.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.type}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.phone ?? "—"}</td>
                  <td className="max-w-[240px] truncate px-4 py-3 text-muted-foreground" title={r.message ?? ""}>
                    {r.message ?? "—"}
                  </td>
                  <td className="px-4 py-3"><StatusBadge label={r.status} tone={TONE[r.status]} /></td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {r.phone && (
                        <a href={`https://wa.me/${digits(r.phone)}`} target="_blank" rel="noopener noreferrer"
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-background hover:text-emerald-600"
                          aria-label="WhatsApp" title="Message on WhatsApp"><MessageCircle className="h-3.5 w-3.5" /></a>
                      )}
                      {r.status === "new" && (
                        <button type="button" onClick={() => setStatus({ id: r.id, status: "contacted" })}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-background hover:text-amber-600"
                          aria-label="Mark contacted" title="Mark as contacted"><CheckCircle2 className="h-3.5 w-3.5" /></button>
                      )}
                      <button type="button" onClick={() => onConvert(r)} disabled={r.status === "closed"}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-background hover:text-accent disabled:opacity-30"
                        aria-label="Add to CRM" title={r.status === "closed" ? "Closed" : "Add to CRM"}><UserPlus className="h-3.5 w-3.5" /></button>
                      <button type="button" onClick={() => onDelete(r)}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-background hover:text-danger"
                        aria-label="Delete" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
