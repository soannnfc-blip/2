import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { obtenirDashboard } from "@/lib/tools/ventes";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const data = await obtenirDashboard.handler({});
  return NextResponse.json(data);
}
