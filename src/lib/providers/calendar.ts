import { isGoogleConnected } from "@/lib/google";
import { GoogleCalendarProvider } from "./calendar-google";
import { MockCalendarProvider } from "./calendar-mock";
import type { CalendarProvider } from "./types";

const googleProvider = new GoogleCalendarProvider();
const mockProvider = new MockCalendarProvider();

export async function getCalendarProvider(): Promise<CalendarProvider> {
  return (await isGoogleConnected()) ? googleProvider : mockProvider;
}
