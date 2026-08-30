import { calendarClient } from "@/lib/google";
import type { CalendarProvider, CalendarEvent } from "./types";

const CALENDAR_ID = "primary";

export class GoogleCalendarProvider implements CalendarProvider {
  readonly source = "google" as const;

  async list(debut: string, fin: string): Promise<CalendarEvent[]> {
    const cal = await calendarClient();
    const res = await cal.events.list({
      calendarId: CALENDAR_ID,
      timeMin: debut,
      timeMax: fin,
      singleEvents: true,
      orderBy: "startTime",
    });
    return (res.data.items ?? []).map((e) => ({
      id: e.id!,
      titre: e.summary ?? "(sans titre)",
      debut: e.start?.dateTime ?? e.start?.date ?? debut,
      fin: e.end?.dateTime ?? e.end?.date ?? null,
      lieu: e.location,
      description: e.description,
    }));
  }

  async create(input: { titre: string; debut: string; fin: string; description?: string; lieu?: string }) {
    const cal = await calendarClient();
    const res = await cal.events.insert({
      calendarId: CALENDAR_ID,
      requestBody: {
        summary: input.titre,
        description: input.description,
        location: input.lieu,
        start: { dateTime: input.debut },
        end: { dateTime: input.fin },
      },
    });
    return {
      id: res.data.id!,
      titre: res.data.summary ?? input.titre,
      debut: res.data.start?.dateTime ?? input.debut,
      fin: res.data.end?.dateTime ?? input.fin,
      lieu: res.data.location,
      description: res.data.description,
    };
  }

  async update(id: string, patch: { titre?: string; debut?: string; fin?: string; description?: string; lieu?: string }) {
    const cal = await calendarClient();
    const requestBody: Record<string, unknown> = {};
    if (patch.titre) requestBody.summary = patch.titre;
    if (patch.description) requestBody.description = patch.description;
    if (patch.lieu) requestBody.location = patch.lieu;
    if (patch.debut) requestBody.start = { dateTime: patch.debut };
    if (patch.fin) requestBody.end = { dateTime: patch.fin };

    const res = await cal.events.patch({ calendarId: CALENDAR_ID, eventId: id, requestBody });
    return {
      id: res.data.id!,
      titre: res.data.summary ?? patch.titre ?? "",
      debut: res.data.start?.dateTime ?? patch.debut ?? "",
      fin: res.data.end?.dateTime ?? patch.fin ?? null,
      lieu: res.data.location,
      description: res.data.description,
    };
  }

  async remove(id: string) {
    const cal = await calendarClient();
    await cal.events.delete({ calendarId: CALENDAR_ID, eventId: id });
  }
}
