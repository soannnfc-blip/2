import { calendarClient } from "@/lib/google";
import type { ToolDefinition } from "./types";

const CALENDAR_ID = "primary";

export const listerEvenements: ToolDefinition = {
  name: "lister_evenements",
  description: "Liste les événements de l'agenda Google Calendar entre deux dates (ISO 8601).",
  input_schema: {
    type: "object",
    properties: {
      debut: { type: "string", description: "Date/heure de début ISO 8601" },
      fin: { type: "string", description: "Date/heure de fin ISO 8601" },
    },
    required: ["debut", "fin"],
  },
  handler: async ({ debut, fin }) => {
    const cal = await calendarClient();
    const res = await cal.events.list({
      calendarId: CALENDAR_ID,
      timeMin: debut,
      timeMax: fin,
      singleEvents: true,
      orderBy: "startTime",
    });
    return {
      evenements: (res.data.items ?? []).map((e) => ({
        id: e.id,
        titre: e.summary,
        debut: e.start?.dateTime ?? e.start?.date,
        fin: e.end?.dateTime ?? e.end?.date,
        lieu: e.location,
        description: e.description,
      })),
    };
  },
};

export const creerEvenement: ToolDefinition = {
  name: "creer_evenement",
  description: "Crée un événement dans Google Calendar. Nécessite confirmation utilisateur.",
  input_schema: {
    type: "object",
    properties: {
      titre: { type: "string" },
      debut: { type: "string", description: "ISO 8601 avec fuseau horaire" },
      fin: { type: "string", description: "ISO 8601 avec fuseau horaire" },
      description: { type: "string" },
      lieu: { type: "string" },
    },
    required: ["titre", "debut", "fin"],
  },
  handler: async ({ titre, debut, fin, description, lieu }) => {
    const cal = await calendarClient();
    const res = await cal.events.insert({
      calendarId: CALENDAR_ID,
      requestBody: {
        summary: titre,
        description,
        location: lieu,
        start: { dateTime: debut },
        end: { dateTime: fin },
      },
    });
    return { id: res.data.id, lien: res.data.htmlLink };
  },
};

export const modifierEvenement: ToolDefinition = {
  name: "modifier_evenement",
  description: "Modifie un événement existant dans Google Calendar. Nécessite confirmation utilisateur.",
  input_schema: {
    type: "object",
    properties: {
      id: { type: "string" },
      titre: { type: "string" },
      debut: { type: "string" },
      fin: { type: "string" },
      description: { type: "string" },
      lieu: { type: "string" },
    },
    required: ["id"],
  },
  handler: async ({ id, titre, debut, fin, description, lieu }) => {
    const cal = await calendarClient();
    const patch: Record<string, unknown> = {};
    if (titre) patch.summary = titre;
    if (description) patch.description = description;
    if (lieu) patch.location = lieu;
    if (debut) patch.start = { dateTime: debut };
    if (fin) patch.end = { dateTime: fin };

    const res = await cal.events.patch({ calendarId: CALENDAR_ID, eventId: id, requestBody: patch });
    return { id: res.data.id, lien: res.data.htmlLink };
  },
};

export const supprimerEvenement: ToolDefinition = {
  name: "supprimer_evenement",
  description: "Supprime définitivement un événement de Google Calendar. Action irréversible — confirmation forte requise.",
  input_schema: {
    type: "object",
    properties: { id: { type: "string" } },
    required: ["id"],
  },
  handler: async ({ id }) => {
    const cal = await calendarClient();
    await cal.events.delete({ calendarId: CALENDAR_ID, eventId: id });
    return { supprime: true };
  },
};

export const agendaTools = [listerEvenements, creerEvenement, modifierEvenement, supprimerEvenement];
