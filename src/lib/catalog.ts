import "server-only";
import { normalizeNumber } from "./money";
import type { SessionData } from "./session";
import { getClients, mapApiError, SheetsError } from "./sheets";

export type CategoriaRow = {
  tipo: string;
  categoria: string;
  subcategoria?: string;
  presupuesto?: number;
};

export type CuentaRow = {
  nombre: string;
  tipo?: string;
  saldo?: number;
};

export type Catalog = {
  categorias: CategoriaRow[];
  cuentas: CuentaRow[];
  foundCategorias: boolean;
  foundCuentas: boolean;
  titles: string[];
};

const HEADERS_CATEGORIAS = ["Tipo", "Categoría", "Subcategoría", "Presupuesto mensual"];
const HEADERS_CUENTAS = ["Nombre", "Tipo", "Saldo inicial"];

async function tabTitles(session: SessionData, spreadsheetId: string): Promise<string[]> {
  const { sheets } = await getClients(session);
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties(title)",
  });
  return (meta.data.sheets ?? [])
    .map((s) => s.properties?.title)
    .filter(Boolean) as string[];
}

async function readTab(
  session: SessionData,
  spreadsheetId: string,
  tab: string
): Promise<{ headers: string[]; rows: string[][] }> {
  const { sheets } = await getClients(session);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${tab}'!A1:ZZZ2000`,
  });
  const values = (res.data.values as string[][]) ?? [];
  return { headers: values[0] ?? [], rows: values.slice(1) };
}

function buildCatMap(headers: string[]) {
  const m = { tipo: -1, categoria: -1, subcategoria: -1, presupuesto: -1 };
  headers.forEach((h, i) => {
    const s = h.trim().toLowerCase();
    if (s.includes("tipo")) m.tipo = i;
    else if (s.includes("subcategor")) m.subcategoria = i;
    else if (s.includes("categor")) m.categoria = i;
    else if (s.includes("presupuest") || s.includes("monto")) m.presupuesto = i;
  });
  if (m.tipo === -1 || m.categoria === -1) {
    return { tipo: 0, categoria: 1, subcategoria: 2, presupuesto: 3 };
  }
  return m;
}

function buildAccountMap(headers: string[]) {
  let nombre = -1;
  let tipo = -1;
  let saldo = -1;
  headers.forEach((h, i) => {
    const s = h.trim().toLowerCase();
    if (s.includes("nombre") || s.includes("cuenta") || s.includes("medio")) nombre = i;
    else if (s.includes("saldo")) saldo = i;
    else if (s.includes("tipo")) tipo = i;
  });
  if (nombre === -1) return { nombre: 0, tipo: 1, saldo: 2 };
  if (tipo === -1) tipo = [0, 1, 2].find((i) => i !== nombre && i !== saldo) ?? 1;
  if (saldo === -1) saldo = [0, 1, 2].find((i) => i !== nombre && i !== tipo) ?? 2;
  return { nombre, tipo, saldo };
}

function colName(n: number): string {
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

async function writeTab(
  session: SessionData,
  spreadsheetId: string,
  tab: string,
  headers: string[],
  rows: (string | number)[][]
): Promise<void> {
  const { sheets } = await getClients(session);
  try {
    const current = await readTab(session, spreadsheetId, tab);
    const grid: string[][] = [headers.map(String)];
    for (const row of rows) {
      grid.push(row.map((c) => (c === undefined || c === null ? "" : String(c))));
    }
    const maxHeight = Math.max(current.rows.length + 1, grid.length, 1);
    const maxWidth = Math.max(
      current.headers.length,
      ...current.rows.map((r) => r.length),
      ...grid.map((r) => r.length),
      headers.length
    );
    const padded: string[][] = [];
    for (let i = 0; i < maxHeight; i++) {
      const src = i < grid.length ? grid[i] : [];
      const out = new Array(maxWidth).fill("");
      for (let j = 0; j < src.length; j++) out[j] = src[j];
      padded.push(out);
    }
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${tab}'!A1:${colName(maxWidth)}${maxHeight}`,
      valueInputOption: "RAW",
      requestBody: { values: padded },
    });
  } catch (e) {
    throw mapApiError(e, "No se pudo guardar en la hoja.");
  }
}

