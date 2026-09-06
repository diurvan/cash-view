import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { authUrl, googleConfig } from "@/lib/google";

export async function GET(req: NextRequest) {
  let google;
  try {
    google = googleConfig();
  } catch {
    const base = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "");
    return NextResponse.redirect(`${base}/catalog?error=noconfig`);
  }
  const { clientId, redirectUri } = google;
  const state = randomBytes(24).toString("hex");

  const rawNext = req.nextUrl.searchParams.get("next");
  const next = rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard";

  (await cookies()).set("oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });
  (await cookies()).set("oauth_next", next, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });

  return NextResponse.redirect(authUrl(clientId, redirectUri, state));
}