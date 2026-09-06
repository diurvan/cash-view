import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const SESSION_COOKIE = "cashview_session";
const SECRET_SRC =
  process.env.SESSION_SECRET || "dev-secret-change-me-please-1234567890";
const SECRET = new TextEncoder().encode(SECRET_SRC);
const MAX_AGE = 60 * 60 * 24 * 30; // 30 días

export type SessionData = {
  sub: string;
  email?: string;
  name?: string;
  picture?: string | null;
  accessToken: string;
  refreshToken?: string;
  spreadsheetId?: string;
  spreadsheetName?: string;
  spreadsheetUrl?: string;
  spreadsheetTab?: string;
};

type SessionPayload = Omit<SessionData, "sub"> & { spreadsheetTab?: string; sub?: string };

function serialize(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(SECRET);
}

async function setCookie(token: string) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function createSession(data: Omit<SessionData, "sub"> & { id: string }) {
  const { id, ...rest } = data;
  await setCookie(await serialize({ ...rest, sub: id }));
}

export async function getSession(): Promise<SessionData | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, SECRET);
    const data: SessionData = {
      sub: payload.sub ?? "",
      email: payload.email as string | undefined,
      name: payload.name as string | undefined,
      picture: payload.picture as string | null | undefined,
      accessToken: payload.accessToken as string,
      refreshToken: payload.refreshToken as string | undefined,
      spreadsheetId: payload.spreadsheetId as string | undefined,
      spreadsheetName: payload.spreadsheetName as string | undefined,
      spreadsheetUrl: payload.spreadsheetUrl as string | undefined,
      spreadsheetTab: payload.spreadsheetTab as string | undefined,
    };
    return data.accessToken ? data : null;
  } catch {
    return null;
  }
}

export async function updateSession(patch: Partial<SessionData>) {
  const current = await getSession();
  if (!current) return null;
  const { sub, ...rest } = current;
  await setCookie(await serialize({ ...rest, ...patch, sub }));
  return { ...current, ...patch };
}

export async function destroySession() {
  (await cookies()).set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}