import { getCalendarProvider } from "@/lib/providers/calendar";
import type { ToolDefinition } from "./types";

export const listerEvenements: ToolDefinition = {
  name: "lister_evenements",
  description: "Liste les événements de l'agenda entre deux dates (ISO 8601).",
  input_schema: {
    type: "object",
    properties: {
      debut: { type: "string", description: "Date/heure de début ISO 8601" },
      fin: { type: "string", description: "Date/heure de fin ISO 8601" },
    },
    required: ["debut", "fin"],
  },
  handler: async ({ debut, fin }) => {
    const provider = await getCalendarProvider();
    const evenements = await provider.list(debut, fin);
    return { evenements, source: provider.source };
  },
};

export const creerEvenement: ToolDefinition = {
  name: "creer_evenement",
  description: "Crée un événement dans l'agenda. Nécessite confirmation utilisateur.",
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
  handler: async (input) => {
    const provider = await getCalendarProvider();
    return provider.create(input);
  },
};

export const modifierEvenement: ToolDefinition = {
  name: "modifier_evenement",
  description: "Modifie un événement existant de l'agenda. Nécessite confirmation utilisateur.",
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
  handler: async ({ id, ...patch }) => {
    const provider = await getCalendarProvider();
    return provider.update(id, patch);
  },
};

export const supprimerEvenement: ToolDefinition = {
  name: "supprimer_evenement",
  description: "Supprime définitivement un événement de l'agenda. Action irréversible — confirmation forte requise.",
  input_schema: {
    type: "object",
    properties: { id: { type: "string" } },
    required: ["id"],
  },
  handler: async ({ id }) => {
    const provider = await getCalendarProvider();
    await provider.remove(id);
    return { supprime: true };
  },
};

export const agendaTools = [listerEvenements, creerEvenement, modifierEvenement, supprimerEvenement];
