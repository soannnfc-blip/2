// Couche d'abstraction connecteurs : permet aux outils IA de fonctionner soit contre
// de vraies données (Gmail, Google Calendar) soit contre des données de démonstration,
// sans que le reste de l'application (outils, moteur conversationnel) ait à le savoir.

export type EmailSummary = {
  id: string;
  threadId: string | null;
  de: string;
  deEmail: string;
  sujet: string;
  date: string;
  extrait: string;
  nonLu: boolean;
  important: boolean;
};

export type EmailDetail = EmailSummary & {
  a: string;
  corps: string;
};

export interface MailProvider {
  readonly source: "gmail" | "demo";
  search(query: string, maxResultats?: number): Promise<EmailSummary[]>;
  read(id: string, type?: "message" | "thread"): Promise<EmailDetail | { messages: EmailDetail[] }>;
  createDraft(input: { threadId: string; destinataire: string; sujet?: string; corps: string }): Promise<{
    brouillonId: string;
  }>;
  send(input: {
    brouillonId?: string;
    destinataire?: string;
    sujet?: string;
    corps?: string;
    threadId?: string;
  }): Promise<{ envoye: boolean; id: string }>;
  sendAvecPieceJointe(input: {
    destinataire: string;
    sujet: string;
    corps: string;
    piecesJointes: { filename: string; mimeType: string; content: Buffer }[];
  }): Promise<{ envoye: boolean; id: string }>;
}

export type CalendarEvent = {
  id: string;
  titre: string;
  debut: string;
  fin: string | null;
  lieu?: string | null;
  description?: string | null;
};

export interface CalendarProvider {
  readonly source: "google" | "demo";
  list(debut: string, fin: string): Promise<CalendarEvent[]>;
  create(input: { titre: string; debut: string; fin: string; description?: string; lieu?: string }): Promise<CalendarEvent>;
  update(
    id: string,
    patch: { titre?: string; debut?: string; fin?: string; description?: string; lieu?: string }
  ): Promise<CalendarEvent>;
  remove(id: string): Promise<void>;
}
