import { db } from "@/lib/db";
import type { ToolDefinition } from "./types";

export const rechercherClient: ToolDefinition = {
  name: "rechercher_client",
  description:
    "Recherche un ou plusieurs clients par nom (prénom seul, nom complet, ou partiel). " +
    "IMPORTANT: si plusieurs clients différents correspondent (homonymes), ils sont TOUS retournés — " +
    "tu dois alors demander à l'utilisateur de préciser lequel avant toute action (vente, facture, email...), " +
    "jamais deviner.",
  input_schema: {
    type: "object",
    properties: { nom: { type: "string", description: "Nom ou prénom à rechercher" } },
    required: ["nom"],
  },
  handler: async ({ nom }) => {
    const clients = await db.client.findMany({
      where: { nom: { contains: nom, mode: "insensitive" } },
      orderBy: { nom: "asc" },
      take: 20,
    });
    return {
      total: clients.length,
      ambigu: clients.length > 1,
      clients: clients.map((c) => ({
        id: c.id,
        nom: c.nom,
        email: c.email,
        telephone: c.telephone,
      })),
    };
  },
};

export const clientTools = [rechercherClient];
