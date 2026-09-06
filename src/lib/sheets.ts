import "server-only";
import { google, sheets_v4 } from "googleapis";
import type { SessionData } from "./session";
import { googleConfig } from "./google";
import {
  templateSheets,
  templateCategoryRows,
  templateAccountsRows,
  templateExampleRow,
  templateSpreadsheetName,
  categoriasGasto,
  categoriasIngreso,
  tipos,
  subcategorias,
  metaMedios,
  estados,
} from "./template";

export class SheetsError extends Error {
  constructor(
    message: string,
    public status: number = 500,
    public probe?: string
  ) {
    super(message);
  }
}

type GridRequest = sheets_v4.Schema$Request;

export type GoogleApiErrorBody = {
  error?: { message?: string; errors?: { message?: string }[] };
};

// Convierte errores de la API de Google en SheetsError con mensaje legible.
export function mapApiError(e: unknown, fallback: string): SheetsError {
  const err = e as {
    status?: number;
    response?: { data?: GoogleApiErrorBody; error?: GoogleApiErrorBody };
    message?: string;
  };
  const status = err?.status ?? 500;
  const body = err?.response?.data ?? err?.response?.error;
  const detail = body?.error?.errors?.[0]?.message ?? body?.error?.message;
  if (status === 401) {
    return new SheetsError("Sesión con Google expirada. Vuelve a conectarte.", 401);
  }
  if (status === 403) {
    const full = (body ?? err) as {
      error?: { reason?: string; errors?: { reason?: string }[]; message?: string; status?: string };
    };
    const reason = full.error?.errors?.[0]?.reason ?? full.error?.reason;
    if (reason === "accessNotConfigured") {
      return new SheetsError(
        "La API de Google Sheets está desactivada en tu proyecto de Google Cloud. Actívala y espera unos minutos.",
        403,
        "https://console.developers.google.com/apis/api/sheets.googleapis.com/overview"
      );
    }
    console.error("Google 403:", JSON.stringify(full).slice(0, 1000));
    return new SheetsError(
      detail ? `Sin permiso. Google dice: ${detail}.` : "No tienes permiso para acceder a esa hoja.",
      403
    );
  }
  if (status === 404) {
    return new SheetsError("La hoja no existe o no tienes acceso a ella.", 404);
  }
  return new SheetsError(detail ?? err.message ?? fallback, status);
}

// Consulta a Google qué alcances (scopes) tiene realmente el token de la sesión.
export async function tokenScopes(session: SessionData): Promise<string | undefined> {
  try {
    const res = await fetch("https://oauth2.googleapis.com/tokeninfo", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `access_token=${encodeURIComponent(session.accessToken)}`,
    });
    if (!res.ok) return undefined;
    const data = (await res.json()) as { scope?: string };
    return data.scope;
  } catch {
    return undefined;
  }
}

async function buildAuth(session: SessionData) {
  if (!session.accessToken) {
    throw new SheetsError("Sin acceso a Google. Vuelve a conectarte.", 401);
  }
  const { clientId, clientSecret, redirectUri } = googleConfig();
  const oauth = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  oauth.setCredentials({
    access_token: session.accessToken,
    refresh_token: session.refreshToken || undefined,
  });
  return oauth;
}

export async function getClients(session: SessionData) {
  const auth = await buildAuth(session);
  await auth.getAccessToken().catch(() => {
    throw new SheetsError("Sesión con Google expirada. Vuelve a conectarte.", 401);
  });
  const sheets = google.sheets({ version: "v4", auth });
  const drive = google.drive({ version: "v3", auth });
  return { sheets, drive, auth };
}

export type SpreadsheetInfo = {
  id: string;
  name: string;
  url: string;
  modifiedTime?: string | null;
};

export type CreatedSpreadsheet = SpreadsheetInfo & { sheets: string[] };

