import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { SheetsError } from "@/lib/sheets";
import {
  deleteRecord,
  normalizeNumber,
  readRecords,
  resolveDataTab,
  updateRecord,
} from "@/lib/records";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ row: string }> };

async function sessionGuard() {
  const session = await getSession();
  if (!session) throw new SheetsError("No autenticado", 401);
  if (!session.spreadsheetId) {
    throw new SheetsError("Primero elige una hoja de cálculo.", 400);
  }
  return session;
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    const session = await sessionGuard();
    const { row } = await ctx.params;
    const rowNum = Number(row);
    if (!Number.isInteger(rowNum) || rowNum < 2) {
      throw new SheetsError("Fila inválida.", 400);
    }

    const body = await req.json().catch(() => null);
    const rec = {
      fecha: typeof body?.fecha === "string" ? body.fecha.trim() : "",
      tipo: typeof body?.tipo === "string" ? body.tipo.trim() : "",
      categoria: typeof body?.categoria === "string" ? body.categoria.trim() : "",
      subcategoria: typeof body?.subcategoria === "string" ? body.subcategoria.trim() : "",
      descripcion: typeof body?.descripcion === "string" ? body.descripcion.trim() : "",
      cuenta: typeof body?.cuenta === "string" ? body.cuenta.trim() : "",
      estado: typeof body?.estado === "string" ? body.estado.trim() : "",
      importe: normalizeNumber(body?.importe),
    };
    if (!rec.fecha || !rec.tipo || rec.importe === 0) {
      throw new SheetsError("Completa fecha, tipo e importe.", 400);
    }

    const tab = await resolveDataTab(session, session.spreadsheetId!);
    await updateRecord(session, session.spreadsheetId!, tab, rowNum, rec);
    const records = await readRecords(session, session.spreadsheetId!, tab);
    return NextResponse.json({ ok: true, records });
  } catch (e) {
    if (e instanceof SheetsError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("PUT /api/sheets/records/[row]", e);
    return NextResponse.json({ error: "No se pudo modificar el registro." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const session = await sessionGuard();
    const { row } = await ctx.params;
    const rowNum = Number(row);
    if (!Number.isInteger(rowNum) || rowNum < 2) {
      throw new SheetsError("Fila inválida.", 400);
    }

    const tab = await resolveDataTab(session, session.spreadsheetId!);
    await deleteRecord(session, session.spreadsheetId!, tab, rowNum);
    const records = await readRecords(session, session.spreadsheetId!, tab);
    return NextResponse.json({ ok: true, records });
  } catch (e) {
    if (e instanceof SheetsError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("DELETE /api/sheets/records/[row]", e);
    return NextResponse.json({ error: "No se pudo eliminar el registro." }, { status: 500 });
  }
}