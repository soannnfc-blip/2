import { isGoogleConnected } from "@/lib/google";
import { GmailMailProvider } from "./mail-gmail";
import { MockMailProvider } from "./mail-mock";
import type { MailProvider } from "./types";

const gmailProvider = new GmailMailProvider();
const mockProvider = new MockMailProvider();

/** Gmail si connecté, sinon données de démonstration — transparent pour les outils appelants. */
export async function getMailProvider(): Promise<MailProvider> {
  return (await isGoogleConnected()) ? gmailProvider : mockProvider;
}
