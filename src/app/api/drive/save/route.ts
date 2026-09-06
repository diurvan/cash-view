import { NextRequest, NextResponse } from "next/server";
import { getSession, updateSession } from "@/lib/session";
import { DriveError, saveToDrive } from "@/lib/drive";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "No conectado. Conecta tu cuenta de Google primero." }, { status: 401 });
    }
    const body = await req.json().catch(() => null);
    const b64 = typeof body?.bytes === "string" ? body.bytes : "";
    if (!b64) {
      return NextResponse.json({ error: "No hay datos que guardar." }, { status: 400 });
    }
    const bytes = new Uint8Array(Buffer.from(b64, "base64"));
    const name = typeof body?.name === "string" && body.name ? body.name : "CashView.cvw";

    const res = await saveToDrive(session, bytes, name);
    await updateSession({ driveFileId: res.fileId, spreadsheetName: res.name });
    return NextResponse.json({ ok: true, fileId: res.fileId, name: res.name });
  } catch (e) {
    if (e instanceof DriveError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("POST /api/drive/save", e);
    const msg =
      e instanceof Error && /Falta variable de entorno/i.test(e.message)
        ? "Google no está configurado (faltan GOOGLE_CLIENT_ID/SECRET en el servidor)."
        : "No se pudo guardar en Drive.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}