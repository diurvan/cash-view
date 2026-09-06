import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { listSpreadsheets, SheetsError } from "@/lib/sheets";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const files = await listSpreadsheets(session);
    return NextResponse.json({
      files,
      current: session.spreadsheetId ?? null,
    });
  } catch (e) {
    if (e instanceof SheetsError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("GET /api/sheets", e);
    return NextResponse.json(
      { error: "No se pudieron listar las hojas de cálculo." },
      { status: 500 }
    );
  }
}