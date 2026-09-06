import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getSpreadsheetStructure, SheetsError } from "@/lib/sheets";
import { checkStructure } from "@/lib/records";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) throw new SheetsError("No autenticado", 401);

    const id = req.nextUrl.searchParams.get("id");
    if (!id) throw new SheetsError("Falta el parámetro id.", 400);

    const structure = await getSpreadsheetStructure(session, id);
    const check = checkStructure(structure);

    return NextResponse.json({ dataTab: check.tab, valid: check.missing.length === 0, check, structure });
  } catch (e) {
    if (e instanceof SheetsError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("GET /api/sheets/structure", e);
    return NextResponse.json({ error: "No se pudo analizar la hoja." }, { status: 500 });
  }
}