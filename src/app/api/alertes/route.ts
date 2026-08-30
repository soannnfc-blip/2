import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const alertes = await db.alerte.findMany({
    where: { lue: false },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  return NextResponse.json({ alertes });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id } = (await req.json()) as { id: string };
  await db.alerte.update({ where: { id }, data: { lue: true } });
  return NextResponse.json({ ok: true });
}
