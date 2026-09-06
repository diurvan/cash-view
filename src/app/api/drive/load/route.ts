import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { DriveError, loadFromDrive } from "@/lib/drive";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "No conectado. Conecta tu cuenta de Google primero." }, { status: 401 });
    }
    const res = await loadFromDrive(session);
    if (!res) {
      return NextResponse.json({ error: "Todavía no has guardado una copia en Drive." }, { status: 404 });
    }
    return NextResponse.json({ bytes: Buffer.from(res.bytes).toString("base64"), name: res.name });
  } catch (e) {
    if (e instanceof DriveError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("GET /api/drive/load", e);
    return NextResponse.json({ error: "No se pudo descargar desde Drive." }, { status: 500 });
  }
}