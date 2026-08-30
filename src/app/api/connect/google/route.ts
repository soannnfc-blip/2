import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getOAuth2Client, GOOGLE_SCOPES } from "@/lib/google";

// Démarre le flux OAuth réel vers Google (Gmail + Calendar + Drive).
// Nécessite GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET dans .env (client OAuth "Application web"
// créé dans Google Cloud Console, avec cette URI de redirection autorisée:
// {APP_BASE_URL}/api/connect/google/callback)
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.redirect(new URL("/login", "http://localhost:3000"));

  let client;
  try {
    client = getOAuth2Client();
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }

  const url = client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GOOGLE_SCOPES,
  });

  return NextResponse.redirect(url);
}
