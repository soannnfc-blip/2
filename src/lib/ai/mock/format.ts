export function eur(n: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
}

export function dateFr(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
}

export function formatEmails(result: any): string {
  if (result.ambigu) {
    const noms = result.expediteurs.map((e: any) => e.nom).join(", ");
    return `J'ai trouvé plusieurs personnes différentes : ${noms}. De laquelle veux-tu voir les mails ?`;
  }
  if (!result.emails || result.emails.length === 0) return "Je n'ai trouvé aucun email correspondant.";
  const lignes = result.emails
    .slice(0, 8)
    .map((e: any) => `• ${e.important ? "⚠️ " : ""}${e.nonLu ? "**" : ""}${e.de}${e.nonLu ? "**" : ""} — "${e.sujet}" (${e.extrait.slice(0, 60)}…)`)
    .join("\n");
  return `J'ai trouvé ${result.emails.length} email${result.emails.length > 1 ? "s" : ""} :\n${lignes}`;
}

export function formatEmailDetail(result: any): string {
  if (result.messages) {
    const dernier = result.messages[result.messages.length - 1];
    return `Voici la conversation avec ${dernier.de} (${result.messages.length} message${result.messages.length > 1 ? "s" : ""}) : "${dernier.corps.slice(0, 400)}"`;
  }
  return `Email de ${result.de}, sujet "${result.sujet}" :\n${result.corps.slice(0, 500)}`;
}

export function formatClients(result: any): string {
  if (result.total === 0) return "Je n'ai trouvé aucun client correspondant.";
  if (result.ambigu) {
    const noms = result.clients.map((c: any) => c.nom).join(", ");
    return `J'ai trouvé ${result.total} clients qui correspondent : ${noms}. Lequel veux-tu dire ?`;
  }
  const c = result.clients[0];
  return `J'ai trouvé ${c.nom}${c.email ? ` (${c.email})` : ""}.`;
}

export function formatDashboard(result: any): string {
  const evolution =
    result.evolution_ca_mois_pourcent === null
      ? ""
      : ` (${result.evolution_ca_mois_pourcent >= 0 ? "+" : ""}${result.evolution_ca_mois_pourcent}% vs le mois dernier)`;
  const top = result.produits_plus_vendus?.[0];
  return (
    `CA aujourd'hui : ${eur(result.ca_jour)} · cette semaine : ${eur(result.ca_semaine)} · ce mois : ${eur(result.ca_mois)}${evolution} · cette année : ${eur(result.ca_annee)}.\n` +
    `${result.commandes_mois} commande${result.commandes_mois > 1 ? "s" : ""} ce mois-ci, panier moyen ${eur(result.panier_moyen_mois)}.` +
    (top ? ` Le produit qui marche le mieux : ${top.nom} (${eur(top.ca)}).` : "") +
    `\nDépenses du mois : ${eur(result.depenses_mois)} · marge estimée : ${eur(result.marge_estimee_mois)} · cotisations estimées : ${eur(result.cotisations_estimees_mois)} (${result.cotisations_estimees_note})`
  );
}

export function formatVentes(result: any): string {
  if (!result.ventes || result.ventes.length === 0) return "Aucune vente sur cette période.";
  const total = result.ventes.reduce((s: number, v: any) => s + parseFloat(v.montant), 0);
  const lignes = result.ventes
    .slice(0, 8)
    .map((v: any) => `• ${eur(parseFloat(v.montant))} — ${v.client ?? "Client inconnu"} (${v.description ?? "vente"})`)
    .join("\n");
  return `${result.ventes.length} vente${result.ventes.length > 1 ? "s" : ""} pour un total de ${eur(total)} :\n${lignes}`;
}

export function formatVenteAjoutee(result: any, montant: number, client?: string): string {
  return `Vente de ${eur(montant)} enregistrée${client ? ` pour ${client}` : ""}. Le dashboard est à jour.`;
}

export function formatFactureGeneree(result: any): string {
  if (result.erreur) return `Je n'ai pas pu générer la facture : ${result.erreur}`;
  return (
    `J'ai préparé la facture ${result.numero} pour ${result.client} — ${eur(result.montant_total)}. ` +
    (result.client_email
      ? `Veux-tu que je l'envoie à ${result.client_email} ?`
      : `Je n'ai pas d'adresse email pour ce client, donne-la moi si tu veux que je l'envoie.`)
  );
}

export function formatFactureEnvoyee(result: any): string {
  if (result.erreur) return `Je n'ai pas pu envoyer la facture : ${result.erreur}`;
  return `Facture envoyée à ${result.destinataire}${result.demo ? " (mode démo — aucun email réel n'a été transmis)" : ""}.`;
}

export function formatEvenements(result: any): string {
  if (!result.evenements || result.evenements.length === 0) return "Aucun rendez-vous sur cette période.";
  const lignes = result.evenements.map((e: any) => `• ${dateFr(e.debut)} — ${e.titre}`).join("\n");
  return `${result.evenements.length} rendez-vous :\n${lignes}`;
}

export function formatEvenementCree(result: any): string {
  return `Rendez-vous "${result.titre}" ajouté le ${dateFr(result.debut)}.`;
}

export function formatTaches(result: any): string {
  if (!result.taches || result.taches.length === 0) return "Aucune tâche en cours, tout est à jour.";
  const enRetard = result.taches.filter((t: any) => t.enRetard);
  const lignes = result.taches
    .slice(0, 8)
    .map((t: any) => `• ${t.enRetard ? "⚠️ " : ""}${t.titre}${t.dateLimite ? ` (${dateFr(t.dateLimite)})` : ""}`)
    .join("\n");
  return `${result.taches.length} tâche${result.taches.length > 1 ? "s" : ""}${enRetard.length ? `, dont ${enRetard.length} en retard` : ""} :\n${lignes}`;
}
