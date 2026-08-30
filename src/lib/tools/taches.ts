import { db } from "@/lib/db";
import type { ToolDefinition } from "./types";

export const creerTache: ToolDefinition = {
  name: "creer_tache",
  description: "Crée une tâche à suivre pour l'utilisateur. Nécessite confirmation.",
  input_schema: {
    type: "object",
    properties: {
      titre: { type: "string" },
      description: { type: "string" },
      date_limite: { type: "string", description: "ISO 8601" },
      priorite: { type: "string", enum: ["basse", "normale", "haute"] },
    },
    required: ["titre"],
  },
  handler: async ({ titre, description, date_limite, priorite }) => {
    const tache = await db.tache.create({
      data: {
        titre,
        description,
        dateLimite: date_limite ? new Date(date_limite) : undefined,
        priorite: priorite ?? "normale",
      },
    });
    return { id: tache.id };
  },
};

export const listerTaches: ToolDefinition = {
  name: "lister_taches",
  description: "Liste les tâches en cours, en particulier celles en retard ou prioritaires.",
  input_schema: { type: "object", properties: { statut: { type: "string" } } },
  handler: async ({ statut }) => {
    const taches = await db.tache.findMany({
      where: statut ? { statut: statut as any } : { statut: { not: "TERMINEE" } },
      orderBy: [{ dateLimite: "asc" }],
    });
    const maintenant = new Date();
    return {
      taches: taches.map((t) => ({
        id: t.id,
        titre: t.titre,
        priorite: t.priorite,
        statut: t.statut,
        dateLimite: t.dateLimite,
        enRetard: t.dateLimite ? t.dateLimite < maintenant && t.statut !== "TERMINEE" : false,
      })),
    };
  },
};

export const tacheTools = [creerTache, listerTaches];
