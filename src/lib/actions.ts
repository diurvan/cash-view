"use server";

import { google } from "googleapis";
import { destroySession, getSession, type SessionData } from "./session";
import { googleConfig } from "./google";

// Revoca el token de Google (elimina los permisos acumulados de versiones
// anteriores, p. ej. hojas de cálculo y drive.readonly) para que al volver
// a conectar solo se pidan los permisos mínimos actuales.
async function revokeGoogle(session: SessionData | null) {
  if (!session?.refreshToken) return;
  try {
    const { clientId, clientSecret, redirectUri } = googleConfig();
    const oauth = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    oauth.setCredentials({ refresh_token: session.refreshToken });
    await oauth.revokeToken(session.refreshToken);
  } catch {
    // sin conexión o token ya revocado: no debe impedir desconectarse
  }
}

export async function disconnectDrive() {
  const session = await getSession();
  await revokeGoogle(session);
  await destroySession();
}