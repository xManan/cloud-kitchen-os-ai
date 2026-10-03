import { z } from "zod";

export type ExecMode = "ui" | "background";

export interface ToolContext {
  mode: ExecMode;
  /** Who is asking: our in-app chat, or an external browser agent via WebMCP. */
  via: "chat" | "webmcp";
  /** For on-screen form actions: false leaves the filled form open for review. */
  submit?: boolean;
}

export interface ToolDef<S extends z.ZodObject = z.ZodObject> {
  name: string;
  /** Plain-language step label shown in the dock, e.g. "Drafting a purchase order". */
  title: (args: z.infer<S>) => string;
  description: string;
  schema: S;
  kind: "read" | "write" | "nav";
  /** True when the on-screen version fills a form (enables the `submit` parameter). */
  form?: boolean;
  /** Ask the person before running (refunds, deletions, disputes). */
  confirm?: (args: z.infer<S>) => string;
  /** Background implementation: calls store actions directly. */
  run: (args: z.infer<S>, ctx: ToolContext) => unknown | Promise<unknown>;
  /** Optional "Show me" implementation that drives the real UI. */
  ui?: (args: z.infer<S>, ctx: ToolContext) => Promise<unknown>;
}

export function defineTool<S extends z.ZodObject>(def: ToolDef<S>): ToolDef<S> {
  return def;
}

const VISIBLE_PARAM = {
  type: "boolean",
  description:
    "Optional. true = perform this on screen (navigate, fill the form, press the button) so the user can watch. false = do it silently in the background. Omit to follow the user's current preference.",
};

const SUBMIT_PARAM = {
  type: "boolean",
  description:
    "Only for on-screen form actions. false = fill the form and leave it open for the user to review and submit themselves. Defaults to true.",
};

export interface JsonTool {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

/** JSON schema for the LLM (OpenAI-style tools on OpenRouter) and for WebMCP inputSchema. */
export function toJsonSchema(tool: ToolDef, opts: { withVisible: boolean }) {
  const schema = z.toJSONSchema(tool.schema, { io: "input", unrepresentable: "any" }) as Record<string, unknown>;
  delete schema.$schema;
  if (tool.kind === "write" && opts.withVisible) {
    const props = { ...(schema.properties as Record<string, unknown>), visible: VISIBLE_PARAM };
    if (tool.form) Object.assign(props, { submit: SUBMIT_PARAM });
    schema.properties = props;
  }
  schema.additionalProperties = false;
  return schema;
}

export function toOpenAITools(tools: ToolDef[]): JsonTool[] {
  return tools.map((t) => ({
    type: "function",
    function: { name: t.name, description: t.description, parameters: toJsonSchema(t, { withVisible: true }) },
  }));
}
