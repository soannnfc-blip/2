import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { anthropic, CLAUDE_MODEL, SYSTEM_PROMPT } from "@/lib/anthropic";
import { ANTHROPIC_TOOL_SCHEMAS, TOOL_BY_NAME } from "@/lib/tools/registry";
import { estAutomatique, niveauDe } from "@/lib/permissions";
import type Anthropic from "@anthropic-ai/sdk";

const MAX_TOOL_ROUNDS = 6;

type PendingAction = { actionLogId: string; outil: string; parametres: unknown; niveau: string };

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { message, conversationId } = (await req.json()) as { message: string; conversationId?: string };
  if (!message?.trim()) return NextResponse.json({ error: "Message vide" }, { status: 400 });

  const conversation = conversationId
    ? await db.conversation.findUnique({ where: { id: conversationId } })
    : await db.conversation.create({ data: { userId: session.user.id, titre: message.slice(0, 60) } });

  if (!conversation) return NextResponse.json({ error: "Conversation introuvable" }, { status: 404 });

  await db.message.create({ data: { conversationId: conversation.id, role: "USER", contenu: message } });

  const historique = await db.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "asc" },
    take: 40,
  });

  const messages: Anthropic.MessageParam[] = historique
    .filter((m) => m.role !== "SYSTEM")
    .map((m) => ({ role: m.role === "USER" ? "user" : "assistant", content: m.contenu }));

  const pendingActions: PendingAction[] = [];
  let finalText = "";

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: ANTHROPIC_TOOL_SCHEMAS as Anthropic.Tool[],
      messages,
    });

    const textBlocks = response.content.filter((b) => b.type === "text") as Anthropic.TextBlock[];
    finalText = textBlocks.map((b) => b.text).join("\n") || finalText;

    const toolUses = response.content.filter((b) => b.type === "tool_use") as Anthropic.ToolUseBlock[];
    if (toolUses.length === 0) break;

    messages.push({ role: "assistant", content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const call of toolUses) {
      const niveau = niveauDe(call.name);
      const tool = TOOL_BY_NAME[call.name];

      if (!tool) {
        toolResults.push({ type: "tool_result", tool_use_id: call.id, content: "Outil inconnu.", is_error: true });
        continue;
      }

      if (estAutomatique(call.name)) {
        const log = await db.actionLog.create({
          data: { userId: session.user.id, outil: call.name, niveau, parametres: call.input as object, statut: "EXECUTEE" },
        });
        try {
          const resultat = await tool.handler(call.input);
          await db.actionLog.update({ where: { id: log.id }, data: { resultat: resultat as object, executeeLe: new Date() } });
          toolResults.push({ type: "tool_result", tool_use_id: call.id, content: JSON.stringify(resultat) });
        } catch (e) {
          await db.actionLog.update({ where: { id: log.id }, data: { erreur: (e as Error).message } });
          toolResults.push({
            type: "tool_result",
            tool_use_id: call.id,
            content: `Erreur lors de l'exécution: ${(e as Error).message}`,
            is_error: true,
          });
        }
      } else {
        const log = await db.actionLog.create({
          data: { userId: session.user.id, outil: call.name, niveau, parametres: call.input as object, statut: "PROPOSEE" },
        });
        pendingActions.push({ actionLogId: log.id, outil: call.name, parametres: call.input, niveau });
        toolResults.push({
          type: "tool_result",
          tool_use_id: call.id,
          content:
            "Action NON exécutée : elle nécessite une confirmation explicite de l'utilisateur dans l'interface avant de continuer. " +
            "Termine ta réponse en formulant clairement la proposition à confirmer, ne dis pas que c'est fait.",
        });
      }
    }

    messages.push({ role: "user", content: toolResults });

    if (pendingActions.length > 0) {
      // On laisse Claude formuler sa proposition dans le prochain (et dernier) tour, sans relancer d'outils.
      const closing = await anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 512,
        system: SYSTEM_PROMPT,
        messages,
      });
      const closingText = closing.content.filter((b) => b.type === "text") as Anthropic.TextBlock[];
      finalText = closingText.map((b) => b.text).join("\n") || finalText;
      break;
    }
  }

  await db.message.create({
    data: {
      conversationId: conversation.id,
      role: "ASSISTANT",
      contenu: finalText,
      outilsAppeles: pendingActions.length ? (pendingActions as unknown as object) : undefined,
    },
  });

  return NextResponse.json({ reply: finalText, conversationId: conversation.id, pendingActions });
}
