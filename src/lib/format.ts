export function todayIso(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function monthKey(fecha: string): string {
  return (fecha ?? "").slice(0, 7);
}

export function monthLabel(key: string): string {
  if (!key) return "";
  const d = new Date(`${key}-01T00:00:00`);
  const s = d.toLocaleDateString("es", { month: "short" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function iso(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function thisMonthRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { from: iso(from), to: iso(to) };
}

export function lastNDaysRange(n: number): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (n - 1));
  return { from: iso(from), to: todayIso() };
}

export function thisYearRange(): { from: string; to: string } {
  const now = new Date();
  return { from: `${now.getFullYear()}-01-01`, to: todayIso() };
}

export function fmtRange(from: string, to: string): string {
  const a = new Date(`${from}T00:00:00`);
  const b = new Date(`${to}T00:00:00`);
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  const sa = a.toLocaleDateString("es", opts);
  if (a.getFullYear() !== b.getFullYear()) {
    return `${sa} ${a.getFullYear()} – ${b.toLocaleDateString("es", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })}`;
  }
  return `${sa} – ${b.toLocaleDateString("es", opts)} ${b.getFullYear()}`;
}