import { db } from "@/lib/db";
import { startOfDay, startOfWeek, startOfMonth, startOfYear, subMonths, endOfMonth } from "date-fns";
import { isShopifyConfigured, listRecentOrders } from "@/lib/shopify";
import type { ToolDefinition } from "./types";

// Taux forfaitaire indicatif de cotisations sociales pour une micro-entreprise de vente/services.
// Volontairement approximatif — présenté à l'utilisateur comme une estimation, pas un calcul fiscal exact.
const TAUX_COTISATIONS_ESTIMEES = 0.22;

export const ajouterVente: ToolDefinition = {
  name: "ajouter_vente",
  description:
    "Enregistre manuellement une nouvelle vente (ex: vente vocale en direct, hors Shopify). " +
    "Met immédiatement à jour les statistiques du dashboard. Nécessite confirmation utilisateur.",
  input_schema: {
    type: "object",
    properties: {
      client_id: { type: "string", description: "id du client si connu (via rechercher_client)" },
      client_nom: { type: "string", description: "Nom du client si pas encore de fiche" },
      description: { type: "string", description: "Ce qui a été vendu" },
      montant: { type: "number" },
      moyen_paiement: { type: "string", enum: ["carte", "especes", "virement", "autre"] },
      date: { type: "string", description: "ISO 8601, défaut: maintenant" },
    },
    required: ["montant", "description"],
  },
  handler: async ({ client_id, client_nom, description, montant, moyen_paiement, date }) => {
    const vente = await db.vente.create({
      data: {
        clientId: client_id ?? undefined,
        clientNomLibre: client_id ? undefined : client_nom,
        description,
        montant,
        moyenPaiement: moyen_paiement,
        source: "MANUELLE",
        statut: "PAYEE",
        date: date ? new Date(date) : new Date(),
      },
    });
    return { id: vente.id, montant: vente.montant.toString(), enregistree: true };
  },
};

export const listerVentes: ToolDefinition = {
  name: "lister_ventes",
  description: "Liste les ventes récentes, avec filtre optionnel par période (ISO 8601).",
  input_schema: {
    type: "object",
    properties: {
      depuis: { type: "string" },
      jusqua: { type: "string" },
      limite: { type: "number" },
    },
  },
  handler: async ({ depuis, jusqua, limite = 50 }) => {
    const ventes = await db.vente.findMany({
      where: {
        date: {
          gte: depuis ? new Date(depuis) : undefined,
          lte: jusqua ? new Date(jusqua) : undefined,
        },
      },
      include: { client: true, produit: true },
      orderBy: { date: "desc" },
      take: limite,
    });
    return {
      ventes: ventes.map((v) => ({
        id: v.id,
        client: v.client?.nom ?? v.clientNomLibre,
        description: v.produit?.nom ?? v.description,
        montant: v.montant.toString(),
        source: v.source,
        date: v.date,
      })),
    };
  },
};

async function sommeEntre(depuis: Date) {
  const res = await db.vente.aggregate({
    where: { date: { gte: depuis }, statut: "PAYEE" },
    _sum: { montant: true },
    _count: true,
  });
  return { total: Number(res._sum.montant ?? 0), commandes: res._count };
}

