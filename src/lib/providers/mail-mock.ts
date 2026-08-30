import { db } from "@/lib/db";
import type { MailProvider, EmailSummary, EmailDetail } from "./types";

// Brouillons en attente d'envoi (mode démo). Volatile par process — suffisant pour une démo
// : aucune donnée métier réelle (facture, vente, email envoyé) n'est perdue, seul l'état
// intermédiaire "brouillon non confirmé" ne survit pas à un redémarrage du serveur.
const brouillonsEnMemoire = new Map<
  string,
  { destinataire: string; sujet?: string; corps: string; threadId?: string }
>();

function toSummary(e: {
  id: string;
  threadId: string;
  de: string;
  deEmail: string;
  sujet: string;
  date: Date;
  extrait: string;
  lu: boolean;
  important: boolean;
}): EmailSummary {
  return {
    id: e.id,
    threadId: e.threadId,
    de: e.de,
    deEmail: e.deEmail,
    sujet: e.sujet,
    date: e.date.toISOString(),
    extrait: e.extrait,
    nonLu: !e.lu,
    important: e.important,
  };
}

export class MockMailProvider implements MailProvider {
  readonly source = "demo" as const;

  async search(query: string, maxResultats = 10): Promise<EmailSummary[]> {
    const q = query.trim();

    if (!q) {
      const recents = await db.emailDemo.findMany({
        where: { dossier: "INBOX" },
        orderBy: { date: "desc" },
        take: maxResultats,
      });
      return recents.map(toSummary);
    }

    if (/^is:unread$/i.test(q)) {
      const rows = await db.emailDemo.findMany({
        where: { dossier: "INBOX", lu: false },
        orderBy: { date: "desc" },
        take: maxResultats,
      });
      return rows.map(toSummary);
    }
    if (/^is:important$/i.test(q)) {
      const rows = await db.emailDemo.findMany({
        where: { dossier: "INBOX", important: true },
        orderBy: { date: "desc" },
        take: maxResultats,
      });
      return rows.map(toSummary);
    }

    const fromMatch = q.match(/^from:\s*(.+)$/i);
    const terme = (fromMatch ? fromMatch[1] : q).trim();

    const rows = await db.emailDemo.findMany({
      where: {
        dossier: "INBOX",
        OR: [
          { de: { contains: terme, mode: "insensitive" } },
          { deEmail: { contains: terme, mode: "insensitive" } },
          ...(fromMatch
            ? []
            : [
                { sujet: { contains: terme, mode: "insensitive" as const } },
                { corps: { contains: terme, mode: "insensitive" as const } },
              ]),
        ],
      },
      orderBy: { date: "desc" },
      take: maxResultats,
    });
    return rows.map(toSummary);
  }

  async read(id: string, type: "message" | "thread" = "message") {
    if (type === "thread") {
      const first = await db.emailDemo.findUnique({ where: { id } });
      const threadId = first?.threadId ?? id;
      const rows = await db.emailDemo.findMany({ where: { threadId }, orderBy: { date: "asc" } });
      await db.emailDemo.updateMany({ where: { threadId, dossier: "INBOX" }, data: { lu: true } });
      return {
        messages: rows.map((e) => ({
          ...toSummary(e),
          a: e.a,
          corps: e.corps,
        })),
      };
    }
    const e = await db.emailDemo.findUnique({ where: { id } });
    if (!e) throw new Error("Email de démonstration introuvable.");
    await db.emailDemo.update({ where: { id }, data: { lu: true } });
    const detail: EmailDetail = { ...toSummary(e), a: e.a, corps: e.corps };
    return detail;
  }

  async createDraft({ threadId, destinataire, sujet, corps }: { threadId: string; destinataire: string; sujet?: string; corps: string }) {
    const brouillonId = `demo-brouillon-${Date.now()}`;
    brouillonsEnMemoire.set(brouillonId, { destinataire, sujet, corps, threadId });
    return { brouillonId };
  }

  async send(input: { brouillonId?: string; destinataire?: string; sujet?: string; corps?: string; threadId?: string }) {
    const contenu = input.brouillonId ? brouillonsEnMemoire.get(input.brouillonId) : input;
    if (!contenu?.destinataire || !contenu?.corps) {
      throw new Error("Contenu de l'email introuvable pour l'envoi (démo).");
    }
    const threadId = contenu.threadId ?? `demo-thread-${Date.now()}`;

    const envoye = await db.emailDemo.create({
      data: {
        threadId,
        de: "Moi (NOTEO)",
        deEmail: "moi@noteo.ai",
        a: contenu.destinataire,
        sujet: contenu.sujet ?? "(sans objet)",
        corps: contenu.corps,
        extrait: contenu.corps.slice(0, 140),
        date: new Date(),
        lu: true,
        dossier: "SENT",
      },
    });

    if (contenu.threadId) {
      await db.emailDemo.updateMany({ where: { threadId: contenu.threadId }, data: { repondu: true } });
    }
    if (input.brouillonId) brouillonsEnMemoire.delete(input.brouillonId);

    return { envoye: true, id: envoye.id };
  }

  async sendAvecPieceJointe({
    destinataire,
    sujet,
    corps,
    piecesJointes,
  }: {
    destinataire: string;
    sujet: string;
    corps: string;
    piecesJointes: { filename: string }[];
  }) {
    const noteAttachment = `\n\n[Pièce jointe (démo) : ${piecesJointes.map((p) => p.filename).join(", ")}]`;
    const envoye = await db.emailDemo.create({
      data: {
        threadId: `demo-thread-${Date.now()}`,
        de: "Moi (NOTEO)",
        deEmail: "moi@noteo.ai",
        a: destinataire,
        sujet,
        corps: corps + noteAttachment,
        extrait: (corps + noteAttachment).slice(0, 140),
        date: new Date(),
        lu: true,
        dossier: "SENT",
      },
    });
    return { envoye: true, id: envoye.id };
  }
}
