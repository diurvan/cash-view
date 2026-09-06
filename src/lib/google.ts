export const DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file";

const SCOPES = [DRIVE_FILE_SCOPE, "openid", "email", "profile"].join(" ");

function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Falta variable de entorno: ${name}`);
  }
  return v;
}

// Garantiza que la redirect URI siempre sea absoluta, incluso si
// NEXT_PUBLIC_APP_URL queda vacía o GOOGLE_REDIRECT_URI es relativo.
function absoluteUrl(pathOrFull: string, fallbackBase: string): string {
  if (/^https?:\/\//i.test(pathOrFull)) return pathOrFull;
  const base = (fallbackBase || "http://localhost:3000").replace(/\/+$/, "");
  return `${base}/${pathOrFull.replace(/^\/+/, "")}`;
}

export const googleConfig = () => {
  const clientId = required("GOOGLE_CLIENT_ID");
  const clientSecret = required("GOOGLE_CLIENT_SECRET");
  const redirectUri = absoluteUrl(
    process.env.GOOGLE_REDIRECT_URI || "/api/auth/callback",
    process.env.NEXT_PUBLIC_APP_URL || ""
  );
  return { clientId, clientSecret, redirectUri };
};

export function authUrl(clientId: string, redirectUri: string, state: string) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}
