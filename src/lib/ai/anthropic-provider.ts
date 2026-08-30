import Anthropic from "@anthropic-ai/sdk";
import type { AIConverseArgs, AIConverseResult, AIProvider, AIAssistantContent } from "./types";

const CLAUDE_MODEL = "claude-sonnet-5";

export class AnthropicAIProvider implements AIProvider {
  readonly id = "anthropic" as const;
  readonly label = "Claude (Anthropic)";
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async converse({ system, messages, tools }: AIConverseArgs): Promise<AIConverseResult> {
    const response = await this.client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      system,
      messages: messages as Anthropic.MessageParam[],
      ...(tools && tools.length > 0 ? { tools: tools as Anthropic.Tool[] } : {}),
    });

    const content = response.content.filter(
      (b): b is Anthropic.TextBlock | Anthropic.ToolUseBlock => b.type === "text" || b.type === "tool_use"
    ) as unknown as AIAssistantContent[];

    return { content };
  }
}
