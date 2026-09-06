import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  if (!session.spreadsheetId) {
    return NextResponse.json({ sheet: null });
  }
  return NextResponse.json({
    sheet: {
      id: session.spreadsheetId,
      name: session.spreadsheetName,
      url: session.spreadsheetUrl,
    },
  });
}