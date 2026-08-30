import { gmailClient } from "@/lib/google";
import type { ToolDefinition } from "./types";

function decodeBody(payload: any): string {
  if (!payload) return "";
  if (payload.body?.data) {
    return Buffer.from(payload.body.data, "base64url").toString("utf-8");
  }
  const part = payload.parts?.find((p: any) => p.mimeType === "text/plain") ?? payload.parts?.[0];
  if (part) return decodeBody(part);
  return "";
}

function headerValue(headers: any[], name: string) {
  return headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

export const rechercherEmails: ToolDefinition = {
  name: "rechercher_emails",
  description:
    "Recherche des emails Gmail par mot-clé, nom d'expéditeur, sujet, ou requête Gmail avancée. " +
    "Si la recherche par nom trouve plusieurs personnes différentes (homonymes, adresses email distinctes), " +
    "retourne-les toutes distinctement pour permettre à l'utilisateur de choisir — ne devine jamais.",
  input_schema: {
    type: "object",
    properties: {
      requete: { type: "string", description: "Terme de recherche ou requête Gmail (ex: 'from:julien', 'is:unread')" },
      max_resultats: { type: "number", description: "Nombre max de résultats (défaut 10)" },
    },
    required: ["requete"],
  },
  handler: async ({ requete, max_resultats = 10 }) => {
    const gmail = await gmailClient();
    const list = await gmail.users.messages.list({
      userId: "me",
      q: requete,
      maxResults: max_resultats,
    });

    const messages = list.data.messages ?? [];
    const details = await Promise.all(
      messages.map(async (m) => {
        const msg = await gmail.users.messages.get({
          userId: "me",
          id: m.id!,
          format: "metadata",
          metadataHeaders: ["From", "Subject", "Date"],
        });
        const headers = msg.data.payload?.headers ?? [];
        return {
          id: msg.data.id,
          threadId: msg.data.threadId,
          de: headerValue(headers, "From"),
          sujet: headerValue(headers, "Subject"),
          date: headerValue(headers, "Date"),
          extrait: msg.data.snippet,
          nonLu: msg.data.labelIds?.includes("UNREAD") ?? false,
          important: msg.data.labelIds?.includes("IMPORTANT") ?? false,
        };
      })
    );

    return { total: details.length, emails: details };
  },
};

export const lireEmail: ToolDefinition = {
  name: "lire_email",
  description: "Lit le contenu complet d'un email ou d'une conversation (thread) Gmail à partir de son id.",
  input_schema: {
    type: "object",
    properties: {
      id: { type: "string", description: "id du message ou du thread" },
      type: { type: "string", enum: ["message", "thread"], description: "défaut: message" },
    },
    required: ["id"],
  },
  handler: async ({ id, type = "message" }) => {
    const gmail = await gmailClient();
    if (type === "thread") {
      const thread = await gmail.users.threads.get({ userId: "me", id, format: "full" });
      return {
        messages: thread.data.messages?.map((m) => ({
          id: m.id,
          de: headerValue(m.payload?.headers ?? [], "From"),
          sujet: headerValue(m.payload?.headers ?? [], "Subject"),
          date: headerValue(m.payload?.headers ?? [], "Date"),
          corps: decodeBody(m.payload).slice(0, 5000),
        })),
      };
    }
    const msg = await gmail.users.messages.get({ userId: "me", id, format: "full" });
    const headers = msg.data.payload?.headers ?? [];
    return {
      id: msg.data.id,
      threadId: msg.data.threadId,
      de: headerValue(headers, "From"),
      a: headerValue(headers, "To"),
      sujet: headerValue(headers, "Subject"),
      date: headerValue(headers, "Date"),
      corps: decodeBody(msg.data.payload).slice(0, 8000),
    };
  },
};

export const resumerEmail: ToolDefinition = {
  name: "resumer_email",
  description:
    "Récupère un email ou un thread complet pour que tu (l'assistant) en fasses toi-même le résumé dans ta réponse. " +
    "Ne réduit pas le contenu — te fournit la matière brute à synthétiser.",
  input_schema: {
    type: "object",
    properties: { id: { type: "string" }, type: { type: "string", enum: ["message", "thread"] } },
    required: ["id"],
  },
  handler: async (input) => lireEmail.handler(input),
};

export const redigerReponseEmail: ToolDefinition = {
  name: "rediger_reponse_email",
  description:
    "Crée un BROUILLON de réponse dans Gmail (dans le thread d'origine) sans l'envoyer. " +
    "L'utilisateur devra explicitement demander l'envoi ensuite via envoyer_email.",
  input_schema: {
    type: "object",
    properties: {
      thread_id: { type: "string" },
      destinataire: { type: "string" },
      sujet: { type: "string" },
      corps: { type: "string", description: "Corps du message en texte brut" },
    },
    required: ["thread_id", "destinataire", "corps"],
  },
  handler: async ({ thread_id, destinataire, sujet, corps }) => {
    const gmail = await gmailClient();
    const raw = buildRawMessage({ to: destinataire, subject: sujet ?? "Re:", body: corps });
    const draft = await gmail.users.drafts.create({
      userId: "me",
      requestBody: { message: { raw, threadId: thread_id } },
    });
    return { brouillonId: draft.data.id, message: "Brouillon créé, en attente d'envoi." };
  },
};

export const envoyerEmail: ToolDefinition = {
  name: "envoyer_email",
  description: "Envoie réellement un email (ou un brouillon existant). Nécessite une confirmation utilisateur préalable.",
  input_schema: {
    type: "object",
    properties: {
      brouillon_id: { type: "string", description: "Si fourni, envoie ce brouillon existant" },
      destinataire: { type: "string" },
      sujet: { type: "string" },
      corps: { type: "string" },
      thread_id: { type: "string" },
    },
  },
  handler: async ({ brouillon_id, destinataire, sujet, corps, thread_id }) => {
    const gmail = await gmailClient();
    if (brouillon_id) {
      const sent = await gmail.users.drafts.send({ userId: "me", requestBody: { id: brouillon_id } });
      return { envoye: true, id: sent.data.id };
    }
    const raw = buildRawMessage({ to: destinataire, subject: sujet, body: corps });
    const sent = await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw, threadId: thread_id },
    });
    return { envoye: true, id: sent.data.id };
  },
};

function buildRawMessage({ to, subject, body }: { to?: string; subject?: string; body?: string }) {
  const message = [`To: ${to}`, `Subject: ${subject ?? ""}`, "Content-Type: text/plain; charset=utf-8", "", body ?? ""].join(
    "\n"
  );
  return Buffer.from(message).toString("base64url");
}

export const emailTools = [rechercherEmails, lireEmail, resumerEmail, redigerReponseEmail, envoyerEmail];
