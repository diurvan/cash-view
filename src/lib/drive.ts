import "server-only";
import { google } from "googleapis";
import { Readable } from "stream";
import type { SessionData } from "./session";
import { googleConfig } from "./google";

type GaxiosResponse<T> = { data: T; status: number };

export class DriveError extends Error {
  constructor(
    message: string,
    public status: number = 500
  ) {
    super(message);
  }
}

function driveAuth(session: SessionData) {
  if (!session.accessToken) {
    return Promise.reject(new DriveError("Sin acceso a Google. Conecta tu cuenta de nuevo.", 401));
  }
  let clientId: string, clientSecret: string, redirectUri: string;
  try {
    ({ clientId, clientSecret, redirectUri } = googleConfig());
  } catch (e) {
    return Promise.reject(
      new DriveError(e instanceof Error ? e.message : "Falta la configuración de Google.", 500)
    );
  }
  const oauth = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  oauth.setCredentials({
    access_token: session.accessToken,
    refresh_token: session.refreshToken || undefined,
  });
  return oauth.getAccessToken().then(
    () => oauth,
    () => {
      throw new DriveError("Sesión con Google expirada. Vuelve a conectarte.", 401);
    }
  );
}

function getDriveApi(session: SessionData) {
  return driveAuth(session).then((auth) => google.drive({ version: "v3", auth }));
}

// Traduce errores de la API de Google a DriveError con mensaje legible.
function mapDriveError(e: unknown, fallback: string): DriveError {
  const err = e as { status?: number; message?: string; errors?: { message?: string }[] };
  const status = err?.status ?? 500;
  const detail = err?.errors?.[0]?.message ?? err?.message;
  if (status === 401) {
    return new DriveError("Sesión con Google expirada. Conecta tu cuenta de nuevo.", 401);
  }
  if (/insufficient authentication scopes|forbidden|permission/i.test(detail ?? "")) {
    return new DriveError(
      "Tu conexión de Google no incluye el permiso drive.file. Desconecta y conecta de nuevo para aceptarlo.",
      403
    );
  }
  return new DriveError(detail ?? fallback, status);
}

// Sube (o actualiza) la copia del .cvw en Google Drive. Solo crea/lee
// archivos que el propio usuario eligió (scope drive.file).
export async function saveToDrive(
  session: SessionData,
  bytes: Uint8Array,
  name: string
): Promise<{ fileId: string; name: string }> {
  const drive = await getDriveApi(session);
  const fname = name.endsWith(".cvw") ? name : `${name}.cvw`;
  // googleapis exige que media.body sea un stream (un Buffer lanza
  // "part.body.pipe is not a function").
  const media = { mimeType: "application/octet-stream", body: Readable.from(Buffer.from(bytes)) };

  if (session.driveFileId) {
    try {
      await drive.files.update({
        fileId: session.driveFileId,
        media,
        requestBody: { name: fname },
      });
      return { fileId: session.driveFileId, name: fname };
    } catch {
      // el archivo pudo haber sido borrado: se recrea
    }
  }

  const res = await drive.files.create({
    requestBody: { name: fname, mimeType: "application/octet-stream" },
    media,
    fields: "id,name",
  }).catch((e) => {
    throw mapDriveError(e, "No se pudo guardar en Drive.");
  });
  if (!res.data.id) throw new DriveError("Google no devolvió un id de archivo.");
  return { fileId: res.data.id, name: fname };
}

export async function loadFromDrive(session: SessionData): Promise<{ bytes: Uint8Array; name: string } | null> {
  if (!session.driveFileId) return null;
  const drive = await getDriveApi(session);
  // Lee el contenido del archivo usando la opción de stream (la única
  // que drive.files.get tipa correctamente para contenido binario).
  const res = (await drive.files
    .get(
      { fileId: session.driveFileId },
      { responseType: "stream" } as never
    )
    .catch((e) => {
      throw mapDriveError(e, "No se pudo leer el archivo de Drive.");
    })) as GaxiosResponse<Readable>;
  const stream = res.data;
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const buf = Buffer.concat(chunks);
  if (buf.length === 0) throw new DriveError("El archivo en Drive está vacío.", 404);
  return { bytes: new Uint8Array(buf), name: session.spreadsheetName ?? "CashView.cvw" };
}