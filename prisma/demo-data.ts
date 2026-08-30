import { PrismaClient } from "@prisma/client";
import { subDays, addDays, setHours, setMinutes } from "date-fns";

function heure(date: Date, h: number, m = 0) {
  return setMinutes(setHours(date, h), m);
}

export async function seedDemoData(db: PrismaClient) {
  const now = new Date();

  // --- Clients (avec homonymes volontaires pour démontrer la désambiguïsation) ---
  const clientsData = [
    { id: "demo-client-julien-noteo", nom: "Julien Notéo", email: "julien.noteo@example.com", telephone: "06 12 34 56 78" },
    { id: "demo-client-julien-martin", nom: "Julien Martin", email: "julien.martin@example.com", telephone: "06 23 45 67 89" },
    { id: "demo-client-julien-dupont", nom: "Julien Dupont", email: "julien.dupont@example.com", telephone: "06 34 56 78 90" },
    { id: "demo-client-sophie-lambert", nom: "Sophie Lambert", email: "sophie.lambert@example.com", telephone: "06 45 67 89 01" },
    { id: "demo-client-marc-girard", nom: "Marc Girard", email: "marc.girard@example.com", telephone: "06 56 78 90 12" },
    { id: "demo-client-camille-petit", nom: "Camille Petit", email: "camille.petit@example.com", telephone: "06 67 89 01 23" },
    { id: "demo-client-nabil-haddad", nom: "Nabil Haddad", email: "nabil.haddad@example.com", telephone: "06 78 90 12 34" },
    { id: "demo-client-lea-fontaine", nom: "Léa Fontaine", email: "lea.fontaine@example.com", telephone: "06 89 01 23 45" },
  ];
  for (const c of clientsData) {
    await db.client.upsert({ where: { id: c.id }, update: {}, create: { ...c, source: "manuel" } });
  }

  // --- Catalogue produits ---
  const produitsData = [
    { id: "demo-produit-nfc-standard", nom: "Carte NFC Standard", prix: 25, categorie: "carte" },
    { id: "demo-produit-nfc-premium", nom: "Carte NFC Premium", prix: 45, categorie: "carte" },
    { id: "demo-produit-nfc-business", nom: "Carte NFC Business", prix: 60, categorie: "carte" },
    { id: "demo-produit-pack10", nom: "Pack 10 cartes NFC", prix: 400, categorie: "pack" },
    { id: "demo-produit-config", nom: "Configuration profil digital", prix: 15, categorie: "service" },
    { id: "demo-produit-support", nom: "Support socle carte", prix: 12, categorie: "accessoire" },
  ];
  for (const p of produitsData) {
    await db.produit.upsert({ where: { id: p.id }, update: {}, create: { ...p, stock: 50 } });
  }

  // --- Ventes : réparties sur les 6 dernières semaines + quelques-unes aujourd'hui ---
  await db.vente.deleteMany({ where: { id: { startsWith: "demo-vente-" } } });
  const ventesData: { joursAvant: number; montant: number; clientId?: string; produitId?: string; source: "MANUELLE" | "SHOPIFY"; moyen?: string }[] = [
    { joursAvant: 0, montant: 60, clientId: "demo-client-julien-noteo", produitId: "demo-produit-nfc-business", source: "MANUELLE", moyen: "carte" },
    { joursAvant: 0, montant: 25, produitId: "demo-produit-nfc-standard", source: "MANUELLE", moyen: "especes" },
    { joursAvant: 1, montant: 45, clientId: "demo-client-sophie-lambert", produitId: "demo-produit-nfc-premium", source: "SHOPIFY" },
    { joursAvant: 2, montant: 400, clientId: "demo-client-marc-girard", produitId: "demo-produit-pack10", source: "MANUELLE", moyen: "virement" },
    { joursAvant: 3, montant: 25, produitId: "demo-produit-nfc-standard", source: "SHOPIFY" },
    { joursAvant: 4, montant: 60, clientId: "demo-client-nabil-haddad", produitId: "demo-produit-nfc-business", source: "SHOPIFY" },
    { joursAvant: 5, montant: 15, clientId: "demo-client-camille-petit", produitId: "demo-produit-config", source: "MANUELLE", moyen: "carte" },
    { joursAvant: 7, montant: 45, produitId: "demo-produit-nfc-premium", source: "SHOPIFY" },
    { joursAvant: 8, montant: 12, produitId: "demo-produit-support", source: "SHOPIFY" },
    { joursAvant: 10, montant: 60, clientId: "demo-client-lea-fontaine", produitId: "demo-produit-nfc-business", source: "MANUELLE", moyen: "carte" },
    { joursAvant: 12, montant: 25, produitId: "demo-produit-nfc-standard", source: "SHOPIFY" },
    { joursAvant: 14, montant: 400, clientId: "demo-client-julien-martin", produitId: "demo-produit-pack10", source: "MANUELLE", moyen: "virement" },
    { joursAvant: 16, montant: 45, produitId: "demo-produit-nfc-premium", source: "SHOPIFY" },
    { joursAvant: 18, montant: 60, produitId: "demo-produit-nfc-business", source: "SHOPIFY" },
    { joursAvant: 21, montant: 25, produitId: "demo-produit-nfc-standard", source: "MANUELLE", moyen: "especes" },
    { joursAvant: 25, montant: 45, produitId: "demo-produit-nfc-premium", source: "SHOPIFY" },
    { joursAvant: 30, montant: 60, clientId: "demo-client-julien-dupont", produitId: "demo-produit-nfc-business", source: "MANUELLE", moyen: "carte" },
    { joursAvant: 35, montant: 400, produitId: "demo-produit-pack10", source: "SHOPIFY" },
    { joursAvant: 40, montant: 25, produitId: "demo-produit-nfc-standard", source: "SHOPIFY" },
    { joursAvant: 44, montant: 45, produitId: "demo-produit-nfc-premium", source: "MANUELLE", moyen: "virement" },
  ];
  for (let i = 0; i < ventesData.length; i++) {
    const v = ventesData[i];
    await db.vente.create({
      data: {
        id: `demo-vente-${i}`,
        clientId: v.clientId,
        produitId: v.produitId,
        montant: v.montant,
        moyenPaiement: v.moyen ?? (v.source === "SHOPIFY" ? "shopify" : "carte"),
        source: v.source,
        statut: "PAYEE",
        shopifyOrderId: v.source === "SHOPIFY" ? `demo-shopify-${1000 + i}` : undefined,
        date: subDays(now, v.joursAvant),
      },
    });
  }

  // --- Dépenses (mois en cours + mois précédent) ---
  await db.depense.deleteMany({ where: { id: { startsWith: "demo-depense-" } } });
  const depensesData = [
    { id: "demo-depense-loyer", description: "Loyer atelier", categorie: "loyer", montant: 400, joursAvant: 5 },
    { id: "demo-depense-materiel", description: "Réassort cartes vierges NFC", categorie: "materiel", montant: 150, joursAvant: 12 },
    { id: "demo-depense-logiciel", description: "Abonnement logiciel facturation", categorie: "logiciel", montant: 39, joursAvant: 20 },
    { id: "demo-depense-marketing", description: "Publicité réseaux sociaux", categorie: "marketing", montant: 80, joursAvant: 8 },
    { id: "demo-depense-loyer-precedent", description: "Loyer atelier", categorie: "loyer", montant: 400, joursAvant: 35 },
    { id: "demo-depense-materiel-precedent", description: "Achat imprimante cartes", categorie: "materiel", montant: 220, joursAvant: 40 },
  ];
  for (const d of depensesData) {
    await db.depense.upsert({
      where: { id: d.id },
      update: {},
      create: { id: d.id, description: d.description, categorie: d.categorie, montant: d.montant, date: subDays(now, d.joursAvant) },
    });
  }

  // --- Emails de démonstration (avec les 3 Julien en homonymes) ---
  await db.emailDemo.deleteMany({ where: { id: { startsWith: "demo-email-" } } });
  const emailsData = [
    {
      id: "demo-email-1", threadId: "demo-thread-1", de: "Julien Notéo", deEmail: "julien.noteo@example.com",
      sujet: "Question sur ma carte NFC", extrait: "Bonjour, ma carte ne se scanne plus depuis hier, pouvez-vous...",
      corps: "Bonjour,\n\nMa carte NFC Business ne se scanne plus depuis hier soir. J'ai un événement important demain, pouvez-vous m'aider rapidement ?\n\nMerci,\nJulien Notéo",
      joursAvant: 0, lu: false, important: true,
    },
    {
      id: "demo-email-2", threadId: "demo-thread-2", de: "Julien Martin", deEmail: "julien.martin@example.com",
      sujet: "Facture de janvier ?", extrait: "Bonjour, je n'ai pas reçu la facture pour ma dernière commande...",
      corps: "Bonjour,\n\nJe n'ai pas encore reçu la facture pour ma commande du pack de 10 cartes. Pouvez-vous me l'envoyer ?\n\nCordialement,\nJulien Martin",
      joursAvant: 1, lu: false, important: false,
    },
    {
      id: "demo-email-3", threadId: "demo-thread-3", de: "Julien Dupont", deEmail: "julien.dupont@example.com",
      sujet: "Problème de configuration du profil", extrait: "Le lien de mon profil digital renvoie une erreur 404...",
      corps: "Bonjour,\n\nLe lien de mon profil digital sur ma carte NFC Business renvoie une erreur 404 depuis ce matin. C'est assez urgent, je l'utilise pour un salon professionnel demain.\n\nJulien Dupont",
      joursAvant: 0, lu: false, important: true,
    },
    {
      id: "demo-email-4", threadId: "demo-thread-4", de: "Sophie Lambert", deEmail: "sophie.lambert@example.com",
      sujet: "Merci pour la livraison !", extrait: "Tout est bien arrivé, super qualité, merci beaucoup...",
      corps: "Bonjour,\n\nTout est bien arrivé, la qualité est top ! Je recommanderai sans hésiter.\n\nMerci,\nSophie",
      joursAvant: 2, lu: true, important: false,
    },
    {
      id: "demo-email-5", threadId: "demo-thread-5", de: "Marc Girard", deEmail: "marc.girard@example.com",
      sujet: "Devis pour 20 cartes Business", extrait: "Bonjour, nous souhaitons équiper toute notre équipe commerciale...",
      corps: "Bonjour,\n\nNous souhaitons équiper toute notre équipe commerciale (20 personnes) en cartes NFC Business. Pouvez-vous m'envoyer un devis avec une remise quantité ?\n\nMarc Girard, Directeur commercial",
      joursAvant: 1, lu: false, important: true,
    },
    {
      id: "demo-email-6", threadId: "demo-thread-6", de: "Cartes Pro Fournisseur", deEmail: "commandes@cartes-pro.fr",
      sujet: "Confirmation de commande #4521", extrait: "Votre commande de cartes vierges a bien été expédiée...",
      corps: "Bonjour,\n\nVotre commande #4521 (200 cartes NFC vierges) a été expédiée. Livraison estimée sous 3 jours.\n\nCartes Pro",
      joursAvant: 3, lu: true, important: false,
    },
    {
      id: "demo-email-7", threadId: "demo-thread-7", de: "Camille Petit", deEmail: "camille.petit@example.com",
      sujet: "Annulation de rendez-vous", extrait: "Je ne pourrai malheureusement pas venir jeudi, pouvons-nous...",
      corps: "Bonjour,\n\nJe ne pourrai finalement pas venir jeudi à 14h. Pouvons-nous reporter à la semaine prochaine ?\n\nCamille",
      joursAvant: 1, lu: false, important: false,
    },
    {
      id: "demo-email-8", threadId: "demo-thread-8", de: "Shopify", deEmail: "noreply@shopify.com",
      sujet: "Nouvelle commande #1082", extrait: "Vous avez reçu une nouvelle commande sur votre boutique...",
      corps: "Vous avez reçu une nouvelle commande #1082 pour un montant de 45,00€.",
      joursAvant: 1, lu: true, important: false,
    },
    {
      id: "demo-email-9", threadId: "demo-thread-9", de: "Nabil Haddad", deEmail: "nabil.haddad@example.com",
      sujet: "Retour sur le produit", extrait: "La carte fonctionne très bien mais j'aurais une question sur...",
      corps: "Bonjour,\n\nLa carte fonctionne très bien ! J'aurais juste une question : est-il possible de changer les informations du profil après achat ?\n\nNabil",
      joursAvant: 2, lu: false, important: true,
    },
    {
      id: "demo-email-10", threadId: "demo-thread-10", de: "Léa Fontaine", deEmail: "lea.fontaine@example.com",
      sujet: "Merci !", extrait: "Un grand merci pour votre réactivité, tout est parfait...",
      corps: "Bonjour,\n\nUn grand merci pour votre réactivité, tout est parfait !\n\nLéa",
      joursAvant: 5, lu: true, important: false,
    },
    {
      id: "demo-email-11", threadId: "demo-thread-11", de: "Julien Notéo", deEmail: "julien.noteo@example.com",
      sujet: "Merci pour le dépannage", extrait: "Tout refonctionne, merci beaucoup pour la réactivité...",
      corps: "Bonjour,\n\nTout refonctionne parfaitement, merci beaucoup pour votre réactivité !\n\nJulien",
      joursAvant: 6, lu: true, important: false,
    },
  ];
  for (const e of emailsData) {
    await db.emailDemo.create({
      data: {
        id: e.id, threadId: e.threadId, de: e.de, deEmail: e.deEmail, sujet: e.sujet,
        corps: e.corps, extrait: e.extrait, date: subDays(now, e.joursAvant), lu: e.lu, important: e.important,
      },
    });
  }

  // --- Agenda ---
  await db.evenement.deleteMany({ where: { googleEventId: { startsWith: "demo-" } } });
  const evenementsData = [
    { id: "demo-evt-1", titre: "Rendez-vous avec Julien Notéo", description: "Dépannage carte NFC", debut: heure(addDays(now, 1), 15), fin: heure(addDays(now, 1), 16), important: true },
    { id: "demo-evt-2", titre: "Livraison fournisseur Cartes Pro", debut: heure(addDays(now, 2), 10), fin: heure(addDays(now, 2), 10, 30), important: false },
    { id: "demo-evt-3", titre: "Salon Entrepreneurs Amiens", description: "Stand NOTEO", debut: heure(addDays(now, 6), 9), fin: heure(addDays(now, 6), 18), important: true },
    { id: "demo-evt-4", titre: "Appel devis Marc Girard", debut: heure(addDays(now, 3), 11), fin: heure(addDays(now, 3), 11, 30), important: true },
    { id: "demo-evt-5", titre: "Relance stock cartes vierges", debut: heure(addDays(now, 4), 9), fin: heure(addDays(now, 4), 9, 15), important: false },
  ];
  for (const e of evenementsData) {
    await db.evenement.create({
      data: { googleEventId: e.id, titre: e.titre, description: e.description, debut: e.debut, fin: e.fin, important: e.important },
    });
  }

  // --- Tâches ---
  await db.tache.deleteMany({ where: { id: { startsWith: "demo-tache-" } } });
  const tachesData = [
    { id: "demo-tache-1", titre: "Relancer la facture de Sophie Lambert", priorite: "haute", dateLimite: subDays(now, 2), statut: "A_FAIRE" as const },
    { id: "demo-tache-2", titre: "Commander du stock de cartes NFC", priorite: "haute", dateLimite: addDays(now, 2), statut: "A_FAIRE" as const },
    { id: "demo-tache-3", titre: "Préparer le stand pour le salon", priorite: "normale", dateLimite: addDays(now, 5), statut: "EN_COURS" as const },
    { id: "demo-tache-4", titre: "Répondre au devis de Marc Girard", priorite: "haute", dateLimite: subDays(now, 1), statut: "A_FAIRE" as const },
  ];
  for (const t of tachesData) {
    await db.tache.upsert({
      where: { id: t.id },
      update: {},
      create: { id: t.id, titre: t.titre, priorite: t.priorite, dateLimite: t.dateLimite, statut: t.statut },
    });
  }

  // --- Préférences entreprise (pour un PDF de facture propre) ---
  const preferences: Record<string, string> = {
    nom_entreprise: "NOTEO",
    adresse_entreprise: "12 rue des Artisans, 80000 Amiens",
    email_entreprise: "contact@noteo.fr",
    siret_entreprise: "123 456 789 00012",
  };
  for (const [cle, valeur] of Object.entries(preferences)) {
    await db.preference.upsert({ where: { cle }, update: {}, create: { cle, valeur } });
  }

  // --- Une facture déjà envoyée et impayée depuis longtemps (pour l'alerte proactive) ---
  const factureDemoId = "demo-facture-impayee";
  const existante = await db.facture.findUnique({ where: { id: factureDemoId } });
  if (!existante) {
    await db.facture.create({
      data: {
        id: factureDemoId,
        numero: "FAC-DEMO-0001",
        clientId: "demo-client-julien-martin",
        montantTotal: 400,
        statut: "ENVOYEE",
        envoyeeLe: subDays(now, 20),
        emailEnvoyeA: "julien.martin@example.com",
        items: { create: [{ description: "Pack 10 cartes NFC", quantite: 1, prixUnitaire: 400 }] },
      },
    });
  }
}
