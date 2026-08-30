import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { TOOL_BY_NAME } from "@/lib/tools/registry";
import { SYSTEM_PROMPT } from "@/lib/anthropic";
import { getAIProvider } from "@/lib/ai";
import type { AIMessage } from "@/lib/ai";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { actionLogId, confirmer, conversationId } = (await req.json()) as {
    actionLogId: string;
    confirmer: boolean;
    conversationId?: string;
  };

  const log = await db.actionLog.findUnique({ where: { id: actionLogId } });
  if (!log) return NextResponse.json({ error: "Action introuvable" }, { status: 404 });
  if (log.statut !== "PROPOSEE") {
    return NextResponse.json({ error: "Cette action a déjà été traitée." }, { status: 409 });
  }

  const tool = TOOL_BY_NAME[log.outil];
  if (!tool) return NextResponse.json({ error: "Outil inconnu." }, { status: 500 });

  let systemMessage: string;

  if (!confirmer) {
    await db.actionLog.update({ where: { id: log.id }, data: { statut: "ANNULEE" } });
    systemMessage = `[Action annulée par l'utilisateur: ${log.outil}]`;
  } else {
    try {
      const resultat = await tool.handler(log.parametres as object);
      await db.actionLog.update({
        where: { id: log.id },
        data: { statut: "EXECUTEE", resultat: resultat as object, executeeLe: new Date() },
      });
      systemMessage = `[Action confirmée et exécutée: ${log.outil}. Résultat: ${JSON.stringify(resultat)}]`;
    } catch (e) {
      await db.actionLog.update({ where: { id: log.id }, data: { statut: "REJETEE", erreur: (e as Error).message } });
      systemMessage = `[Action confirmée mais échouée: ${log.outil}. Erreur: ${(e as Error).message}]`;
    }
  }

  const provider = getAIProvider();
  let reply = confirmer ? "Fait." : "D'accord, action annulée.";

  if (conversationId) {
    await db.message.create({ data: { conversationId, role: "SYSTEM", contenu: systemMessage } });

    const historique = await db.message.findMany({
      where: { conversationId, role: { not: "SYSTEM" } },
      orderBy: { createdAt: "asc" },
      take: 40,
    });
    const messages: AIMessage[] = historique.map((m) => ({
      role: m.role === "USER" ? "user" : "assistant",
      content: m.contenu,
    })) as AIMessage[];
    messages.push({ role: "user", content: systemMessage });

    const response = await provider.converse({ system: SYSTEM_PROMPT, messages, tools: [] });
    const textBlocks = response.content.filter((b) => b.type === "text");
    reply = textBlocks.map((b) => b.text).join("\n") || reply;

    await db.message.create({ data: { conversationId, role: "ASSISTANT", contenu: reply } });
  }

  return NextResponse.json({ reply, statut: confirmer ? "EXECUTEE" : "ANNULEE" });
}
