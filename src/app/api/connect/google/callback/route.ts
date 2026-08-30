import { NextResponse } from "next/server";
import { getOAuth2Client, saveGoogleTokens } from "@/lib/google";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    return NextResponse.json({ error: `Autorisation Google refusée: ${error}` }, { status: 400 });
  }
  if (!code) {
    return NextResponse.json({ error: "Code d'autorisation manquant." }, { status: 400 });
  }

  try {
    const client = getOAuth2Client();
    const { tokens } = await client.getToken(code);
    await saveGoogleTokens(tokens);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }

  return NextResponse.redirect(new URL("/?google=connecte", url.origin));
}
