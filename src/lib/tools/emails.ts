import { getMailProvider } from "@/lib/providers/mail";
import type { ToolDefinition } from "./types";

function estRequeteAvecOperateur(q: string) {
  return /^(is:|from:|to:|subject:|label:)/i.test(q.trim());
}

export const rechercherEmails: ToolDefinition = {
  name: "rechercher_emails",
  description:
    "Recherche des emails par mot-clé, nom d'expéditeur, sujet, ou requête Gmail avancée (is:unread, is:important, from:...). " +
    "Si la recherche par nom trouve plusieurs personnes différentes (homonymes, adresses email distinctes), " +
    "le résultat contient ambigu=true et la liste des expéditeurs distincts — dans ce cas, énumère-les et demande " +
    "à l'utilisateur de préciser avant d'aller plus loin. Ne devine jamais laquelle choisir.",
  input_schema: {
    type: "object",
    properties: {
      requete: { type: "string", description: "Terme de recherche ou requête (ex: 'Julien', 'is:unread', 'from:julien@...')" },
      max_resultats: { type: "number", description: "Nombre max de résultats (défaut 10)" },
    },
    required: ["requete"],
  },
  handler: async ({ requete, max_resultats = 10 }) => {
    const provider = await getMailProvider();
    const emails = await provider.search(requete, max_resultats);

    // Détection d'homonymes : recherche par nom simple (pas un opérateur Gmail) qui
    // touche plusieurs expéditeurs distincts.
    if (requete.trim() && !estRequeteAvecOperateur(requete)) {
      const distincts = new Map<string, { nom: string; email: string }>();
      for (const e of emails) distincts.set(e.deEmail, { nom: e.de, email: e.deEmail });
      if (distincts.size > 1) {
        return {
          ambigu: true,
          expediteurs: Array.from(distincts.values()),
          message: "Plusieurs expéditeurs différents correspondent — demande à l'utilisateur de préciser lequel.",
        };
      }
    }

    return { total: emails.length, ambigu: false, emails, source: provider.source };
  },
};

export const lireEmail: ToolDefinition = {
  name: "lire_email",
  description: "Lit le contenu complet d'un email ou d'une conversation (thread) à partir de son id.",
  input_schema: {
    type: "object",
    properties: {
      id: { type: "string", description: "id du message ou du thread" },
      type: { type: "string", enum: ["message", "thread"], description: "défaut: message" },
    },
    required: ["id"],
  },
  handler: async ({ id, type = "message" }) => {
    const provider = await getMailProvider();
    return provider.read(id, type);
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
    "Crée un BROUILLON de réponse (dans le thread d'origine) sans l'envoyer. " +
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
    const provider = await getMailProvider();
    const draft = await provider.createDraft({ threadId: thread_id, destinataire, sujet, corps });
    return { brouillonId: draft.brouillonId, message: "Brouillon créé, en attente d'envoi." };
  },
};

export const envoyerEmail: ToolDefinition = {
  name: "envoyer_email",
  description:
    "Envoie réellement un email (ou un brouillon existant). Nécessite une confirmation utilisateur préalable. " +
    "En mode démonstration, l'email n'est pas réellement transmis : il est enregistré comme envoyé dans les données de démo.",
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
    const provider = await getMailProvider();
    const res = await provider.send({ brouillonId: brouillon_id, destinataire, sujet, corps, threadId: thread_id });
    return { ...res, demo: provider.source === "demo" };
  },
};

export const emailTools = [rechercherEmails, lireEmail, resumerEmail, redigerReponseEmail, envoyerEmail];
