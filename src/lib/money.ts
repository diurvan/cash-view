// Helpers puros de dinero (seguros de usar en el cliente).
export function normalizeNumber(v: unknown): number {
  if (typeof v === "number") return v;
  const s = String(v ?? "").trim();
  if (!s) return 0;
  let n = parseFloat(s.replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", "."));
  if (Number.isNaN(n)) {
    n = parseFloat(s.replace(/[^\d.-]/g, ""));
  }
  return Number.isNaN(n) ? 0 : n;
}