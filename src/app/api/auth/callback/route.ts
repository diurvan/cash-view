import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { googleConfig } from "@/lib/google";
import { createSession } from "@/lib/session";

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  id_token?: string;
};

type UserInfo = {
  sub: string;
  email?: string;
  name?: string;
  picture?: string | null;
};

function parseJwt(token: string): UserInfo | null {
  try {
    const payload = token.split(".")[1];
    const json = Buffer.from(payload, "base64url").toString("utf-8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const code = params.get("code");
  const state = params.get("state");
  const error = params.get("error");

  const stateCookie = (await cookies()).get("oauth_state")?.value;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  if (error || !code) {
    return NextResponse.redirect(`${baseUrl}/login?error=denied`);
  }

  if (!state || state !== stateCookie) {
    return NextResponse.redirect(`${baseUrl}/login?error=state`);
  }

  const { clientId, clientSecret, redirectUri } = googleConfig();

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(`${baseUrl}/login?error=token`);
  }

  const tokens: TokenResponse = await tokenRes.json();

  let user: UserInfo = { sub: "" };
  if (tokens.id_token) {
    user = parseJwt(tokens.id_token) ?? user;
  } else {
    const infoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (infoRes.ok) user = (await infoRes.json()) as UserInfo;
  }

  await createSession({
    id: user.sub,
    email: user.email,
    name: user.name,
    picture: user.picture,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
  });

  return NextResponse.redirect(`${baseUrl}/dashboard`);
}
