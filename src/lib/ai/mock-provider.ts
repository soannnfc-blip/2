import { randomUUID } from "crypto";
import { startOfDay, startOfWeek, startOfMonth } from "date-fns";
import { db } from "@/lib/db";
import type { AIConverseArgs, AIConverseResult, AIProvider, AIMessage, AIAssistantContent } from "./types";
import { normaliser, extraireMontant, extraireNomApres, extraireDescriptionArticle, extraireDateHeure, estSalutation } from "./mock/nlu";
import * as fmt from "./mock/format";

/**
 * Moteur conversationnel de démonstration : aucun appel à une IA payante.
 * Reconnaît un jeu de formulations françaises courantes par règles, appelle les VRAIS
 * outils (mêmes handlers que le mode Anthropic) et formule des réponses naturelles à
 * partir des résultats réels. Suffisant pour démontrer le produit de bout en bout ;
 * remplacé par AnthropicAIProvider dès qu'ANTHROPIC_API_KEY est configurée.
 */
export class MockAIProvider implements AIProvider {
  readonly id = "mock" as const;
  readonly label = "Assistant démo (sans IA payante)";

  async converse({ messages, tools }: AIConverseArgs): Promise<AIConverseResult> {
    if (!tools || tools.length === 0) {
      return textContent(await this.tourDeCloture(messages));
    }

    const last = messages[messages.length - 1];
    if (last.role === "user" && typeof last.content === "string") {
      return this.nouveauMessage(messages, last.content);
    }
    return this.continuerApresOutil(messages);
  }

  // --- Tour de clôture : proposition à confirmer, ou accusé de réception après confirmation ---

  private async tourDeCloture(messages: AIMessage[]): Promise<string> {
    const last = messages[messages.length - 1];
    if (last.role === "user" && typeof last.content === "string" && last.content.startsWith("[Action")) {
      return this.formatAck(last.content);
    }
    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant") as
      | { role: "assistant"; content: string | AIAssistantContent[] }
      | undefined;
    const contenu = lastAssistant?.content;
    const toolUse = Array.isArray(contenu) ? contenu.find((b) => b.type === "tool_use") : undefined;
    if (!toolUse || toolUse.type !== "tool_use") return "D'accord.";
    return this.formatProposal(toolUse.name, toolUse.input as any);
  }

