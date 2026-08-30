import { emailTools } from "./emails";
import { agendaTools } from "./agenda";
import { clientTools } from "./clients";
import { venteTools } from "./ventes";
import { factureTools } from "./factures";
import { tacheTools } from "./taches";
import type { ToolDefinition } from "./types";

export const ALL_TOOLS: ToolDefinition[] = [
  ...emailTools,
  ...agendaTools,
  ...clientTools,
  ...venteTools,
  ...factureTools,
  ...tacheTools,
];

export const TOOL_BY_NAME: Record<string, ToolDefinition> = Object.fromEntries(
  ALL_TOOLS.map((t) => [t.name, t])
);

export const ANTHROPIC_TOOL_SCHEMAS = ALL_TOOLS.map((t) => ({
  name: t.name,
  description: t.description,
  input_schema: t.input_schema,
}));
