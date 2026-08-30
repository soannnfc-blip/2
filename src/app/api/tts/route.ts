import { NextResponse } from "next/server";
import { auth } from "@/auth";

// Synthèse vocale de la réponse de l'assistant.
// Utilise ElevenLabs si ELEVENLABS_API_KEY est configurée, sinon renvoie 501
// et le frontend bascule sur la synthèse vocale native du navigateur (speechSynthesis).
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ELEVENLABS_API_KEY non configurée — utilise la voix native du navigateur." },
      { status: 501 }
    );
  }

  const { text, voiceId } = (await req.json()) as { text: string; voiceId?: string };
  if (!text?.trim()) return NextResponse.json({ error: "Texte vide" }, { status: 400 });

  const voice = voiceId ?? process.env.ELEVENLABS_VOICE_ID ?? "21m00Tcm4TlvDq8ikWAM";

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: { stability: 0.4, similarity_boost: 0.8 },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    return NextResponse.json({ error: `Erreur ElevenLabs: ${body}` }, { status: 502 });
  }

  return new NextResponse(res.body, { headers: { "Content-Type": "audio/mpeg" } });
}
