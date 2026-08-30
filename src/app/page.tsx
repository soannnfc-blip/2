import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { obtenirDashboard } from "@/lib/tools/ventes";
import { listerTaches } from "@/lib/tools/taches";
import { isGoogleConnected } from "@/lib/google";
import { db } from "@/lib/db";
import { Assistant } from "@/components/assistant";

export default async function Home() {
  const session = await auth();
  if (!session) redirect("/login");

  const [dashboard, taches, googleConnected, alertes] = await Promise.all([
    obtenirDashboard.handler({}) as ReturnType<typeof obtenirDashboard.handler>,
    listerTaches.handler({}) as ReturnType<typeof listerTaches.handler>,
    isGoogleConnected(),
    db.alerte.findMany({ where: { lue: false }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);

  return (
    <Assistant
      initialDashboard={dashboard as any}
      initialTaches={(taches as any).taches}
      initialAlertes={alertes}
      googleConnected={googleConnected}
    />
  );
}
