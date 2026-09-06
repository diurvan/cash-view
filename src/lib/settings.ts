// Ajustes por usuario. Se guardan dentro del propio archivo .cvw, así que
// viajan con la copia de seguridad de Google Drive y se respetan al abrir
// el archivo en otro dispositivo.
import { getAjuste, setAjuste } from "./local-db";
import { CURRENCIES, DEFAULT_MONEDA } from "./money";

export type AppSettings = {
  moneda: string;
  formatoFecha: "dd/mm/aaaa" | "aaaa-mm-dd";
};

export const FORMATOS_FECHA: { value: AppSettings["formatoFecha"]; label: string }[] = [
  { value: "dd/mm/aaaa", label: "Día/mes/año · 06/09/2026" },
  { value: "aaaa-mm-dd", label: "Año-mes-día · 2026-09-06" },
];

export const DEFAULT_SETTINGS: AppSettings = {
  moneda: DEFAULT_MONEDA,
  formatoFecha: "dd/mm/aaaa",
};

export async function getSettings(): Promise<AppSettings> {
  const [moneda, formatoFecha] = await Promise.all([getAjuste("moneda"), getAjuste("formatoFecha")]);
  const cur = moneda && CURRENCIES.some((c) => c.code === moneda) ? moneda : DEFAULT_SETTINGS.moneda;
  const ff = formatoFecha === "aaaa-mm-dd" ? "aaaa-mm-dd" : "dd/mm/aaaa";
  return { moneda: cur, formatoFecha: ff };
}

export async function saveSettings(patch: Partial<AppSettings>): Promise<void> {
  if (patch.moneda) await setAjuste("moneda", patch.moneda);
  if (patch.formatoFecha) await setAjuste("formatoFecha", patch.formatoFecha);
}

// "2026-09-06" -> "06/09/2026" o se deja en ISO según preferencia.
export function formatFecha(iso: string, formato: AppSettings["formatoFecha"]): string {
  if (!iso) return "";
  if (formato === "aaaa-mm-dd" || iso.length < 10) return iso;
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}