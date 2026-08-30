import { db } from "@/lib/db";
import { randomUUID } from "crypto";
import type { CalendarProvider, CalendarEvent } from "./types";

function toEvent(e: { googleEventId: string; titre: string; description: string | null; debut: Date; fin: Date | null }): CalendarEvent {
  return {
    id: e.googleEventId,
    titre: e.titre,
    debut: e.debut.toISOString(),
    fin: e.fin?.toISOString() ?? null,
    description: e.description,
  };
}

/** Source de vérité "démo" : les événements vivent directement dans la table Evenement. */
export class MockCalendarProvider implements CalendarProvider {
  readonly source = "demo" as const;

  async list(debut: string, fin: string): Promise<CalendarEvent[]> {
    const rows = await db.evenement.findMany({
      where: { debut: { gte: new Date(debut), lte: new Date(fin) } },
      orderBy: { debut: "asc" },
    });
    return rows.map(toEvent);
  }

  async create(input: { titre: string; debut: string; fin: string; description?: string; lieu?: string }) {
    const id = `demo-${randomUUID()}`;
    const row = await db.evenement.create({
      data: {
        googleEventId: id,
        titre: input.titre,
        description: [input.description, input.lieu ? `Lieu : ${input.lieu}` : null].filter(Boolean).join(" — ") || null,
        debut: new Date(input.debut),
        fin: input.fin ? new Date(input.fin) : null,
      },
    });
    return toEvent(row);
  }

  async update(id: string, patch: { titre?: string; debut?: string; fin?: string; description?: string; lieu?: string }) {
    const row = await db.evenement.update({
      where: { googleEventId: id },
      data: {
        titre: patch.titre,
        description: patch.description,
        debut: patch.debut ? new Date(patch.debut) : undefined,
        fin: patch.fin ? new Date(patch.fin) : undefined,
      },
    });
    return toEvent(row);
  }

  async remove(id: string) {
    await db.evenement.delete({ where: { googleEventId: id } });
  }
}
