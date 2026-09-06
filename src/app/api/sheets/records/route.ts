import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { SheetsError } from "@/lib/sheets";
import {
  appendRecord,
  normalizeNumber,
  readRecords,
  resolveDataTab,
} from "@/lib/records";

export const runtime = "nodejs";

function requireSheet(session: Awaited<ReturnType<typeof getSession>>) {
  if (!session) throw new SheetsError("No autenticado", 401);
  if (!session.spreadsheetId) {
    throw new SheetsError("Primero elige una hoja de cálculo.", 400);
  }
  return session;
}

export async function GET(req: NextRequest) {
  try {
    const session = requireSheet(await getSession());
    const from = req.nextUrl.searchParams.get("from")?.trim() || undefined;
    const to = req.nextUrl.searchParams.get("to")?.trim() || undefined;
    const records = await readRecords(session, session.spreadsheetId!, session.spreadsheetTab, {
      from,
      to,
    });
    return NextResponse.json({ records });
  } catch (e) {
    if (e instanceof SheetsError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("GET /api/sheets/records", e);
    return NextResponse.json({ error: "No se pudieron leer los registros." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = requireSheet(await getSession());
    const body = await req.json().catch(() => null);

    const fecha = typeof body?.fecha === "string" ? body.fecha.trim() : "";
    const tipo = typeof body?.tipo === "string" ? body.tipo.trim() : "";
    const categoria = typeof body?.categoria === "string" ? body.categoria.trim() : "";
    const subcategoria = typeof body?.subcategoria === "string" ? body.subcategoria.trim() : "";
    const descripcion = typeof body?.descripcion === "string" ? body.descripcion.trim() : "";
    const cuenta = typeof body?.cuenta === "string" ? body.cuenta.trim() : "";
    const estado = typeof body?.estado === "string" ? body.estado.trim() : "";
    const importe = normalizeNumber(body?.importe);

    if (!fecha || !tipo || importe === 0) {
      throw new SheetsError("Completa fecha, tipo e importe.", 400);
    }

    const tab = await resolveDataTab(session, session.spreadsheetId!);
    await appendRecord(session, session.spreadsheetId!, tab, {
      fecha,
      tipo,
      categoria,
      subcategoria: subcategoria || undefined,
      descripcion,
      cuenta: cuenta || undefined,
      estado: estado || undefined,
      importe,
    });
    const records = await readRecords(session, session.spreadsheetId!, tab);
    return NextResponse.json({ ok: true, records });
  } catch (e) {
    if (e instanceof SheetsError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("POST /api/sheets/records", e);
    return NextResponse.json({ error: "No se pudo agregar el registro." }, { status: 500 });
  }
}