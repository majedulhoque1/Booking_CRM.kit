import { PageHeader } from "@/components/PageHeader";
import { StatusBadge, type StatusTone } from "@/components/StatusBadge";
import { useBookings, type BookingStatus } from "@/hooks/useBookings";
import { Check, X, CalendarClock } from "lucide-react";

// Bookings management (contract `bookings` + reschedule_booking RPC). Confirm/cancel flips
// status (firing the notification trigger); reschedule calls the admin-only RPC and surfaces
// its tagged result. Dependency-light list view.
const TONE: Record<BookingStatus, StatusTone> = { pending: "yellow", confirmed: "green", cancelled: "gray" };

export function Bookings() {
  const { bookings, isLoading, setStatus, reschedule } = useBookings();

  async function onReschedule(id: string) {
    const date = prompt("New date (YYYY-MM-DD)?");
    if (!date) return;
    const time = prompt("New time (HH:MM)?");
    if (!time) return;
    const res = await reschedule({ id, date, time });
    if (res.status !== "ok") alert(`Could not reschedule: ${res.status}`);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Bookings" description="Confirm, cancel, or reschedule consultation bookings." />

      {isLoading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">Loading bookings…</div>
      ) : bookings.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
          No bookings yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Time</th>
                <th className="px-4 py-3 font-semibold">Contact</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3 text-foreground">
                    {new Date(`${b.date}T00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{b.time.slice(0, 5)}</td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-foreground">{b.contact?.name ?? "—"}</span>
                    {b.contact?.phone && <span className="ml-2 text-xs text-muted-foreground">{b.contact.phone}</span>}
                  </td>
                  <td className="px-4 py-3"><StatusBadge label={b.status} tone={TONE[b.status]} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {b.status !== "confirmed" && (
                        <button type="button" onClick={() => setStatus({ id: b.id, status: "confirmed" })}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-background hover:text-green-600"
                          aria-label="Confirm" title="Confirm"><Check className="h-3.5 w-3.5" /></button>
                      )}
                      {b.status !== "cancelled" && (
                        <button type="button" onClick={() => setStatus({ id: b.id, status: "cancelled" })}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-background hover:text-danger"
                          aria-label="Cancel" title="Cancel"><X className="h-3.5 w-3.5" /></button>
                      )}
                      <button type="button" onClick={() => onReschedule(b.id)}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-background hover:text-accent"
                        aria-label="Reschedule" title="Reschedule"><CalendarClock className="h-3.5 w-3.5" /></button>
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
