import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { startOfDay, subDays } from "date-fns";

// Appelé par n8n (Schedule Trigger) pour l'analyse proactive périodique.
// Sécurisé par le même secret partagé que /api/webhooks/n8n.
// Ne crée une alerte que si le même type n'a pas déjà été signalé dans les 24h (anti-spam).
export async function POST(req: Request) {
  const secret = req.headers.get("x-noteo-secret");
  if (!process.env.N8N_WEBHOOK_SECRET || secret !== process.env.N8N_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const alertesCreees: string[] = [];
  const depuis24h = subDays(new Date(), 1);

  async function creerSiNouveau(type: string, titre: string, message: string, niveau: string) {
    const existante = await db.alerte.findFirst({ where: { type, createdAt: { gte: depuis24h } } });
    if (existante) return;
    await db.alerte.create({ data: { type, titre, message, niveau } });
    alertesCreees.push(type);
  }

  // 1. Comparaison CA aujourd'hui vs hier
  const [caAujourdhui, caHier] = await Promise.all([
    db.vente.aggregate({ where: { date: { gte: startOfDay(new Date()) }, statut: "PAYEE" }, _sum: { montant: true } }),
    db.vente.aggregate({
      where: { date: { gte: startOfDay(subDays(new Date(), 1)), lt: startOfDay(new Date()) }, statut: "PAYEE" },
      _sum: { montant: true },
    }),
  ]);
  const totalAujourdhui = Number(caAujourdhui._sum.montant ?? 0);
  const totalHier = Number(caHier._sum.montant ?? 0);
  if (totalHier > 0) {
    const variation = ((totalAujourdhui - totalHier) / totalHier) * 100;
    if (variation <= -30) {
      await creerSiNouveau(
        "ca_baisse",
        "Baisse notable du chiffre d'affaires",
        `Le CA d'aujourd'hui (${totalAujourdhui.toFixed(2)}€) est en baisse de ${Math.abs(variation).toFixed(0)}% par rapport à hier.`,
        "attention"
      );
    } else if (variation >= 50) {
      await creerSiNouveau(
        "ca_hausse",
        "Belle hausse du chiffre d'affaires",
        `Le CA d'aujourd'hui (${totalAujourdhui.toFixed(2)}€) est en hausse de ${variation.toFixed(0)}% par rapport à hier.`,
        "info"
      );
    }
  }

  // 2. Tâches en retard
  const tachesEnRetard = await db.tache.count({
    where: { statut: { not: "TERMINEE" }, dateLimite: { lt: new Date() } },
  });
  if (tachesEnRetard > 0) {
    await creerSiNouveau(
      "tache_retard",
      `${tachesEnRetard} tâche${tachesEnRetard > 1 ? "s" : ""} en retard`,
      "Certaines tâches ont dépassé leur date limite.",
      "attention"
    );
  }

  // 3. Factures envoyées non payées depuis longtemps
  const facturesImpayees = await db.facture.count({
    where: { statut: "ENVOYEE", envoyeeLe: { lt: subDays(new Date(), 15) } },
  });
  if (facturesImpayees > 0) {
    await creerSiNouveau(
      "facture_impayee",
      `${facturesImpayees} facture${facturesImpayees > 1 ? "s" : ""} en attente de paiement`,
      "Des factures envoyées il y a plus de 15 jours n'ont pas encore de paiement enregistré.",
      "attention"
    );
  }

  return NextResponse.json({ alertes_creees: alertesCreees });
}
