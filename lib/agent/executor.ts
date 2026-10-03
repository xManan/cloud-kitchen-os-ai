"use client";

import { getKitchen } from "@/lib/store";
import { AgentAborted, hideCursor } from "./driver";
import type { ExecMode, ToolContext } from "./registry";
import { findTool } from "./tools";

export type Confirm = (question: string) => Promise<boolean>;

export interface ToolOutcome {
  ok: boolean;
  /** Mode actually used, shown in the dock. */
  mode: ExecMode | "read";
  title: string;
  result?: unknown;
  error?: string;
}

const MAX_RESULT_CHARS = 6000;

/** Plain-language label for a step, available before it runs. */
export function stepTitle(name: string, rawArgs: Record<string, unknown>) {
  const tool = findTool(name);
  if (!tool) return name.replace(/_/g, " ");
  try {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { visible, submit, ...rest } = rawArgs ?? {};
    return tool.title(tool.schema.parse(rest));
  } catch {
    return name.replace(/_/g, " ");
  }
}

export function compact(value: unknown) {
  const s = JSON.stringify(value ?? null);
  return s.length > MAX_RESULT_CHARS ? `${s.slice(0, MAX_RESULT_CHARS)}... (truncated)` : s;
}

/**
 * Run one tool call. Shared by the in-app chat loop and the WebMCP bridge so both
 * agents get identical validation, confirmations and behaviour.
 */
export async function executeTool(
  name: string,
  rawArgs: Record<string, unknown>,
  opts: { via: ToolContext["via"]; confirm: Confirm },
): Promise<ToolOutcome> {
  const tool = findTool(name);
  if (!tool) return { ok: false, mode: "read", title: name, error: `Unknown tool ${name}` };

  const { visible, submit, ...rest } = rawArgs ?? {};
  const parsed = tool.schema.safeParse(rest);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; ");
    return { ok: false, mode: "read", title: name, error: `Invalid arguments: ${msg}` };
  }
  const args = parsed.data;
  let title = name;
  try {
    title = tool.title(args);
  } catch {
    /* title is cosmetic */
  }

  const pref = getKitchen().settings.agentMode;
  const mode: ExecMode = typeof visible === "boolean" ? (visible ? "ui" : "background") : pref;
  const ctx: ToolContext = { mode, via: opts.via, submit: typeof submit === "boolean" ? submit : undefined };

  if (tool.kind === "write" && tool.confirm) {
    const q = tool.confirm(args);
    if (q && !(await opts.confirm(q))) {
      return { ok: false, mode, title, error: "The user declined this action. Do not retry it; ask what they would like instead." };
    }
  }

  try {
    let result: unknown;
    if (tool.kind === "nav") result = await tool.run(args, ctx);
    else if (tool.kind === "write" && mode === "ui" && tool.ui) result = await tool.ui(args, ctx);
    else result = await tool.run(args, ctx);
    return { ok: true, mode: tool.kind === "read" ? "read" : tool.kind === "nav" ? "ui" : mode, title, result };
  } catch (e) {
    if (e instanceof AgentAborted) throw e;
    return { ok: false, mode, title, error: e instanceof Error ? e.message : String(e) };
  } finally {
    if (opts.via === "webmcp" && tool.kind !== "read") hideCursor();
  }
}
