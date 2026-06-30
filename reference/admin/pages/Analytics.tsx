import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useAnalytics } from "@/hooks/useAnalytics";

// Analytics dashboard (contract 0006 — the 5 analytics_* RPCs). Dependency-light: summary
// tiles + simple tables + CSS bars. Swap the bars for recharts if you want richer charts; the
// data shape (useAnalytics) stays the same.
function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
const today = () => new Date().toISOString().slice(0, 10);

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}

export function Analytics() {
  const [from, setFrom] = useState(isoDaysAgo(29));
  const [to, setTo] = useState(today());
  const { data, isLoading } = useAnalytics({ from, to });

  const totalViews = (data?.traffic ?? []).reduce((s, d) => s + Number(d.pageviews), 0);
  const totalVisitors = (data?.traffic ?? []).reduce((s, d) => s + Number(d.unique_visitors), 0);
  const conv = data?.conversions ?? null;
  const maxPage = Math.max(1, ...(data?.topPages ?? []).map((p) => Number(p.pageviews)));

  const inputCls = "rounded-lg border border-input bg-background px-3 py-1.5 text-sm text-foreground";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="First-party traffic + conversions. Admin-only (read via SECURITY-DEFINER RPCs)."
        actions={
          <div className="flex items-center gap-2">
            <input type="date" className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} />
            <span className="text-muted-foreground">→</span>
            <input type="date" className={inputCls} value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        }
      />

      {isLoading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">Loading analytics…</div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Pageviews" value={totalViews} />
            <Stat label="Unique visitors" value={totalVisitors} />
            <Stat label="Booking-page views" value={conv?.book_consultation_views ?? 0} />
            <Stat label="Contact-page views" value={conv?.contact_views ?? 0} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Top pages */}
            <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
              <h3 className="mb-3 text-sm font-semibold text-foreground">Top pages</h3>
              <ul className="space-y-2">
                {(data?.topPages ?? []).slice(0, 10).map((p) => (
                  <li key={p.path}>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span className="truncate">{p.path}</span><span>{p.pageviews}</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-background">
                      <div className="h-1.5 rounded-full bg-secondary" style={{ width: `${(Number(p.pageviews) / maxPage) * 100}%` }} />
                    </div>
                  </li>
                ))}
                {(data?.topPages ?? []).length === 0 && <li className="text-sm text-muted-foreground">No data.</li>}
              </ul>
            </div>

            {/* Sources + countries */}
            <div className="space-y-6">
              <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
                <h3 className="mb-3 text-sm font-semibold text-foreground">Sources</h3>
                <ul className="space-y-1 text-sm">
                  {(data?.sources ?? []).slice(0, 8).map((s, i) => (
                    <li key={i} className="flex justify-between text-muted-foreground">
                      <span>{s.source}{s.referrer_host ? ` · ${s.referrer_host}` : ""}</span><span>{s.pageviews}</span>
                    </li>
                  ))}
                  {(data?.sources ?? []).length === 0 && <li className="text-muted-foreground">No data.</li>}
                </ul>
              </div>
              <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
                <h3 className="mb-3 text-sm font-semibold text-foreground">Countries</h3>
                <ul className="space-y-1 text-sm">
                  {(data?.countries ?? []).slice(0, 8).map((c) => (
                    <li key={c.country} className="flex justify-between text-muted-foreground">
                      <span>{c.country}</span><span>{c.pageviews}</span>
                    </li>
                  ))}
                  {(data?.countries ?? []).length === 0 && <li className="text-muted-foreground">No data.</li>}
                </ul>
              </div>
            </div>
          </div>

          {/* Conversions */}
          {conv && (
            <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
              <h3 className="mb-3 text-sm font-semibold text-foreground">Conversions</h3>
              <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                <div><p className="text-muted-foreground">Consultation inquiries</p><p className="text-lg font-semibold text-foreground">{conv.consultation_submissions}</p></div>
                <div><p className="text-muted-foreground">Contact inquiries</p><p className="text-lg font-semibold text-foreground">{conv.contact_submissions}</p></div>
                {Object.entries(conv.bookings_by_status ?? {}).map(([st, n]) => (
                  <div key={st}><p className="capitalize text-muted-foreground">{st} bookings</p><p className="text-lg font-semibold text-foreground">{n}</p></div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
