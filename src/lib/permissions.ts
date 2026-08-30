import { NiveauPermission } from "@prisma/client";

/**
 * Classe chaque outil disponible pour l'IA dans un des 3 niveaux demandés :
 * - AUTOMATIQUE : exécuté immédiatement, jamais bloquant (lecture seule / analyse)
 * - CONFIRMATION : une proposition est renvoyée à l'utilisateur, exécution seulement après validation
 * - CONFIRMATION_FORTE : comme CONFIRMATION mais pour les actions sensibles (paiement, suppression définitive)
 */
export const PERMISSIONS: Record<string, NiveauPermission> = {
  // Lecture / analyse — automatique
  rechercher_emails: "AUTOMATIQUE",
  lire_email: "AUTOMATIQUE",
  resumer_email: "AUTOMATIQUE",
  rechercher_client: "AUTOMATIQUE",
  obtenir_dashboard: "AUTOMATIQUE",
  lister_evenements: "AUTOMATIQUE",
  lister_taches: "AUTOMATIQUE",
  lister_ventes: "AUTOMATIQUE",

  // Rédaction sans envoi — automatique (le brouillon n'a pas d'effet externe)
  rediger_reponse_email: "AUTOMATIQUE",

  // Actions à effet externe modéré — confirmation simple
  envoyer_email: "CONFIRMATION",
  creer_evenement: "CONFIRMATION",
  modifier_evenement: "CONFIRMATION",
  ajouter_vente: "CONFIRMATION",
  creer_facture: "CONFIRMATION",
  envoyer_facture: "CONFIRMATION",
  creer_tache: "CONFIRMATION",

  // Actions sensibles / irréversibles — confirmation forte
  supprimer_evenement: "CONFIRMATION_FORTE",
  enregistrer_paiement: "CONFIRMATION_FORTE",
  annuler_facture: "CONFIRMATION_FORTE",
  supprimer_donnee: "CONFIRMATION_FORTE",
};

export function niveauDe(outil: string): NiveauPermission {
  return PERMISSIONS[outil] ?? "CONFIRMATION_FORTE"; // défaut prudent si outil inconnu
}

export function estAutomatique(outil: string): boolean {
  return niveauDe(outil) === "AUTOMATIQUE";
}
