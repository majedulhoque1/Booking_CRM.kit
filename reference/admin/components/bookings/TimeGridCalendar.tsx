import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";

// ─── Public types ─────────────────────────────────────────────────────────────

export interface CalendarEvent {
  id: string;
  title: string;
  subtitle?: string;
  /** "YYYY-MM-DDTHH:MM" */
  scheduledAt: string;
  durationMins: number;
  status: string;
}

export type CalendarMode = "week" | "day" | "month";

export interface TimeGridCalendarProps {
  events: CalendarEvent[];
  mode: CalendarMode;
  /** Maps status string → tone key: "success" | "warning" | "danger" */
  statusToneMap?: Record<string, string>;
  onEmptySlotClick?: (date: Date) => void;
  onSelectEvent?: (event: CalendarEvent) => void;
  onReschedule?: (eventId: string, newDate: string, newTime: string) => void;
}

// ─── Internal constants ───────────────────────────────────────────────────────

const START_HOUR = 7;
const END_HOUR = 21; // exclusive — 7 AM → 8 PM
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => i + START_HOUR);
const ROW_H = 64; // px per hour

type ToneStyle = { bg: string; border: string; text: string };

const TONE_STYLES: Record<string, ToneStyle> = {
  success: { bg: "bg-emerald-50", border: "border-emerald-300", text: "text-emerald-800" },
  warning: { bg: "bg-amber-50",   border: "border-amber-300",   text: "text-amber-800"   },
  danger:  { bg: "bg-rose-50",    border: "border-rose-300",    text: "text-rose-800"    },
  default: { bg: "bg-sky-50",     border: "border-sky-300",     text: "text-sky-800"     },
};

const DAY_SHORT   = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"] as const;

// ─── Date helpers ─────────────────────────────────────────────────────────────

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const dow = d.getDay(); // 0 = Sun
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1)); // Mon
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function toDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toTimeStr(h: number, m: number): string {
  return `${String(h).padStart(2, "0")}:${String(Math.min(m, 59)).padStart(2, "0")}`;
}