export async function listSpreadsheets(session: SessionData): Promise<SpreadsheetInfo[]> {
  const { drive } = await getClients(session);
  try {
    const res = await drive.files.list({
      q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
      fields: "files(id,name,modifiedTime)",
      orderBy: "modifiedTime desc",
      pageSize: 100,
    });
    return (res.data.files ?? []).map((f) => ({
      id: f.id!,
      name: f.name ?? "Sin nombre",
      url: `https://docs.google.com/spreadsheets/d/${f.id}/edit`,
      modifiedTime: f.modifiedTime ?? null,
    }));
  } catch (e) {
    throw mapApiError(e, "No se pudieron listar tus hojas de cálculo.");
  }
}

export async function getSpreadsheetOwner(
  session: SessionData,
  spreadsheetId: string
): Promise<{ owner?: string; user?: string }> {
  const { drive } = await getClients(session);
  try {
    const res = await drive.files.get({
      fileId: spreadsheetId,
      fields: "owners(emailAddress),drives",
      supportsAllDrives: true,
    });
    return { owner: res.data.owners?.[0]?.emailAddress ?? undefined };
  } catch {
    return {};
  }
}

export async function getSpreadsheet(
  session: SessionData,
  spreadsheetId: string
): Promise<SpreadsheetInfo> {
  const { sheets } = await getClients(session);
  try {
    const res = await sheets.spreadsheets.get({ spreadsheetId, fields: "properties" });
    const name = res.data.properties?.title ?? "Sin nombre";
    return {
      id: spreadsheetId,
      name,
      url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    };
  } catch (e) {
    throw mapApiError(e, "No se pudo acceder a la hoja de cálculo.");
  }
}

