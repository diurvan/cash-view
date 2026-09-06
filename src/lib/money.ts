// Helpers puros de dinero (seguros de usar en el cliente).

// Monedas configurables por usuario (guardadas en el .cvw).
export const CURRENCIES: { code: string; label: string }[] = [
  { code: "PEN", label: "Sol peruano (PEN · S/)" },
  { code: "USD", label: "Dólar estadounidense (USD · US$)" },
  { code: "EUR", label: "Euro (EUR · €)" },
  { code: "MXN", label: "Peso mexicano (MXN · $)" },
  { code: "CLP", label: "Peso chileno (CLP · $)" },
  { code: "COP", label: "Peso colombiano (COP · $)" },
  { code: "ARS", label: "Peso argentino (ARS · $)" },
  { code: "BRL", label: "Real brasileño (BRL · R$)" },
];

const CURRENCY_LOCALE: Record<string, string> = {
  PEN: "es-PE",
  USD: "en-US",
  EUR: "es-ES",
  MXN: "es-MX",
  CLP: "es-CL",
  COP: "es-CO",
  ARS: "es-AR",
  BRL: "pt-BR",
};

export const DEFAULT_MONEDA = process.env.NEXT_PUBLIC_CURRENCY || "PEN";

export function currencyLabel(code: string): string {
  return CURRENCIES.find((c) => c.code === code)?.label ?? code;
}

const formatterCache = new Map<string, Intl.NumberFormat>();

// Formatea con la moneda elegida (por defecto PEN, formato es-PE: S/ 1.250,50).
export function formatMoney(n: number, moneda: string = DEFAULT_MONEDA): string {
  const code = /^\d{3}$/.test(moneda) && CURRENCY_LOCALE[moneda] ? moneda : DEFAULT_MONEDA;
  let f = formatterCache.get(code);
  if (!f) {
    f = new Intl.NumberFormat(CURRENCY_LOCALE[code] ?? "es", {
      style: "currency",
      currency: code,
      maximumFractionDigits: 2,
    });
    formatterCache.set(code, f);
  }
  return f.format(n);
}

// Muestra un número listo para editar en un input: 1250.5 -> "1250,50".
// Se eliminan los separadores de miles para que el usuario escriba sin conflicto.
export function formatInputNumber(n: number): string {
  if (!Number.isFinite(n)) return "";
  const [int, frac] = Math.abs(n).toFixed(2).split(".");
  const digits = String(parseInt(int, 10) || 0);
  return `${n < 0 ? "-" : ""}${digits},${frac}`;
}

// Parsea lo que escribe el usuario sin importar el separador usado (Perú:
// coma decimal y punto para miles, p. ej. "1.250,50"). Acepta también
// formato internacional "1,250.50" y enteros sin separadores ("1250").
export function parseMoney(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const raw = String(v ?? "").trim();
  if (!raw) return 0;
  const m = raw.match(/[+\-]?\d[\d.,]*/);
  let s = (m ? m[0] : "").trim();
  if (!s) return 0;
  let sign = 1;
  if (s.startsWith("-") || s.startsWith("+")) {
    if (s[0] === "-") sign = -1;
    s = s.slice(1);
  }
  const hasDot = s.includes(".");
  const hasComma = s.includes(",");
  let cleaned: string;
  if (hasDot && hasComma) {
    // el último separador es el decimal ("1.250,50" o "1,250.50")
    const decIdx = Math.max(s.lastIndexOf("."), s.lastIndexOf(","));
    const decSep = s[decIdx];
    const other = decSep === "." ? "," : ".";
    cleaned = s.split(other).join("").replace(decSep, ".");
  } else if (hasComma) {
    const idx = s.lastIndexOf(",");
    const frac = s.length - idx - 1;
    // "12,50" -> 12.5 (decimal); "1,250" -> 1250 (miles)
    cleaned = frac === 3 ? s.split(",").join("") : s.replace(",", ".");
  } else if (hasDot) {
    const idx = s.lastIndexOf(".");
    const frac = s.length - idx - 1;
    // "12.50" -> 12.5 (decimal); "12.500" -> 12500 (miles)
    cleaned = frac === 3 ? s.split(".").join("") : s;
  } else {
    cleaned = s;
  }
  if (!cleaned) return 0;
  const n = parseFloat(cleaned);
  return Number.isNaN(n) ? 0 : sign * n;
}