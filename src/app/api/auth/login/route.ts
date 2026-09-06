import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { authUrl, googleConfig } from "@/lib/google";

export async function GET() {
  const { clientId, redirectUri } = googleConfig();
  const state = randomBytes(24).toString("hex");

  (await cookies()).set("oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });

  return NextResponse.redirect(authUrl(clientId, redirectUri, state));
}