  private async formatAck(texte: string): Promise<string> {
    let m = texte.match(/^\[Action confirmée et exécutée: (\w+)\. Résultat: ([\s\S]*)\]$/);
    if (m) {
      const [, outil, resultatStr] = m;
      let resultat: any = {};
      try {
        resultat = JSON.parse(resultatStr);
      } catch {
        // résultat non-JSON, on garde un objet vide
      }
      switch (outil) {
        case "envoyer_email":
          return `Email envoyé${resultat.demo ? " (mode démo — rien n'a été réellement transmis)" : ""}.`;
        case "creer_facture":
          return fmt.formatFactureGeneree(resultat);
        case "envoyer_facture":
          return fmt.formatFactureEnvoyee(resultat);
        case "ajouter_vente":
          return "Vente enregistrée. Le dashboard est à jour.";
        case "creer_evenement":
          return fmt.formatEvenementCree(resultat);
        case "modifier_evenement":
          return "Rendez-vous modifié.";
        case "supprimer_evenement":
          return "Rendez-vous supprimé définitivement.";
        case "creer_tache":
          return "Tâche créée.";
        default:
          return "C'est fait.";
      }
    }
    if (/^\[Action annulée par l'utilisateur:/.test(texte)) return "D'accord, action annulée.";
    m = texte.match(/^\[Action confirmée mais échouée: \w+\. Erreur: ([\s\S]*)\]$/);
    if (m) return `Il y a eu un problème : ${m[1]}`;
    return "C'est fait.";
  }

  private async formatProposal(nom: string, input: any): Promise<string> {
    switch (nom) {
      case "ajouter_vente": {
        const client = input.client_id ? await db.client.findUnique({ where: { id: input.client_id } }) : null;
        const qui = client?.nom ?? input.client_nom;
        const desc = input.description && !String(input.description).startsWith("Vente pour") ? ` (${input.description})` : "";
        return `Je vais enregistrer une vente de ${fmt.eur(input.montant)}${qui ? ` pour ${qui}` : ""}${desc}. Tu confirmes ?`;
      }
      case "creer_facture": {
        const client = await db.client.findUnique({ where: { id: input.client_id } });
        const total = (input.items ?? []).reduce((s: number, it: any) => s + (it.quantite ?? 1) * it.prix_unitaire, 0);
        return `Je vais préparer une facture de ${fmt.eur(total)} pour ${client?.nom ?? "ce client"}. Tu confirmes ?`;
      }
      case "envoyer_facture":
        return "Je vais envoyer cette facture par email. Tu confirmes ?";
      case "envoyer_email":
        return `Je vais envoyer cet email à ${input.destinataire ?? "ce destinataire"}. Tu confirmes ?`;
      case "creer_evenement":
        return `Je vais ajouter le rendez-vous "${input.titre}" le ${fmt.dateFr(input.debut)}. Tu confirmes ?`;
      case "modifier_evenement":
        return "Je vais modifier ce rendez-vous. Tu confirmes ?";
      case "supprimer_evenement":
        return "⚠️ Je vais supprimer définitivement ce rendez-vous, cette action est irréversible. Tu confirmes ?";
      case "creer_tache":
        return `Je vais créer la tâche "${input.titre}". Tu confirmes ?`;
      default:
        return "Je m'apprête à exécuter cette action. Tu confirmes ?";
    }
  }

  // --- Nouveau message utilisateur : classification d'intention ---

  private async nouveauMessage(messages: AIMessage[], texte: string): Promise<AIConverseResult> {
    const t = texte.trim();

    const clarification = await this.essaierResoudreClarification(messages, t);
    if (clarification) return clarification;

    if (estSalutation(t)) {
      return textContent(
        "Bonjour ! Je suis NOTEO AI. Dis-moi ce que tu veux savoir ou faire — mails, ventes, factures, agenda, chiffre d'affaires…"
      );
    }

    const norm = normaliser(t);

    // Ordre important : "envoie la facture" doit être détecté avant la règle générique
    // de création de facture (qui matcherait aussi sur le simple mot "facture").
    if (/\b(envoie|envoyer|transmets|transmet)\b/.test(norm) && /facture/.test(norm)) {
      // La conversation n'ayant pas de mémoire technique entre deux requêtes, on retrouve la dernière
      // facture en brouillon directement en base (source de vérité réelle, pas un historique de chat).
      const derniereFacture = await db.facture.findFirst({ where: { statut: "BROUILLON" }, orderBy: { createdAt: "desc" } });
      if (!derniereFacture) return textContent("Je n'ai pas de facture récente à envoyer. Veux-tu que j'en crée une ?");
      return toolContent("envoyer_facture", { facture_id: derniereFacture.id });
    }

    if (/\bfacture\b/.test(norm)) {
      const nom = extraireNomApres(t, /\bpour\b/i);
      if (!nom) return textContent("Pour qui dois-je préparer la facture ?");
      return toolContent("rechercher_client", { nom });
    }

    if ((/\b(ajoute|enregistre|note)\b/.test(norm) && /\bvente\b/.test(norm)) || /\bvente de\b/.test(norm)) {
      const montant = extraireMontant(t);
      if (montant == null) return textContent("Pour quel montant ?");
      const nom = extraireNomApres(t, /\bpour\b/i);
      return toolContent("ajouter_vente", {
        montant,
        description: extraireDescriptionArticle(t) ?? (nom ? `Vente pour ${nom}` : "Vente"),
        client_nom: nom ?? undefined,
      });
    }

    if (/\b(rendez[- ]vous|rdv|reunion|réunion)\b/.test(norm) && /\b(ajoute|cree|crée|planifie|prends|prend|fixe|ajouter)\b/.test(norm)) {
      const debut = extraireDateHeure(t);
      if (!debut) return textContent("Pour quelle date et à quelle heure ?");
      const fin = new Date(debut.getTime() + 60 * 60000);
      const titreMatch = t.match(/rendez[- ]vous (?:avec\s+)([A-ZÀ-Ý][\wÀ-ÿ' -]*)/i);
      return toolContent("creer_evenement", {
        titre: titreMatch ? `Rendez-vous avec ${titreMatch[1].trim()}` : "Rendez-vous",
        debut: debut.toISOString(),
        fin: fin.toISOString(),
      });
    }

    if (/\b(agenda|calendrier|planning)\b/.test(norm) || (/\brendez[- ]vous\b|\brdv\b/.test(norm) && !/\b(ajoute|cree|crée|planifie|fixe)\b/.test(norm))) {
      const debut = new Date();
      const fin = new Date(debut.getTime() + 7 * 24 * 3600 * 1000);
      return toolContent("lister_evenements", { debut: debut.toISOString(), fin: fin.toISOString() });
    }

    if (/\bmails?\b|\bemails?\b|\bcourriels?\b/.test(norm)) {
      if (/important/.test(norm)) return toolContent("rechercher_emails", { requete: "is:important" });
      if (/non lu|pas lu|pas encore lu/.test(norm)) return toolContent("rechercher_emails", { requete: "is:unread" });
      const nom = extraireNomApres(t, /\b(de|concernant|avec)\b/i);
      return toolContent("rechercher_emails", { requete: nom ?? "" });
    }

    if (/\bcombien de\b/.test(norm) || /\bcherche\b|\btrouve\b/.test(norm)) {
      const nom =
        extraireNomApres(t, /\b(cherche|trouve|de)\b/i) ??
        t.match(/[A-ZÀ-Ý][\wÀ-ÿ'-]+/)?.[0] ??
        null;
      if (nom) return toolContent("rechercher_client", { nom });
    }

    if (/\bshopify\b/.test(norm)) {
      return toolContent("lister_ventes", {});
    }

    if (/\bventes?\b/.test(norm) && !/\b(ajoute|enregistre|note)\b/.test(norm)) {
      const input: any = {};
      if (/aujourd'?hui/.test(norm)) input.depuis = startOfDay(new Date()).toISOString();
      else if (/semaine/.test(norm)) input.depuis = startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString();
      else if (/\bmois\b/.test(norm)) input.depuis = startOfMonth(new Date()).toISOString();
      return toolContent("lister_ventes", input);
    }

    if (/chiffre d'affaires|\bca\b|dashboard|tableau de bord|marge|cotisations|depenses|dépenses/.test(norm)) {
      return toolContent("obtenir_dashboard", {});
    }

    if (/\btaches?\b|\bt[aâ]ches?\b|a faire\b|à faire\b/.test(norm)) {
      return toolContent("lister_taches", {});
    }

    if (/attention|resum|résum|quoi de neuf|point (rapide|business)/.test(norm)) {
      return toolContent("obtenir_dashboard", {});
    }

    return textContent(
      "Je n'ai pas bien saisi. Tu peux me demander par exemple : \"Montre-moi mes ventes aujourd'hui\", " +
        "\"Regarde mes mails importants\", \"Fais une facture pour Julien Notéo d'une carte NFC à 60€\", " +
        "\"Ajoute un rendez-vous demain à 15h\", ou \"Qu'est-ce qui nécessite mon attention ?\""
    );
  }

  // --- Reprise après demande de clarification (homonymes client ou email) ---

  /**
   * Détecte si le message courant répond à une demande de clarification posée au tour
   * précédent. Comme seul le texte final de chaque tour est persisté (pas les appels
   * d'outils intermédiaires, éphémères), la détection se base sur le TEXTE de la
   * réponse précédente de l'assistant plutôt que sur un résultat d'outil en mémoire —
   * c'est ce qui permet à la désambiguïsation de fonctionner d'une requête à l'autre.
   */
  private async essaierResoudreClarification(messages: AIMessage[], texte: string): Promise<AIConverseResult | null> {
    if (messages.length < 2) return null;
    const precedent = messages[messages.length - 2];
    if (precedent.role !== "assistant" || typeof precedent.content !== "string") return null;

    const matchClients = precedent.content.match(/qui correspondent\s*:\s*([^.]+)\./i);
    const matchEmails = precedent.content.match(/personnes différentes\s*:\s*([^.]+)\./i);
    const liste = matchClients?.[1] ?? matchEmails?.[1];
    if (!liste) return null;

    const norm = normaliser(texte);
    const candidats = liste.split(",").map((s) => s.trim()).filter(Boolean);
    const trouve = candidats.find((nom) => normaliser(nom).includes(norm) || norm.includes(normaliser(nom)));
    if (!trouve) return null;

    if (matchEmails) {
      return toolContent("rechercher_emails", { requete: trouve });
    }

    // Ambiguïté client : si la demande d'origine (avant la clarification) concernait une
    // facture, on résout directement le client en base et on enchaîne sur creer_facture.
    const originIdx = this.dernierIndexTexteAvant(messages, messages.length - 2);
    const originTexte = originIdx >= 0 ? ((messages[originIdx] as any).content as string) : "";
    if (/\bfacture\b/i.test(originTexte)) {
      const client = await db.client.findFirst({ where: { nom: trouve } });
      if (client) {
        const montant = extraireMontant(originTexte) ?? 0;
        const description = extraireDescriptionArticle(originTexte) ?? "Prestation";
        return toolContent("creer_facture", {
          client_id: client.id,
          items: [{ description, quantite: 1, prix_unitaire: montant }],
        });
      }
    }
    return toolContent("rechercher_client", { nom: trouve });
  }

  // --- Continuation après exécution automatique d'un outil ---

  private continuerApresOutil(messages: AIMessage[]): AIConverseResult {
    const originIdx = this.dernierIndexTexte(messages);
    const originTexte = originIdx >= 0 ? ((messages[originIdx] as any).content as string) : "";
    const chaine = this.appelsOutilsDepuis(messages, originIdx + 1);
    const dernier = chaine[chaine.length - 1];
    const dernierResultat = dernier ? this.resultatPourAppel(messages, dernier.id) : null;

    const estFluxAttention = /attention|resum|résum|quoi de neuf|point (rapide|business)/.test(normaliser(originTexte));

    // Chaîne facture : rechercher_client (non ambigu) -> creer_facture
    if (dernier?.name === "rechercher_client" && /\bfacture\b/i.test(originTexte)) {
      if (dernierResultat?.ambigu) return textContent(fmt.formatClients(dernierResultat));
      if (!dernierResultat?.total) {
        return textContent("Je n'ai pas trouvé de client correspondant pour préparer cette facture. Peux-tu vérifier le nom ?");
      }
      const client = dernierResultat.clients[0];
      const montant = extraireMontant(originTexte) ?? 0;
      const description = extraireDescriptionArticle(originTexte) ?? "Prestation";
      return toolContent("creer_facture", {
        client_id: client.id,
        items: [{ description, quantite: 1, prix_unitaire: montant }],
      });
    }
    if (dernier?.name === "creer_facture") {
      return textContent(fmt.formatFactureGeneree(dernierResultat));
    }

    // Chaîne "qu'est-ce qui nécessite mon attention" : obtenir_dashboard -> lister_taches -> synthèse
    if (estFluxAttention && dernier?.name === "obtenir_dashboard") {
      return toolContent("lister_taches", {});
    }
    if (estFluxAttention && dernier?.name === "lister_taches") {
      const dashboardCall = chaine.find((c) => c.name === "obtenir_dashboard");
      const dashboardResultat = dashboardCall ? this.resultatPourAppel(messages, dashboardCall.id) : null;
      return textContent(this.synthetiserAttention(dashboardResultat, dernierResultat));
    }

    return textContent(this.resumerResultatOutil(dernier?.name ?? "", dernierResultat));
  }

  private synthetiserAttention(dashboard: any, taches: any): string {
    const parts: string[] = [];
    if (dashboard?.evolution_ca_mois_pourcent != null) {
      parts.push(
        dashboard.evolution_ca_mois_pourcent >= 0
          ? `Le CA du mois est en hausse de ${dashboard.evolution_ca_mois_pourcent}% par rapport au mois dernier.`
          : `Le CA du mois est en baisse de ${Math.abs(dashboard.evolution_ca_mois_pourcent)}% par rapport au mois dernier, ça vaut le coup d'y jeter un œil.`
      );
    }
    const enRetard = taches?.taches?.filter((t: any) => t.enRetard) ?? [];
    if (enRetard.length) {
      parts.push(`${enRetard.length} tâche${enRetard.length > 1 ? "s" : ""} en retard : ${enRetard.map((t: any) => t.titre).join(", ")}.`);
    }
    const top = dashboard?.produits_plus_vendus?.[0];
    if (top) parts.push(`${top.nom} continue de bien se vendre (${fmt.eur(top.ca)} ce mois-ci).`);
    if (!parts.length) return "Rien de particulier ne nécessite ton attention pour le moment, tout roule.";
    return parts.join(" ");
  }

  private resumerResultatOutil(nom: string, resultat: any): string {
    switch (nom) {
      case "rechercher_emails":
        return fmt.formatEmails(resultat);
      case "lire_email":
      case "resumer_email":
        return fmt.formatEmailDetail(resultat);
      case "rechercher_client":
        return fmt.formatClients(resultat);
      case "obtenir_dashboard":
        return fmt.formatDashboard(resultat);
      case "lister_ventes":
        return fmt.formatVentes(resultat);
      case "lister_evenements":
        return fmt.formatEvenements(resultat);
      case "lister_taches":
        return fmt.formatTaches(resultat);
      default:
        return "Fait.";
    }
  }

  // --- Utilitaires de parcours de l'historique ---

  private dernierIndexTexte(messages: AIMessage[]): number {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role === "user" && typeof m.content === "string") return i;
    }
    return -1;
  }

  private dernierIndexTexteAvant(messages: AIMessage[], avant: number): number {
    for (let i = avant - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role === "user" && typeof m.content === "string") return i;
    }
    return -1;
  }

  private appelsOutilsDepuis(messages: AIMessage[], depuis: number): { name: string; input: any; id: string }[] {
    const res: { name: string; input: any; id: string }[] = [];
    for (let i = Math.max(0, depuis); i < messages.length; i++) {
      const m = messages[i];
      if (m.role === "assistant" && Array.isArray(m.content)) {
        for (const b of m.content) if (b.type === "tool_use") res.push({ name: b.name, input: b.input, id: b.id });
      }
    }
    return res;
  }

  private resultatPourAppel(messages: AIMessage[], toolUseId: string): any | null {
    for (const m of messages) {
      if (m.role === "user" && Array.isArray(m.content)) {
        for (const b of m.content) {
          if (b.type === "tool_result" && b.tool_use_id === toolUseId) {
            try {
              return JSON.parse(b.content);
            } catch {
              return b.content;
            }
          }
        }
      }
    }
    return null;
  }

}

function toolUseId() {
  return `toolu_demo_${randomUUID().slice(0, 8)}`;
}

function textContent(text: string): AIConverseResult {
  return { content: [{ type: "text", text }] };
}

function toolContent(name: string, input: unknown): AIConverseResult {
  return { content: [{ type: "tool_use", id: toolUseId(), name, input }] };
}
