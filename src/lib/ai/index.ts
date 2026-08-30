import { MockAIProvider } from "./mock-provider";
import { AnthropicAIProvider } from "./anthropic-provider";
import type { AIProvider } from "./types";

export * from "./types";

let cached: AIProvider | undefined;

/**
 * Sélectionne le moteur conversationnel :
 * - AI_PROVIDER=mock force le mode démo même si une clé Anthropic est présente.
 * - Sinon, ANTHROPIC_API_KEY présente => Claude ; absente => mode démo (aucune clé requise).
 * Le reste de l'application ne dépend que de l'interface AIProvider (voir ./types) —
 * ajouter la clé plus tard bascule automatiquement le moteur, sans autre changement.
 */
export function getAIProvider(): AIProvider {
  if (cached) return cached;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const force = process.env.AI_PROVIDER;

  if (force !== "mock" && apiKey) {
    cached = new AnthropicAIProvider(apiKey);
  } else {
    cached = new MockAIProvider();
  }
  return cached;
}