export const obtenirDashboard: ToolDefinition = {
  name: "obtenir_dashboard",
  description:
    "Retourne les statistiques business en temps réel : CA jour/semaine/mois/année, évolution du CA, nombre de " +
    "commandes, panier moyen, produits les plus vendus, dépenses, marge et cotisations estimées. À utiliser pour " +
    "toute question sur le chiffre d'affaires, les ventes ou la santé financière de l'entreprise.",
  input_schema: { type: "object", properties: {} },
  handler: async () => {
    const now = new Date();
    const debutMoisPrecedent = startOfMonth(subMonths(now, 1));
    const finMoisPrecedent = endOfMonth(subMonths(now, 1));

    const [jour, semaine, mois, annee, moisPrecedent, depensesMoisAgg] = await Promise.all([
      sommeEntre(startOfDay(now)),
      sommeEntre(startOfWeek(now, { weekStartsOn: 1 })),
      sommeEntre(startOfMonth(now)),
      sommeEntre(startOfYear(now)),
      db.vente
        .aggregate({
          where: { date: { gte: debutMoisPrecedent, lte: finMoisPrecedent }, statut: "PAYEE" },
          _sum: { montant: true },
        })
        .then((r) => Number(r._sum.montant ?? 0)),
      db.depense.aggregate({ where: { date: { gte: startOfMonth(now) } }, _sum: { montant: true } }),
    ]);

    const topProduits = await db.vente.groupBy({
      by: ["produitId"],
      where: { produitId: { not: null }, date: { gte: startOfMonth(now) } },
      _sum: { montant: true },
      _count: true,
      orderBy: { _sum: { montant: "desc" } },
      take: 5,
    });
    const produitsDetail = await db.produit.findMany({
      where: { id: { in: topProduits.map((p) => p.produitId!).filter(Boolean) } },
    });

    const depensesMois = Number(depensesMoisAgg._sum.montant ?? 0);
    const margeEstimeeMois = Math.round((mois.total - depensesMois) * 100) / 100;
    const cotisationsEstimeesMois = Math.round(mois.total * TAUX_COTISATIONS_ESTIMEES * 100) / 100;
    const evolutionCaMois = moisPrecedent > 0 ? Math.round(((mois.total - moisPrecedent) / moisPrecedent) * 1000) / 10 : null;

    return {
      ca_jour: jour.total,
      ca_semaine: semaine.total,
      ca_mois: mois.total,
      ca_annee: annee.total,
      ca_mois_precedent: moisPrecedent,
      evolution_ca_mois_pourcent: evolutionCaMois,
      commandes_mois: mois.commandes,
      panier_moyen_mois: mois.commandes > 0 ? Math.round((mois.total / mois.commandes) * 100) / 100 : 0,
      produits_plus_vendus: topProduits.map((p) => ({
        nom: produitsDetail.find((pr) => pr.id === p.produitId)?.nom ?? "?",
        ca: Number(p._sum.montant ?? 0),
        ventes: p._count,
      })),
      depenses_mois: depensesMois,
      marge_estimee_mois: margeEstimeeMois,
      cotisations_estimees_mois: cotisationsEstimeesMois,
      cotisations_estimees_note: "Estimation indicative (taux forfaitaire), à vérifier avec un comptable.",
    };
  },
};

export const synchroniserShopify: ToolDefinition = {
  name: "synchroniser_shopify",
  description:
    "Récupère les commandes récentes de la boutique Shopify et les intègre aux ventes locales (mise à jour, " +
    "pas de doublon). Lecture seule côté Shopify — automatique.",
  input_schema: { type: "object", properties: { limite: { type: "number" } } },
  handler: async ({ limite = 50 }) => {
    if (!isShopifyConfigured()) {
      return { erreur: "Shopify n'est pas encore configuré (SHOPIFY_SHOP_DOMAIN / SHOPIFY_ADMIN_ACCESS_TOKEN)." };
    }
    const orders = await listRecentOrders(limite);
    let importees = 0;
    for (const o of orders) {
      const clientNom = [o.customer?.first_name, o.customer?.last_name].filter(Boolean).join(" ");
      await db.vente.upsert({
        where: { shopifyOrderId: String(o.id) },
        update: { montant: Number(o.total_price), statut: o.financial_status === "paid" ? "PAYEE" : "EN_ATTENTE" },
        create: {
          shopifyOrderId: String(o.id),
          clientNomLibre: clientNom || o.customer?.email || "Client Shopify",
          description: o.line_items.map((li) => li.title).join(", "),
          montant: Number(o.total_price),
          source: "SHOPIFY",
          statut: o.financial_status === "paid" ? "PAYEE" : "EN_ATTENTE",
          date: new Date(o.created_at),
        },
      });
      importees++;
    }
    return { commandes_synchronisees: importees };
  },
};

export const venteTools = [ajouterVente, listerVentes, obtenirDashboard, synchroniserShopify];
