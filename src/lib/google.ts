import { google } from "googleapis";
import { db } from "@/lib/db";

const GOOGLE_TOKEN_PREF_KEY = "google_oauth_token";

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/drive",
];

function baseUrl() {
  return process.env.APP_BASE_URL ?? "http://localhost:3000";
}

export function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET manquants. Crée un client OAuth Google Cloud (type application web) avec pour URI de redirection: " +
        `${baseUrl()}/api/connect/google/callback`
    );
  }
  return new google.auth.OAuth2(clientId, clientSecret, `${baseUrl()}/api/connect/google/callback`);
}

export async function saveGoogleTokens(tokens: {
  access_token?: string | null;
  refresh_token?: string | null;
  expiry_date?: number | null;
}) {
  const existingRaw = await db.preference.findUnique({ where: { cle: GOOGLE_TOKEN_PREF_KEY } });
  const existing = existingRaw ? JSON.parse(existingRaw.valeur) : {};

  const merged = {
    ...existing,
    ...tokens,
    // Google ne renvoie le refresh_token qu'à la première autorisation : on le conserve.
    refresh_token: tokens.refresh_token ?? existing.refresh_token,
  };

  await db.preference.upsert({
    where: { cle: GOOGLE_TOKEN_PREF_KEY },
    update: { valeur: JSON.stringify(merged) },
    create: { cle: GOOGLE_TOKEN_PREF_KEY, valeur: JSON.stringify(merged) },
  });
}

export async function getGoogleClient() {
  const client = getOAuth2Client();
  const pref = await db.preference.findUnique({ where: { cle: GOOGLE_TOKEN_PREF_KEY } });
  if (!pref) {
    throw new Error(
      "Google n'est pas encore connecté. Ouvre /api/connect/google pour autoriser l'accès à Gmail/Calendar/Drive."
    );
  }
  const tokens = JSON.parse(pref.valeur);
  client.setCredentials(tokens);

  client.on("tokens", (newTokens) => {
    saveGoogleTokens(newTokens).catch(() => {});
  });

  return client;
}

export async function isGoogleConnected() {
  const pref = await db.preference.findUnique({ where: { cle: GOOGLE_TOKEN_PREF_KEY } });
  return !!pref;
}

export async function gmailClient() {
  const auth = await getGoogleClient();
  return google.gmail({ version: "v1", auth });
}

export async function calendarClient() {
  const auth = await getGoogleClient();
  return google.calendar({ version: "v3", auth });
}

export async function driveClient() {
  const auth = await getGoogleClient();
  return google.drive({ version: "v3", auth });
}
