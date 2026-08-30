// Abstraction du moteur de raisonnement conversationnel. Le reste de l'application
// (routes /api/chat, /api/actions/confirm, permissions, outils) ne connaît que cette
// interface — remplacer MockAIProvider par AnthropicAIProvider (ou l'inverse) ne
// nécessite aucun autre changement.

export type AITextBlock = { type: "text"; text: string };
export type AIToolUseBlock = { type: "tool_use"; id: string; name: string; input: unknown };
export type AIToolResultBlock = { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };

export type AIAssistantContent = AITextBlock | AIToolUseBlock;

export type AIMessage =
  | { role: "user"; content: string | AIToolResultBlock[] }
  | { role: "assistant"; content: string | AIAssistantContent[] };

export type AIToolSchema = {
  name: string;
  description: string;
  input_schema: { type: "object"; properties: Record<string, unknown>; required?: string[] };
};

export type AIConverseArgs = {
  system: string;
  messages: AIMessage[];
  /** Liste vide ou omise = l'IA doit répondre en texte seul, sans appeler d'outil (tour de clôture). */
  tools?: AIToolSchema[];
};

export type AIConverseResult = { content: AIAssistantContent[] };

export interface AIProvider {
  readonly id: "mock" | "anthropic";
  readonly label: string;
  converse(args: AIConverseArgs): Promise<AIConverseResult>;
}
