// Compréhension "suffisante" du français pour le mode démo : pas de vrai NLU, des règles
// pragmatiques qui couvrent les formulations attendues. Remplacé par le vrai raisonnement
// de Claude dès qu'AnthropicAIProvider est actif.

export function normaliser(texte: string): string {
  return texte
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function extraireMontant(texte: string): number | null {
  // Priorité au nombre suivi d'un symbole monétaire (le prix, pas une quantité comme "10 cartes").
  const avecDevise = texte.match(/(\d+(?:[.,]\d{1,2})?)\s*(?:€|eur\b|euros?\b)/i);
  if (avecDevise) return parseFloat(avecDevise[1].replace(",", "."));
  // Sinon, nombre introduit par "à"/"a " (ex: "... à 60").
  const apresA = texte.match(/\b[àa]\s+(\d+(?:[.,]\d{1,2})?)\b/i);
  if (apresA) return parseFloat(apresA[1].replace(",", "."));
  // Dernier recours : premier nombre du texte.
  const premier = texte.match(/(\d+(?:[.,]\d{1,2})?)/);
  return premier ? parseFloat(premier[1].replace(",", ".")) : null;
}

/** Capture un nom propre (1 à 3 mots capitalisés) après un des mots-clés donnés. */
export function extraireNomApres(texte: string, motsClesRegex: RegExp): string | null {
  const match = texte.match(motsClesRegex);
  if (!match) return null;
  const reste = texte.slice((match.index ?? 0) + match[0].length);
  const nomMatch = reste.match(/^\s*([A-ZÀ-Ý][\wÀ-ÿ'-]*(?:\s+[A-ZÀ-Ý][\wÀ-ÿ'-]*){0,2})/);
  return nomMatch ? nomMatch[1].trim() : null;
}

/** Description d'article entre "d'un(e)"/"de" et " à <montant>" (ex: "une carte NFC à 60€"). */
export function extraireDescriptionArticle(texte: string): string | null {
  const match = texte.match(/d['’]un[e]?\s+(.+?)\s+(?:à|a)\s+\d/i) ?? texte.match(/de\s+(.+?)\s+(?:à|a)\s+\d/i);
  return match ? match[1].trim() : null;
}

const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

/** Parse des expressions temporelles simples en français. Retourne un objet Date (heure locale serveur). */
export function extraireDateHeure(texte: string, maintenant = new Date()): Date | null {
  const t = normaliser(texte);
  const base = new Date(maintenant);

  let jourCible: Date | null = null;
  if (/\bapres[- ]demain\b/.test(t)) {
    jourCible = new Date(base);
    jourCible.setDate(base.getDate() + 2);
  } else if (/\bdemain\b/.test(t)) {
    jourCible = new Date(base);
    jourCible.setDate(base.getDate() + 1);
  } else if (/\baujourd'?hui\b/.test(t)) {
    jourCible = new Date(base);
  } else {
    for (let i = 0; i < JOURS.length; i++) {
      if (new RegExp(`\\b${JOURS[i]}\\b`).test(t)) {
        jourCible = new Date(base);
        const decalage = (i - base.getDay() + 7) % 7 || 7;
        jourCible.setDate(base.getDate() + decalage);
        break;
      }
    }
  }
  if (!jourCible) jourCible = new Date(base);

  const heureMatch = t.match(/\b(?:a|à)?\s*(\d{1,2})\s*[h:]\s*(\d{2})?\b/);
  let heures = 9;
  let minutes = 0;
  if (heureMatch) {
    heures = parseInt(heureMatch[1], 10);
    minutes = heureMatch[2] ? parseInt(heureMatch[2], 10) : 0;
  } else if (!/demain|aujourd|apres[- ]demain|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche/.test(t)) {
    return null; // aucune information temporelle détectée
  }

  jourCible.setHours(heures, minutes, 0, 0);
  return jourCible;
}

export function estSalutation(texte: string): boolean {
  return /^(salut|bonjour|coucou|hello|hey|yo)\b/i.test(texte.trim());
}