function formatHour(h: number): string {
  if (h === 0 || h === 24) return "12 AM";
  if (h === 12) return "12 PM";
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/** Returns every day in the Mon-anchored grid that covers the full month. */
function getMonthDays(anchor: Date): Date[] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const last  = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  const start = startOfWeek(first);
  // Extend to the Sunday that ends the week containing the last day
  const endMon = startOfWeek(addDays(last, 6));
  const days: Date[] = [];
  for (let d = new Date(start); d <= endMon; d = addDays(d, 1)) {
    days.push(new Date(d));
  }
  return days;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TimeGridCalendar({
  events,
  mode,
  statusToneMap = {},
  onEmptySlotClick,
  onSelectEvent,
  onReschedule,
}: TimeGridCalendarProps) {
  const todayMidnight = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();

  const [anchor, setAnchor] = useState<Date>(() => {
    if (mode === "week")  return startOfWeek(todayMidnight);
    if (mode === "month") return startOfMonth(todayMidnight);
    return new Date(todayMidnight);
  });

  const scrollRef    = useRef<HTMLDivElement>(null);
  const draggingId   = useRef<string | null>(null);
  const draggingTime = useRef<string>("09:00"); // preserved for month-view drops

  // Adjust anchor when mode prop changes
  useEffect(() => {
    setAnchor((prev) => {
      if (mode === "week")  return startOfWeek(prev);
      if (mode === "month") return startOfMonth(prev);
      return prev;
    });
  }, [mode]);

  // Scroll to current-time area on first render
  useEffect(() => {
    if (!scrollRef.current) return;
    const now = new Date();
    const offset = (now.getHours() - START_HOUR - 1) * ROW_H;
    scrollRef.current.scrollTop = Math.max(0, offset);
  }, []);

  const todayStr = toDateStr(todayMidnight);

  const columns: Date[] =
    mode === "week"
      ? Array.from({ length: 7 }, (_, i) => addDays(anchor, i))
      : [anchor];

  function navigate(dir: -1 | 1) {
    setAnchor((prev) => {
      if (mode === "month") {
        return new Date(prev.getFullYear(), prev.getMonth() + dir, 1);
      }
      return addDays(prev, dir * (mode === "week" ? 7 : 1));
    });
  }

  function goToday() {
    if (mode === "month") { setAnchor(startOfMonth(todayMidnight)); return; }
    setAnchor(mode === "week" ? startOfWeek(todayMidnight) : new Date(todayMidnight));
  }

  function headerLabel(): string {
    if (mode === "month") {
      return anchor.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    }
    if (mode === "day") {
      return anchor.toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    }
    const end = addDays(anchor, 6);
    const s = `${anchor.getDate()} ${MONTH_SHORT[anchor.getMonth()]}`;
    const e = `${end.getDate()} ${MONTH_SHORT[end.getMonth()]} ${end.getFullYear()}`;
    return `${s} – ${e}`;
  }

  // Group events by date string for O(1) lookup per column
  const eventsByDate = new Map<string, CalendarEvent[]>();
  for (const ev of events) {
    const ds = ev.scheduledAt.slice(0, 10);
    if (!eventsByDate.has(ds)) eventsByDate.set(ds, []);
    eventsByDate.get(ds)!.push(ev);
  }

  function eventPosition(ev: CalendarEvent): { top: number; height: number } | null {
    const parts = (ev.scheduledAt.split("T")[1] ?? "00:00").split(":");
    const h = parseInt(parts[0] ?? "0", 10);
    const m = parseInt(parts[1] ?? "0", 10);
    if (h >= END_HOUR) return null;
    const endFrac = h + m / 60 + ev.durationMins / 60;
    if (endFrac <= START_HOUR) return null;
    const top    = Math.max(0, (h - START_HOUR + m / 60) * ROW_H);
    const height = Math.max((ev.durationMins / 60) * ROW_H - 2, 18);
    return { top, height };
  }

  function toneStyle(status: string): ToneStyle {
    const tone = statusToneMap[status];
    return TONE_STYLES[tone ?? "default"] ?? TONE_STYLES["default"]!;
  }

  function handleSlotClick(col: Date, hour: number, e: React.MouseEvent<HTMLDivElement>) {
    if (!onEmptySlotClick) return;
    const offsetY  = e.clientY - e.currentTarget.getBoundingClientRect().top;
    const minute   = Math.min(Math.floor((offsetY / ROW_H) * 60), 59);
    const d        = new Date(col);
    d.setHours(hour, minute, 0, 0);
    onEmptySlotClick(d);
  }

  function handleDrop(col: Date, hour: number, e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (!draggingId.current || !onReschedule) return;
    const offsetY = e.clientY - e.currentTarget.getBoundingClientRect().top;
    const raw     = Math.floor((offsetY / ROW_H) * 60);
    const minute  = Math.min(Math.round(raw / 15) * 15, 59); // snap to 15 min
    onReschedule(draggingId.current, toDateStr(col), toTimeStr(hour, minute));
    draggingId.current = null;
  }

  function handleMonthCellClick(cellDate: Date) {
    if (!onEmptySlotClick) return;
    const d = new Date(cellDate);
    d.setHours(9, 0, 0, 0);
    onEmptySlotClick(d);
  }

  function handleMonthDrop(cellDate: Date, e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (!draggingId.current || !onReschedule) return;
    // Preserve the original time so only the date changes
    onReschedule(draggingId.current, toDateStr(cellDate), draggingTime.current);
    draggingId.current = null;
  }

  // Current time indicator
  const now       = new Date();
  const nowTop    = (now.getHours() - START_HOUR + now.getMinutes() / 60) * ROW_H;
  const showNow   = now.getHours() >= START_HOUR && now.getHours() < END_HOUR;

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-card">

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <button
          type="button"
          onClick={goToday}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
        >
          Today
        </button>

        <button
          type="button"
          onClick={() => navigate(-1)}
          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <span className="flex-1 text-center text-sm font-semibold text-foreground">
          {headerLabel()}
        </span>

        <button
          type="button"
          onClick={() => navigate(1)}
          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* ── Month grid ── */}
      {mode === "month" && (() => {
        const monthDays  = getMonthDays(anchor);
        const currentMon = anchor.getMonth();
        const MAX_CHIPS  = 3;
        const DOW_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

        return (
          <div>
            {/* DOW header */}
            <div className="grid grid-cols-7 border-b border-border bg-background/50">
              {DOW_LABELS.map((d) => (
                <div key={d} className="py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {d}
                </div>
              ))}
            </div>

            {/* Cells */}
            <div className="grid grid-cols-7">
              {monthDays.map((cellDate, idx) => {
                const ds          = toDateStr(cellDate);
                const isThisMonth = cellDate.getMonth() === currentMon;
                const isToday     = ds === todayStr;
                const dayEvents   = eventsByDate.get(ds) ?? [];
                const visible     = dayEvents.slice(0, MAX_CHIPS);
                const overflow    = dayEvents.length - MAX_CHIPS;

                return (
                  <div
                    key={idx}
                    className={cn(
                      "min-h-[96px] border-b border-r border-border/40 p-1.5 cursor-pointer transition-colors hover:bg-background/60",
                      !isThisMonth && "bg-background/30",
                    )}
                    onClick={() => handleMonthCellClick(cellDate)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleMonthDrop(cellDate, e)}
                  >
                    {/* Day number */}
                    <span className={cn(
                      "mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                      isToday
                        ? "bg-accent text-white"
                        : isThisMonth
                          ? "text-foreground"
                          : "text-muted-foreground/40",
                    )}>
                      {cellDate.getDate()}
                    </span>

                    {/* Event chips */}
                    {visible.map((ev) => {
                      const ts = toneStyle(ev.status);
                      return (
                        <div
                          key={ev.id}
                          draggable
                          className={cn(
                            "mb-0.5 truncate rounded px-1 py-0.5 text-[10px] font-semibold leading-tight cursor-grab select-none border",
                            ts.bg, ts.border, ts.text,
                          )}
                          onDragStart={(e) => {
                            e.stopPropagation();
                            draggingId.current   = ev.id;
                            draggingTime.current = ev.scheduledAt.slice(11, 16);
                          }}
                          onDragEnd={() => { draggingId.current = null; }}
                          onClick={(e) => { e.stopPropagation(); onSelectEvent?.(ev); }}
                        >
                          {ev.title}
                        </div>
                      );
                    })}

                    {overflow > 0 && (
                      <p className="text-[10px] text-muted-foreground">+{overflow} more</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ── Week / Day grid ── */}
      {mode !== "month" && <div className="overflow-x-auto">
        <div style={{ minWidth: mode === "week" ? 620 : 280 }}>

          {/* Day headers */}
          <div className="flex border-b border-border bg-background/50">
            <div className="w-14 shrink-0" />
            {columns.map((col, i) => {
              const isToday = toDateStr(col) === todayStr;
              return (
                <div key={i} className="flex-1 py-2 text-center">
                  <p className={cn(
                    "text-[11px] font-semibold uppercase tracking-wide",
                    isToday ? "text-accent" : "text-muted-foreground",
                  )}>
                    {DAY_SHORT[col.getDay()]}
                  </p>
                  <div className={cn(
                    "mx-auto mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold",
                    isToday ? "bg-accent text-white" : "text-foreground",
                  )}>
                    {col.getDate()}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Scrollable body */}
          <div ref={scrollRef} className="overflow-y-auto" style={{ maxHeight: 560 }}>
            <div className="flex">

              {/* Time gutter */}
              <div className="w-14 shrink-0 select-none">
                {HOURS.map((h) => (
                  <div
                    key={h}
                    style={{ height: ROW_H }}
                    className="flex items-start justify-end pr-2 pt-1"
                  >
                    <span className="text-[10px] text-muted-foreground">{formatHour(h)}</span>
                  </div>
                ))}
              </div>

              {/* Day columns */}
              {columns.map((col, ci) => {
                const ds        = toDateStr(col);
                const dayEvents = eventsByDate.get(ds) ?? [];
                const isToday   = ds === todayStr;

                return (
                  <div
                    key={ci}
                    className={cn(
                      "relative flex-1 border-l border-border",
                      isToday && "bg-accent/[0.025]",
                    )}
                    style={{ height: HOURS.length * ROW_H }}
                  >
                    {/* Hour slot rows — clickable + drop targets */}
                    {HOURS.map((h) => (
                      <div
                        key={h}
                        style={{ height: ROW_H }}
                        className="border-b border-border/40 cursor-pointer transition-colors hover:bg-background/60"
                        onClick={(e) => handleSlotClick(col, h, e)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => handleDrop(col, h, e)}
                      />
                    ))}

                    {/* Current-time red line */}
                    {isToday && showNow && (
                      <div
                        className="pointer-events-none absolute inset-x-0 z-10 flex items-center"
                        style={{ top: nowTop }}
                      >
                        <div className="h-2 w-2 shrink-0 rounded-full bg-danger" />
                        <div className="h-px flex-1 bg-danger/70" />
                      </div>
                    )}

                    {/* Events */}
                    {dayEvents.map((ev) => {
                      const pos = eventPosition(ev);
                      if (!pos) return null;
                      const ts = toneStyle(ev.status);
                      return (
                        <div
                          key={ev.id}
                          draggable
                          style={{
                            position: "absolute",
                            top: pos.top,
                            height: pos.height,
                            left: 2,
                            right: 2,
                          }}
                          className={cn(
                            "z-20 cursor-grab overflow-hidden rounded-md border px-1.5 py-0.5 select-none",
                            ts.bg, ts.border, ts.text,
                          )}
                          onDragStart={() => { draggingId.current = ev.id; draggingTime.current = ev.scheduledAt.slice(11, 16); }}
                          onDragEnd={()   => { draggingId.current = null; }}
                          onClick={(e) => { e.stopPropagation(); onSelectEvent?.(ev); }}
                        >
                          <p className="truncate text-[11px] font-semibold leading-tight">{ev.title}</p>
                          {ev.subtitle && (
                            <p className="truncate text-[10px] leading-tight opacity-75">{ev.subtitle}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>}
    </div>
  );
}
