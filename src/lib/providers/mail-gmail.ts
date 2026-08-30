import { gmailClient } from "@/lib/google";
import { buildMimeWithAttachment } from "@/lib/mime";
import type { MailProvider, EmailSummary, EmailDetail } from "./types";

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

function buildRawMessage({ to, subject, body }: { to?: string; subject?: string; body?: string }) {
  const message = [`To: ${to}`, `Subject: ${subject ?? ""}`, "Content-Type: text/plain; charset=utf-8", "", body ?? ""].join(
    "\n"
  );
  return Buffer.from(message).toString("base64url");
}

export class GmailMailProvider implements MailProvider {
  readonly source = "gmail" as const;

  async search(query: string, maxResultats = 10): Promise<EmailSummary[]> {
    const gmail = await gmailClient();
    const list = await gmail.users.messages.list({ userId: "me", q: query, maxResults: maxResultats });
    const messages = list.data.messages ?? [];
    return Promise.all(
      messages.map(async (m) => {
        const msg = await gmail.users.messages.get({
          userId: "me",
          id: m.id!,
          format: "metadata",
          metadataHeaders: ["From", "Subject", "Date"],
        });
        const headers = msg.data.payload?.headers ?? [];
        const from = headerValue(headers, "From");
        const match = from.match(/^(.*?)<(.+)>$/);
        return {
          id: msg.data.id!,
          threadId: msg.data.threadId ?? null,
          de: match ? match[1].trim().replace(/"/g, "") : from,
          deEmail: match ? match[2].trim() : from,
          sujet: headerValue(headers, "Subject"),
          date: headerValue(headers, "Date"),
          extrait: msg.data.snippet ?? "",
          nonLu: msg.data.labelIds?.includes("UNREAD") ?? false,
          important: msg.data.labelIds?.includes("IMPORTANT") ?? false,
        };
      })
    );
  }

  async read(id: string, type: "message" | "thread" = "message") {
    const gmail = await gmailClient();
    if (type === "thread") {
      const thread = await gmail.users.threads.get({ userId: "me", id, format: "full" });
      return {
        messages: (thread.data.messages ?? []).map((m) => {
          const headers = m.payload?.headers ?? [];
          return {
            id: m.id!,
            threadId: m.threadId ?? null,
            de: headerValue(headers, "From"),
            deEmail: headerValue(headers, "From"),
            a: headerValue(headers, "To"),
            sujet: headerValue(headers, "Subject"),
            date: headerValue(headers, "Date"),
            extrait: m.snippet ?? "",
            corps: decodeBody(m.payload).slice(0, 5000),
            nonLu: m.labelIds?.includes("UNREAD") ?? false,
            important: m.labelIds?.includes("IMPORTANT") ?? false,
          };
        }),
      };
    }
    const msg = await gmail.users.messages.get({ userId: "me", id, format: "full" });
    const headers = msg.data.payload?.headers ?? [];
    return {
      id: msg.data.id!,
      threadId: msg.data.threadId ?? null,
      de: headerValue(headers, "From"),
      deEmail: headerValue(headers, "From"),
      a: headerValue(headers, "To"),
      sujet: headerValue(headers, "Subject"),
      date: headerValue(headers, "Date"),
      extrait: msg.data.snippet ?? "",
      corps: decodeBody(msg.data.payload).slice(0, 8000),
      nonLu: msg.data.labelIds?.includes("UNREAD") ?? false,
      important: msg.data.labelIds?.includes("IMPORTANT") ?? false,
    };
  }

  async createDraft({ threadId, destinataire, sujet, corps }: { threadId: string; destinataire: string; sujet?: string; corps: string }) {
    const gmail = await gmailClient();
    const raw = buildRawMessage({ to: destinataire, subject: sujet ?? "Re:", body: corps });
    const draft = await gmail.users.drafts.create({ userId: "me", requestBody: { message: { raw, threadId } } });
    return { brouillonId: draft.data.id! };
  }

  async send({ brouillonId, destinataire, sujet, corps, threadId }: any) {
    const gmail = await gmailClient();
    if (brouillonId) {
      const sent = await gmail.users.drafts.send({ userId: "me", requestBody: { id: brouillonId } });
      return { envoye: true, id: sent.data.id! };
    }
    const raw = buildRawMessage({ to: destinataire, subject: sujet, body: corps });
    const sent = await gmail.users.messages.send({ userId: "me", requestBody: { raw, threadId } });
    return { envoye: true, id: sent.data.id! };
  }

  async sendAvecPieceJointe({ destinataire, sujet, corps, piecesJointes }: any) {
    const gmail = await gmailClient();
    const raw = buildMimeWithAttachment({ to: destinataire, subject: sujet, body: corps, attachment: piecesJointes[0] });
    const sent = await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
    return { envoye: true, id: sent.data.id! };
  }
}