export async function getSpreadsheetStructure(
  session: SessionData,
  spreadsheetId: string
): Promise<{ sheet: string; headers: string[]; samples: string[][] }[]> {
  const { sheets } = await getClients(session);
  try {
    const meta = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: "sheets.properties(sheetId,title,gridProperties)",
    });
    const tabTitles = (meta.data.sheets ?? []).map((s) => s.properties?.title).filter(Boolean) as string[];

    const out: { sheet: string; headers: string[]; samples: string[][] }[] = [];
    for (const title of tabTitles.slice(0, 10)) {
      try {
        const res = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${title}!A1:H20`,
        });
        const rows = (res.data.values as string[][]) ?? [];
        const headers = rows[0] ?? [];
        const samples = rows.slice(1, 6);
        out.push({ sheet: title, headers, samples });
      } catch {
        // hojas que no se pueden leer: se omiten en el análisis
      }
    }
    return out;
  } catch (e) {
    throw mapApiError(e, "No se pudo analizar la hoja de cálculo.");
  }
}

export async function createSpreadsheetFromTemplate(
  session: SessionData,
  title?: string
): Promise<CreatedSpreadsheet> {
  const { sheets } = await getClients(session);
  const spreadsheetName = title || templateSpreadsheetName;

  let spreadsheetId!: string;
  try {
    const res = await sheets.spreadsheets.create({
      requestBody: {
        properties: { title: spreadsheetName },
        sheets: templateSheets.map((def) => ({ properties: { title: def.title } })),
      },
    });
    spreadsheetId = res.data.spreadsheetId!;
  } catch (e) {
    throw mapApiError(e, "No se pudo crear la hoja de cálculo.");
  }

  // Google asigna sheetId arbitrarios (no 0,1,2): leer los ids reales por título.
  const idByTitle: Record<string, number> = {};
  try {
    const meta = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: "sheets.properties(sheetId,title)",
    });
    for (const s of meta.data.sheets ?? []) {
      const sid = s.properties?.sheetId;
      if (typeof sid === "number" && s.properties?.title) {
        idByTitle[s.properties.title] = sid;
      }
    }
  } catch (e) {
    throw mapApiError(e, "No se pudo configurar la plantilla.");
  }
  const sheetIdOf = (title: string): number | undefined => idByTitle[title];
  const movSheetId = sheetIdOf(templateSheets[0].title);
  const catsSheetId = sheetIdOf("Categorías");
  const accountsSheetId = sheetIdOf("Cuentas");
  const requiredSheetId = (title: string, id?: number): number => {
    if (id === undefined) throw new SheetsError(`Pestaña "${title}" no encontrada al configurar la plantilla.`, 500);
    return id;
  };

  const headerFormat = {
    userEnteredFormat: {
      textFormat: {
        bold: true,
        foregroundColor: { red: 0.043, green: 0.392, blue: 0.278 },
      },
      backgroundColorStyle: { rgbColor: { red: 0.906, green: 0.961, blue: 0.925 } },
    },
  };

  const requests: GridRequest[] = [];

  templateSheets.forEach((def) => {
    const sheetId = requiredSheetId(def.title, sheetIdOf(def.title));
    def.widths.forEach((w, col) => {
      requests.push({
        updateDimensionProperties: {
          range: { sheetId, dimension: "COLUMNS", startIndex: col, endIndex: col + 1 },
          properties: { pixelSize: w },
          fields: "pixelSize",
        },
      });
    });
    requests.push({
      pasteData: {
        coordinate: { sheetId, rowIndex: 0, columnIndex: 0 },
        data: def.headers.join("\t"),
        type: "PASTE_NORMAL",
        delimiter: "\t",
      },
    });
    requests.push({
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: 0,
          endColumnIndex: def.headers.length,
        },
        cell: headerFormat,
        fields: "userEnteredFormat(textFormat,backgroundColorStyle)",
      },
    });
  });

  // Filas de ejemplo y catálogos de las pestañas auxiliares.
  requests.push({
    pasteData: {
      coordinate: { sheetId: requiredSheetId("Movimientos", movSheetId), rowIndex: 1, columnIndex: 0 },
      data: templateExampleRow().join("\t"),
      type: "PASTE_NORMAL",
      delimiter: "\t",
    },
  });
  requests.push({
    pasteData: {
      coordinate: { sheetId: requiredSheetId("Categorías", catsSheetId), rowIndex: 1, columnIndex: 0 },
      data: templateCategoryRows().map((r) => r.join("\t")).join("\n"),
      type: "PASTE_NORMAL",
      delimiter: "\t",
    },
  });
  requests.push({
    pasteData: {
      coordinate: { sheetId: requiredSheetId("Cuentas", accountsSheetId), rowIndex: 1, columnIndex: 0 },
      data: templateAccountsRows().map((r) => r.join("\t")).join("\n"),
      type: "PASTE_NORMAL",
      delimiter: "\t",
    },
  });

  // Validaciones de datos en "Movimientos".
  const movId = requiredSheetId("Movimientos", movSheetId);
  const movRange = (startCol: number, endCol: number) => ({
    sheetId: movId,
    startRowIndex: 1,
    endRowIndex: 1001,
    startColumnIndex: startCol,
    endColumnIndex: endCol,
  });
  const oneOf = (vals: string[]) => ({
    condition: { type: "ONE_OF_LIST", values: vals.map((v) => ({ userEnteredValue: v })) },
    strict: true,
    showCustomUi: true,
  });

  requests.push({ setDataValidation: { range: movRange(1, 2), rule: oneOf(tipos) } });
  requests.push({
    setDataValidation: {
      range: movRange(2, 3),
      rule: { ...oneOf([...categoriasGasto, ...categoriasIngreso]), strict: false },
    },
  });
  requests.push({ setDataValidation: { range: movRange(3, 4), rule: oneOf(subcategorias) } });
  requests.push({ setDataValidation: { range: movRange(6, 7), rule: oneOf(metaMedios) } });
  requests.push({ setDataValidation: { range: movRange(7, 8), rule: oneOf(estados) } });
  requests.push({
    repeatCell: {
      range: { sheetId: movId, startRowIndex: 1, endRowIndex: 1001, startColumnIndex: 5, endColumnIndex: 6 },
      cell: { userEnteredFormat: { numberFormat: { type: "NUMBER", pattern: "#,##0.00" } } },
      fields: "userEnteredFormat.numberFormat",
    },
  });

  try {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests },
    });
  } catch (e) {
    throw mapApiError(e, "No se pudo configurar la plantilla.");
  }

  return {
    id: spreadsheetId,
    name: spreadsheetName,
    url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    sheets: templateSheets.map((s) => s.title),
  };
}

export async function readRange(
  session: SessionData,
  spreadsheetId: string,
  range: string
): Promise<string[][]> {
  const { sheets } = await getClients(session);
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  return (res.data.values as string[][]) ?? [];
}
