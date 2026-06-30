// Pure helper: list slot start times ("HH:MM") in [start, end) stepping by minutes.
// Mirrors the SQL slot math in get_available_slots so the admin preview matches what
// the public site will offer. Generic — no client specifics.
export function generateDaySlots(start: string, end: string, slotMinutes: number): string[] {
  if (slotMinutes <= 0) return [];
  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const pad = (n: number) => String(n).padStart(2, "0");
  const s = toMin(start);
  const e = toMin(end);
  const out: string[] = [];
  for (let t = s; t + slotMinutes <= e; t += slotMinutes) {
    out.push(`${pad(Math.floor(t / 60))}:${pad(t % 60)}`);
  }
  return out;
}
