import { db } from "@/lib/db";
import { genererFacturePdf } from "@/lib/facture-pdf";
import { saveFactureBuffer } from "@/lib/storage";
import { getMailProvider } from "@/lib/providers/mail";
import { readFile } from "fs/promises";
import type { ToolDefinition } from "./types";

async function preference(cle: string, defaut: string) {
  const p = await db.preference.findUnique({ where: { cle } });
  return p?.valeur ?? defaut;
}

async function prochainNumero() {
  const annee = new Date().getFullYear();
  const count = await db.facture.count({ where: { numero: { startsWith: `FAC-${annee}-` } } });
  return `FAC-${annee}-${String(count + 1).padStart(4, "0")}`;
}

export const creerFacture: ToolDefinition = {
  name: "creer_facture",
  description:
    "Génère une facture professionnelle PDF pour un client (retrouvé au préalable via rechercher_client), " +
    "avec numérotation unique automatique, l'enregistre en base et sur disque. Nécessite confirmation utilisateur. " +
    "Ne propose l'envoi par email qu'après, via envoyer_facture.",
  input_schema: {
    type: "object",
    properties: {
      client_id: { type: "string" },
      vente_id: { type: "string", description: "Vente associée si applicable" },
      items: {
        type: "array",
        description: "Lignes de facture",
        items: {
          type: "object",
          properties: {
            description: { type: "string" },
            quantite: { type: "number" },
            prix_unitaire: { type: "number" },
          },
          required: ["description", "prix_unitaire"],
        },
      },
    },
    required: ["client_id", "items"],
  },
  handler: async ({ client_id, vente_id, items }) => {
    const client = await db.client.findUnique({ where: { id: client_id } });
    if (!client) return { erreur: "Client introuvable." };

    const lignes = items.map((it: any) => ({
      description: it.description,
      quantite: it.quantite ?? 1,
      prixUnitaire: it.prix_unitaire,
    }));
    const montantTotal = lignes.reduce((sum: number, l: any) => sum + l.quantite * l.prixUnitaire, 0);
    const numero = await prochainNumero();

    const nomEntreprise = await preference("nom_entreprise", "Mon entreprise");
    const adresseEntreprise = await preference("adresse_entreprise", "");
    const emailEntreprise = await preference("email_entreprise", "");
    const siret = await preference("siret_entreprise", "");

    const pdfBuffer = await genererFacturePdf({
      numero,
      dateEmission: new Date(),
      entreprise: { nom: nomEntreprise, adresse: adresseEntreprise, email: emailEntreprise, siret },
      client: { nom: client.nom, adresse: client.adresse ?? undefined, email: client.email ?? undefined },
      items: lignes,
      montantTotal,
    });

    const pdfPath = await saveFactureBuffer(numero, pdfBuffer);

    const facture = await db.facture.create({
      data: {
        numero,
        clientId: client.id,
        venteId: vente_id ?? undefined,
        montantTotal,
        statut: "BROUILLON",
        pdfPath,
        items: { create: lignes },
      },
    });

    return {
      id: facture.id,
      numero: facture.numero,
      montant_total: montantTotal,
      client: client.nom,
      client_email: client.email,
      pdf_enregistre: pdfPath,
      message: client.email
        ? "Facture générée. Demande confirmation à l'utilisateur avant d'appeler envoyer_facture."
        : "Facture générée, mais aucun email n'est enregistré pour ce client — demande-le avant d'envoyer.",
    };
  },
};

export const envoyerFacture: ToolDefinition = {
  name: "envoyer_facture",
  description:
    "Envoie par email la facture PDF déjà générée au client. Nécessite confirmation utilisateur préalable. " +
    "En mode démonstration, l'email n'est pas réellement transmis : il est enregistré comme envoyé dans les données de démo.",
  input_schema: {
    type: "object",
    properties: {
      facture_id: { type: "string" },
      email_destinataire: { type: "string", description: "Écrase l'email du client si fourni" },
      message: { type: "string", description: "Texte d'accompagnement de l'email" },
    },
    required: ["facture_id"],
  },
  handler: async ({ facture_id, email_destinataire, message }) => {
    const facture = await db.facture.findUnique({ where: { id: facture_id }, include: { client: true } });
    if (!facture) return { erreur: "Facture introuvable." };
    if (!facture.pdfPath) return { erreur: "PDF de facture introuvable." };

    const destinataire = email_destinataire ?? facture.client.email;
    if (!destinataire) return { erreur: "Aucune adresse email pour ce client." };

    const pdfBuffer = await readFile(facture.pdfPath);
    const provider = await getMailProvider();
    await provider.sendAvecPieceJointe({
      destinataire,
      sujet: `Facture ${facture.numero}`,
      corps: message ?? `Bonjour ${facture.client.nom},\n\nVeuillez trouver ci-joint la facture ${facture.numero}.\n\nCordialement.`,
      piecesJointes: [{ filename: `${facture.numero}.pdf`, mimeType: "application/pdf", content: pdfBuffer }],
    });

    await db.facture.update({
      where: { id: facture.id },
      data: { statut: "ENVOYEE", envoyeeLe: new Date(), emailEnvoyeA: destinataire },
    });

    return { envoyee: true, destinataire, demo: provider.source === "demo" };
  },
};

export const factureTools = [creerFacture, envoyerFacture];
