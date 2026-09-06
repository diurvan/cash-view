import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { SheetsError } from "@/lib/sheets";
import { readCatalog, saveAccounts, saveCategories } from "@/lib/catalog";
import { normalizeNumber } from "@/lib/money";
import type { CategoriaRow, CuentaRow } from "@/lib/catalog";

export const runtime = "nodejs";

async function sessionGuard() {
  const session = await getSession();
  if (!session) throw new SheetsError("No autenticado", 401);
  if (!session.spreadsheetId) {
    throw new SheetsError("Primero elige una hoja de cálculo.", 400);
  }
  return session;
}

export async function GET() {
  try {
    const session = await sessionGuard();
    const catalog = await readCatalog(session, session.spreadsheetId!);
    return NextResponse.json(catalog);
  } catch (e) {
    if (e instanceof SheetsError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("GET /api/catalog", e);
    return NextResponse.json({ error: "No se pudo leer el catálogo." }, { status: 500 });
  }
}

function parseCategorias(body: unknown): CategoriaRow[] | undefined {
  if (!Array.isArray(body)) return undefined;
  return body
    .map((r) => {
      const row = (r ?? {}) as Record<string, unknown>;
      return {
        tipo: typeof row.tipo === "string" ? row.tipo : "",
        categoria: typeof row.categoria === "string" ? row.categoria : "",
        subcategoria:
          typeof row.subcategoria === "string" && row.subcategoria ? row.subcategoria : undefined,
        presupuesto:
          typeof row.presupuesto === "string" && row.presupuesto.trim() !== ""
            ? normalizeNumber(row.presupuesto)
            : typeof row.presupuesto === "number"
              ? row.presupuesto
              : undefined,
      };
    })
    .filter((r) => r.categoria.trim());
}

function parseCuentas(body: unknown): CuentaRow[] | undefined {
  if (!Array.isArray(body)) return undefined;
  return body
    .map((r) => {
      const row = (r ?? {}) as Record<string, unknown>;
      return {
        nombre: typeof row.nombre === "string" ? row.nombre : "",
        tipo: typeof row.tipo === "string" ? row.tipo : "",
        saldo:
          typeof row.saldo === "string" && row.saldo.trim() !== ""
            ? normalizeNumber(row.saldo)
            : typeof row.saldo === "number"
              ? row.saldo
              : undefined,
      };
    })
    .filter((r) => r.nombre.trim());
}

export async function PUT(req: NextRequest) {
  try {
    const session = await sessionGuard();
    const body = await req.json().catch(() => null);

    const categorias = parseCategorias(body?.categorias);
    const cuentas = parseCuentas(body?.cuentas);

    if (categorias === undefined && cuentas === undefined) {
      throw new SheetsError("No hay nada que guardar.", 400);
    }
    if (categorias !== undefined) {
      await saveCategories(session, session.spreadsheetId!, categorias);
    }
    if (cuentas !== undefined) {
      await saveAccounts(session, session.spreadsheetId!, cuentas);
    }

    const catalog = await readCatalog(session, session.spreadsheetId!);
    return NextResponse.json({ ok: true, catalog });
  } catch (e) {
    if (e instanceof SheetsError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("PUT /api/catalog", e);
    return NextResponse.json({ error: "No se pudo guardar el catálogo." }, { status: 500 });
  }
}