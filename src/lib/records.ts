import "server-only";
import { normalizeNumber } from "./money";
import type { SessionData } from "./session";
import { getClients, mapApiError, getSpreadsheetStructure } from "./sheets";

export type RecordInput = {
  fecha: string;
  tipo: string;
  categoria: string;
  subcategoria?: string;
  descripcion: string;
  importe: number;
  cuenta?: string;
  estado?: string;
};

export type Record = RecordInput & { row: number };

export { normalizeNumber };

export type StructureCheck = {
  tab: string | null;
  found: string[];
  missing: string[];
};

// Valida que un archivo tenga la estructura mínima que la app necesita:
// una pestaña de datos real con columnas de Fecha, Tipo e Importe.
// Si ninguna pestaña parece datos, el archivo NO es válido.
export function checkStructure(
  structure: { sheet: string; headers: string[]; samples: string[][] }[]
): StructureCheck {
  const isData = (s: { sheet: string; headers: string[] }) => {
    const hs = s.headers.map((h) => h.trim().toLowerCase());
    return (
      hs.some((h) => h.includes("fecha") || h.includes("date")) &&
      hs.some(
        (h) =>
          h.includes("tipo") ||
          h.includes("ingreso") ||
          h.includes("gasto") ||
          h.includes("importe") ||
          h.includes("monto") ||
          h.includes("precio")
      )
    );
  };
  const entry = structure.find(isData) ?? null;
  if (!entry) return { tab: null, found: [], missing: ["Fecha", "Tipo", "Importe"] };

  const map = buildColumnMap(entry.headers, true);
  const missing: string[] = [];
  if (map.fecha === undefined) missing.push("Fecha");
  if (map.tipo === undefined) missing.push("Tipo");
  if (map.importe === undefined) missing.push("Importe");
  const found = entry.headers.map((h) => h.trim()).filter(Boolean);
  return { tab: entry.sheet, found, missing };
}

// ============================================================
// Mapeo de columnas por encabezado: la hoja puede tener el orden
// clásico A–E o la plantilla CashView (8 columnas). Se detecta
// por nombre de columna; si no se reconoce, se cae al orden A–E.
// ============================================================

export type ColumnMap = {
  fecha?: number;
  tipo?: number;
  categoria?: number;
  subcategoria?: number;
  descripcion?: number;
  importe?: number;
  cuenta?: number;
  estado?: number;
  width: number;
};

const DEFAULT_MAP: ColumnMap = {
  fecha: 0,
  tipo: 1,
  categoria: 2,
  descripcion: 3,
  importe: 4,
  width: 5,
};

function classifyHeader(h: string): keyof Omit<ColumnMap, "width"> | undefined {
  const s = h.trim().toLowerCase();
  if (s.includes("fecha") || s.includes("date")) return "fecha";
  if (s.includes("tipo")) return "tipo";
  if (s.includes("subcategoria") || s.includes("subcategoría")) return "subcategoria";
  if (s.includes("categoria") || s.includes("categoría")) return "categoria";
  if (s.includes("descripcion") || s.includes("descripción") || s.includes("detalle") || s.includes("nota") || s.includes("concepto")) return "descripcion";
  if (s.includes("importe") || s.includes("monto") || s.includes("precio") || s.includes("cantidad") || s.includes("valor") || s.includes("dinero")) return "importe";
  if (s.includes("cuenta") || s.includes("medio") || s.includes("metodo") || s.includes("método")) return "cuenta";
  if (s.includes("estado") || s.includes("status") || s.includes("estado")) return "estado";
  return undefined;
}

export function buildColumnMap(headers: string[], strict = false): ColumnMap {
  const map: ColumnMap = { width: Math.max(headers.length, 5) };
  headers.forEach((h, i) => {
    const key = classifyHeader(h);
    if (key) map[key] = i;
  });
  if (!strict && (map.fecha === undefined || map.importe === undefined)) {
    return DEFAULT_MAP;
  }
  if (map.fecha !== undefined && map.importe !== undefined) {
    map.width = Math.max(
      map.width,
      ...Object.values(map).filter((v): v is number => typeof v === "number")
    );
  }
  return map;
}

function toRow(rec: RecordInput, map: ColumnMap): string[] {
  const row: string[] = new Array(map.width).fill("");
  if (map.fecha !== undefined) row[map.fecha] = rec.fecha;
  if (map.tipo !== undefined) row[map.tipo] = rec.tipo;
  if (map.categoria !== undefined) row[map.categoria] = rec.categoria;
  if (map.subcategoria !== undefined && rec.subcategoria) row[map.subcategoria] = rec.subcategoria;
  if (map.descripcion !== undefined) row[map.descripcion] = rec.descripcion;
  if (map.importe !== undefined) row[map.importe] = String(rec.importe);
  if (map.cuenta !== undefined && rec.cuenta) row[map.cuenta] = rec.cuenta;
  if (map.estado !== undefined && rec.estado) row[map.estado] = rec.estado;
  return row;
}

async function readHeaderRow(
  session: SessionData,
  spreadsheetId: string,
  tab: string
): Promise<{ map: ColumnMap; headers: string[] }> {
  const { sheets } = await getClients(session);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${tab}'!A1:H1`,
  });
  const headers = (res.data.values?.[0] ?? []) as string[];
  return { map: buildColumnMap(headers), headers };
}