export async function readCategories(
  session: SessionData,
  spreadsheetId: string
): Promise<CategoriaRow[] | null> {
  try {
    const titles = await tabTitles(session, spreadsheetId);
    const tab = titles.find((t) => /categor/i.test(t));
    if (!tab) return null;
    const { headers, rows } = await readTab(session, spreadsheetId, tab);
    const m = buildCatMap(headers);
    const out: CategoriaRow[] = [];
    for (const r of rows) {
      const get = (idx: number) => (idx >= 0 && typeof r[idx] === "string" ? r[idx].trim() : "");
      const categoria = get(m.categoria);
      if (!categoria) continue;
      out.push({
        tipo: get(m.tipo),
        categoria,
        subcategoria: get(m.subcategoria) || undefined,
        presupuesto:
          m.presupuesto >= 0 && typeof r[m.presupuesto] === "string" && r[m.presupuesto].trim() !== ""
            ? normalizeNumber(r[m.presupuesto])
            : undefined,
      });
    }
    return out;
  } catch (e) {
    throw mapApiError(e, "No se pudieron leer las categorías.");
  }
}

export async function readAccounts(
  session: SessionData,
  spreadsheetId: string
): Promise<CuentaRow[] | null> {
  try {
    const titles = await tabTitles(session, spreadsheetId);
    const tab = titles.find((t) => /cuentas?/i.test(t));
    if (!tab) return null;
    const { headers, rows } = await readTab(session, spreadsheetId, tab);
    const m = buildAccountMap(headers);
    const out: CuentaRow[] = [];
    for (const r of rows) {
      const get = (idx: number) => (idx >= 0 && typeof r[idx] === "string" ? r[idx].trim() : "");
      const nombre = get(m.nombre);
      if (!nombre) continue;
      out.push({
        nombre,
        tipo: get(m.tipo) || undefined,
        saldo:
          m.saldo >= 0 && typeof r[m.saldo] === "string" && r[m.saldo].trim() !== ""
            ? normalizeNumber(r[m.saldo])
            : undefined,
      });
    }
    return out;
  } catch (e) {
    throw mapApiError(e, "No se pudieron leer las cuentas.");
  }
}

export async function saveCategories(
  session: SessionData,
  spreadsheetId: string,
  rows: CategoriaRow[]
): Promise<void> {
  try {
    const titles = await tabTitles(session, spreadsheetId);
    const tab = titles.find((t) => /categor/i.test(t));
    if (!tab) {
      throw new SheetsError("No se encontró la pestaña 'Categorías' en tu hoja.", 400);
    }
    const clean = rows
      .map((r) => ({
        tipo: /ingr/i.test(r.tipo ?? "") ? "Ingreso" : "Gasto",
        categoria: (r.categoria ?? "").trim(),
        subcategoria: (r.subcategoria ?? "").trim() || undefined,
        presupuesto:
          typeof r.presupuesto === "number" && Number.isFinite(r.presupuesto) && r.presupuesto !== 0
            ? r.presupuesto
            : undefined,
      }))
      .filter((r) => r.categoria);
    const data = clean.map((r) => [
      r.tipo,
      r.categoria,
      r.subcategoria ?? "",
      r.presupuesto ?? "",
    ]);
    await writeTab(session, spreadsheetId, tab, HEADERS_CATEGORIAS, data);
  } catch (e) {
    if (e instanceof SheetsError) throw e;
    throw mapApiError(e, "No se pudieron guardar las categorías.");
  }
}

export async function saveAccounts(
  session: SessionData,
  spreadsheetId: string,
  rows: CuentaRow[]
): Promise<void> {
  try {
    const titles = await tabTitles(session, spreadsheetId);
    const tab = titles.find((t) => /cuentas?/i.test(t));
    if (!tab) {
      throw new SheetsError("No se encontró la pestaña 'Cuentas' en tu hoja.", 400);
    }
    const clean = rows
      .map((r) => ({
        nombre: (r.nombre ?? "").trim(),
        tipo: (r.tipo ?? "").trim() || undefined,
        saldo: typeof r.saldo === "number" && Number.isFinite(r.saldo) ? r.saldo : undefined,
      }))
      .filter((r) => r.nombre);
    const data = clean.map((r) => [r.nombre, r.tipo ?? "", r.saldo ?? ""]);
    await writeTab(session, spreadsheetId, tab, HEADERS_CUENTAS, data);
  } catch (e) {
    if (e instanceof SheetsError) throw e;
    throw mapApiError(e, "No se pudieron guardar las cuentas.");
  }
}

export async function readCatalog(session: SessionData, spreadsheetId: string): Promise<Catalog> {
  const titulos = await tabTitles(session, spreadsheetId);
  const categorias = titulos.find((t) => /categor/i.test(t));
  const cuentas = titulos.find((t) => /cuentas?/i.test(t));
  const [cats, accs] = await Promise.all([
    categorias ? readCategories(session, spreadsheetId) : Promise.resolve(null),
    cuentas ? readAccounts(session, spreadsheetId) : Promise.resolve(null),
  ]);
  return {
    categorias: cats ?? [],
    cuentas: accs ?? [],
    foundCategorias: Boolean(categorias),
    foundCuentas: Boolean(cuentas),
    titles: titulos,
  };
}