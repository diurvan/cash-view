import { NextRequest, NextResponse } from "next/server";
import { getSession, updateSession } from "@/lib/session";
import { createSpreadsheetFromTemplate, SheetsError } from "@/lib/sheets";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const title = typeof body?.title === "string" && body.title.trim() ? body.title.trim() : undefined;

    const created = await createSpreadsheetFromTemplate(session, title);
    await updateSession({
      spreadsheetId: created.id,
      spreadsheetName: created.name,
      spreadsheetUrl: created.url,
      spreadsheetTab: created.sheets[0] ?? "Registro",
    });

    return NextResponse.json({ ok: true, sheet: created });
  } catch (e) {
    if (e instanceof SheetsError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("POST /api/sheets/create", e);
    return NextResponse.json(
      { error: "No se pudo crear la hoja desde la plantilla." },
      { status: 500 }
    );
  }
}