// ============================================================
// Detección de la pestaña de datos
// ============================================================

export function detectDataTab(
  structure: { sheet: string; headers: string[]; samples: string[][] }[]
): string {
  const norm = (h: string) => h.trim().toLowerCase();
  const isData = (s: { sheet: string; headers: string[] }) => {
    const hs = s.headers.map(norm);
    return hs.some((h) => h.includes("fecha") || h.includes("date")) &&
      hs.some(
        (h) =>
          h.includes("tipo") ||
          h.includes("ingreso") ||
          h.includes("gasto") ||
          h.includes("importe") ||
          h.includes("monto") ||
          h.includes("precio")
      );
  };
  const data = structure.find(isData);
  if (data) return data.sheet;
  if (structure.length > 0) return structure[0].sheet;
  return "Movimientos";
}

export async function resolveDataTab(
  session: SessionData,
  spreadsheetId: string
): Promise<string> {
  if (session.spreadsheetTab) return session.spreadsheetTab;
  try {
    const structure = await getSpreadsheetStructure(session, spreadsheetId);
    return detectDataTab(structure);
  } catch {
    return "Movimientos";
  }
}

// ============================================================
// Lectura / escritura de registros
// ============================================================

// Interpreta fechas que pueden venir en ISO, dd/mm/aaaa o como número serial de Google.
export function toIsoDate(v: unknown): string | null {
  if (typeof v === "number" && Number.isFinite(v)) {
    const d = new Date(Date.UTC(1899, 11, 30) + v * 86400000);
    return d.toISOString().slice(0, 10);
  }
  const s = String(v ?? "").trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    let [a, b, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (y < 100) y += 2000;
    if (a > 12) [a, b] = [b, a];
    else if (b > 12) [a, b] = [b, a];
    const mm = String(a).padStart(2, "0");
    const dd = String(b).padStart(2, "0");
    return `${y}-${mm}-${dd}`;
  }
  return null;
}

export async function readRecords(
  session: SessionData,
  spreadsheetId: string,
  tab?: string,
  range?: { from?: string; to?: string }
): Promise<Record[]> {
  const sheet = tab || (await resolveDataTab(session, spreadsheetId));
  const { map } = await readHeaderRow(session, spreadsheetId, sheet);
  const { sheets } = await getClients(session);
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${sheet}'!A1:H1000`,
    });
    const rows = (res.data.values as string[][]) ?? [];
    const records: Record[] = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i] ?? [];
      const get = (idx?: number) => ((idx !== undefined && typeof r[idx] === "string" && r[idx].trim()) ? r[idx].trim() : "");
      const rec: Record = {
        row: i + 1,
        fecha: get(map.fecha),
        tipo: get(map.tipo),
        categoria: get(map.categoria),
        subcategoria: get(map.subcategoria) || undefined,
        descripcion: get(map.descripcion),
        importe: normalizeNumber(map.importe !== undefined ? r[map.importe] : 0),
        cuenta: get(map.cuenta) || undefined,
        estado: get(map.estado) || undefined,
      };
      if (rec.fecha || rec.tipo || rec.categoria || (map.importe !== undefined && (r[map.importe] ?? "") !== "") ) {
        if (range?.from || range?.to) {
          const iso = toIsoDate(rec.fecha);
          if (!iso) continue;
          if (range.from && iso < range.from) continue;
          if (range.to && iso > range.to) continue;
        }
        records.push(rec);
      }
    }
    return records;
  } catch (e) {
    throw mapApiError(e, "No se pudieron leer los registros.");
  }
}

export async function appendRecord(
  session: SessionData,
  spreadsheetId: string,
  tab: string,
  rec: RecordInput
): Promise<void> {
  const { sheets } = await getClients(session);
  try {
    const { map } = await readHeaderRow(session, spreadsheetId, tab);
    const colLetter = String.fromCharCode(65 + map.width - 1);
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `'${tab}'!A:${colLetter}`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [toRow(rec, map)] },
    });
  } catch (e) {
    throw mapApiError(e, "No se pudo agregar el registro.");
  }
}

export async function updateRecord(
  session: SessionData,
  spreadsheetId: string,
  tab: string,
  row: number,
  rec: RecordInput
): Promise<void> {
  const { sheets } = await getClients(session);
  try {
    const { map } = await readHeaderRow(session, spreadsheetId, tab);
    const colLetter = String.fromCharCode(65 + map.width - 1);
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${tab}'!A${row}:${colLetter}${row}`,
      valueInputOption: "RAW",
      requestBody: { values: [toRow(rec, map)] },
    });
  } catch (e) {
    throw mapApiError(e, "No se pudo modificar el registro.");
  }
}

export async function deleteRecord(
  session: SessionData,
  spreadsheetId: string,
  tab: string,
  row: number
): Promise<void> {
  const { sheets } = await getClients(session);
  try {
    const { map } = await readHeaderRow(session, spreadsheetId, tab);
    const colLetter = String.fromCharCode(65 + map.width - 1);
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `'${tab}'!A${row}:${colLetter}${row}`,
    });
  } catch (e) {
    throw mapApiError(e, "No se pudo eliminar el registro.");
  }
}