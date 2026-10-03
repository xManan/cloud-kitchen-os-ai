"use client";

import { compact, executeTool } from "./executor";
import { toJsonSchema } from "./registry";
import { TOOLS } from "./tools";

/**
 * WebMCP bridge. Browsers that implement the W3C WebMCP draft expose `document.modelContext`
 * (older builds: `navigator.modelContext`). Registering our tools there lets a browser-level
 * agent operate Kitchen OS with the same tools, validation and confirmations as the built-in chat.
 * Everywhere else this is a no-op.
 */

interface WebMCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: { readOnlyHint?: boolean };
  execute: (input: Record<string, unknown>, client?: unknown) => Promise<{ content: { type: "text"; text: string }[]; isError?: boolean }>;
}

interface ModelContext {
  registerTool: (tool: WebMCPTool, opts?: { signal?: AbortSignal }) => unknown;
  unregisterTool?: (name: string) => void;
}

export function getModelContext(): ModelContext | null {
  if (typeof window === "undefined") return null;
  const d = document as unknown as { modelContext?: ModelContext };
  const n = navigator as unknown as { modelContext?: ModelContext };
  const mc = d.modelContext ?? n.modelContext;
  return mc && typeof mc.registerTool === "function" ? mc : null;
}

export function registerWebMCP(): { count: number; dispose: () => void } {
  const mc = getModelContext();
  if (!mc) return { count: 0, dispose: () => {} };
  const ctl = new AbortController();
  let count = 0;
  for (const tool of TOOLS) {
    try {
      mc.registerTool(
        {
          name: tool.name,
          description: tool.description,
          inputSchema: toJsonSchema(tool, { withVisible: true }),
          annotations: { readOnlyHint: tool.kind === "read" },
          execute: async (input) => {
            const out = await executeTool(tool.name, input ?? {}, {
              via: "webmcp",
              confirm: async (q) => window.confirm(`A browser agent wants to: ${q}`),
            });
            return { content: [{ type: "text", text: out.ok ? compact(out.result) : `Error: ${out.error}` }], isError: !out.ok };
          },
        },
        { signal: ctl.signal },
      );
      count++;
    } catch (e) {
      console.warn(`[webmcp] could not register ${tool.name}`, e);
    }
  }
  return {
    count,
    dispose: () => {
      ctl.abort();
      if (mc.unregisterTool) for (const t of TOOLS) try { mc.unregisterTool(t.name); } catch { /* already gone */ }
    },
  };
}
