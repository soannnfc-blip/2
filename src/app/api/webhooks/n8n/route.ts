import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Point d'entrée pour les automatisations n8n (analyse proactive planifiée).
// Sécurisé par secret partagé (jamais par la session utilisateur, n8n n'a pas de cookie navigateur).
export async function POST(req: Request) {
  const secret = req.headers.get("x-noteo-secret");
  if (!process.env.N8N_WEBHOOK_SECRET || secret !== process.env.N8N_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const body = (await req.json()) as {
    type: string;
    titre: string;
    message: string;
    niveau?: "info" | "attention" | "urgent";
  };

  if (!body.type || !body.titre || !body.message) {
    return NextResponse.json({ error: "type, titre et message sont requis" }, { status: 400 });
  }

  const alerte = await db.alerte.create({
    data: { type: body.type, titre: body.titre, message: body.message, niveau: body.niveau ?? "info" },
  });

  return NextResponse.json({ id: alerte.id, cree: true });
}
