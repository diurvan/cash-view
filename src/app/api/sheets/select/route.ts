import { NextRequest, NextResponse } from "next/server";
import { getSession, updateSession } from "@/lib/session";
import {
  getSpreadsheet,
  getSpreadsheetOwner,
  getSpreadsheetStructure,
  SheetsError,
  tokenScopes,
} from "@/lib/sheets";
import { checkStructure } from "@/lib/records";
import { DRIVE_READONLY_SCOPE, SHEETS_SCOPE } from "@/lib/google";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let session: Awaited<ReturnType<typeof getSession>> = null;
  let id = "";
  try {
    session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    id = typeof body?.id === "string" ? body.id.trim() : "";
    if (!id) {
      return NextResponse.json({ error: "Falta el id de la hoja." }, { status: 400 });
    }

    const sheet = await getSpreadsheet(session, id);

    // Validación estricta: solo se puede seleccionar un archivo con la
    // estructura mínima (pestaña de datos con Fecha, Tipo e Importe).
    const structure = await getSpreadsheetStructure(session, id);
    const check = checkStructure(structure);
    if (check.missing.length > 0) {
      return NextResponse.json(
        {
          error: `Este archivo no tiene la estructura que CashView necesita para trabajar. En la pestaña "${check.tab ?? "desconocida"}" falta: ${check.missing.join(
            ", "
          )}. Columnas encontradas: ${check.found.length ? check.found.join(", ") : "ninguna"}. Usa "Crear mi hoja con la plantilla" para empezar con la estructura correcta.`,
        },
        { status: 422 }
      );
    }
    const tab = check.tab ?? undefined;

    await updateSession({
      spreadsheetId: sheet.id,
      spreadsheetName: sheet.name,
      spreadsheetUrl: sheet.url,
      spreadsheetTab: tab,
    });

    return NextResponse.json({ ok: true, sheet, tab });
  } catch (e) {
    if (e instanceof SheetsError) {
      if (e.status === 403 && e.probe) {
        return NextResponse.json({ error: e.message, link: e.probe }, { status: 403 });
      }
      if (e.status === 403) {
        const info = await getSpreadsheetOwner(session!, id);
        const user = session?.email ?? "tu cuenta";
        const owner = info.owner ? ` La hoja pertenece a ${info.owner}.` : "";
        const scopes = (await tokenScopes(session!)) ?? "desconocidos";
        const hasSheets =
          scopes !== "desconocidos" ? (scopes.includes(SHEETS_SCOPE) ? "SÍ" : "NO") : "?";
        const hasDrive =
          scopes !== "desconocidos"
            ? (scopes.includes(DRIVE_READONLY_SCOPE) ? "SÍ" : "NO")
            : "?";
        return NextResponse.json(
          {
            error: `No tienes permiso (403). Tu sesión: ${user}.${owner} Token con scope de hojas: ${hasSheets}; scope de Drive: ${hasDrive}. ${
              hasSheets === "NO"
                ? "El permiso de lectura/escritura de hojas no fue autorizado: sal y vuelve a conectarte aceptando TODOS los permisos en la pantalla de Google."
                : hasSheets === "?"
                  ? "No se pudo verificar el token. Plantéame el mensaje de la consola (terminal)."
                  : "Verifica que compartiste/abres la hoja correcta en tu cuenta; si usas Workspace de empresa, el administrador puede restringir apps externas."
            }`,
          },
          { status: 403 }
        );
      }
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("POST /api/sheets/select", e);
    return NextResponse.json(
      { error: "No se pudo seleccionar la hoja. Verifica que tengas acceso a ella." },
      { status: 500 }
    );
  }
}