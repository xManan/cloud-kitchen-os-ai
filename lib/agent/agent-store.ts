"use client";

import { create } from "zustand";
import { getKitchen } from "@/lib/store";
import { buildSystemPrompt } from "./capabilities";
import { AgentAborted, abortRun, beginRun, hideCursor } from "./driver";
import { compact, executeTool, stepTitle } from "./executor";
import type { ExecMode } from "./registry";
import { toOpenAITools } from "./registry";
import { TOOLS } from "./tools";

export interface StepInfo {
  tool: string;
  title: string;
  status: "running" | "done" | "error";
  mode: ExecMode | "read";
  error?: string;
}

export type Entry =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "assistant"; text: string }
  | { id: string; role: "step"; step: StepInfo }
  | { id: string; role: "confirm"; question: string; state: "pending" | "approved" | "denied" }
  | { id: string; role: "notice"; text: string; tone: "error" | "info" };

type LLMMessage =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

interface AgentState {
  entries: Entry[];
  transcript: LLMMessage[];
  running: boolean;
  demoMode: boolean;
  /** Model that served the most recent turn, as reported by OpenRouter. */
  lastModel: string | null;
  /** Number of tools registered with a WebMCP-capable browser (0 = not available). */
  webmcp: number;
  send: (text: string) => Promise<void>;
  stop: () => void;
  clear: () => void;
  answerConfirm: (id: string, ok: boolean) => void;
}

const MAX_STEPS = 14;
const uid = () => Math.random().toString(36).slice(2, 10);
const confirmResolvers = new Map<string, (ok: boolean) => void>();

function trim(t: LLMMessage[]) {
  if (t.length <= 60) return t;
  let i = t.length - 60;
  while (i < t.length && t[i].role !== "user") i++;
  return t.slice(i);
}

export const useAgent = create<AgentState>()((set, get) => {
  const push = (e: Entry) => set((s) => ({ entries: [...s.entries, e] }));
  const patchStep = (id: string, step: Partial<StepInfo>) =>
    set((s) => ({ entries: s.entries.map((e) => (e.id === id && e.role === "step" ? { ...e, step: { ...e.step, ...step } } : e)) }));

  const confirm = (question: string) =>
    new Promise<boolean>((resolve) => {
      const id = uid();
      confirmResolvers.set(id, resolve);
      push({ id, role: "confirm", question, state: "pending" });
    });

  return {
    entries: [],
    transcript: [],
    running: false,
    demoMode: false,
    lastModel: null,
    webmcp: 0,

    clear: () => {
      if (get().running) return;
      set({ entries: [], transcript: [] });
    },

    stop: () => {
      abortRun();
      confirmResolvers.forEach((r) => r(false));
      confirmResolvers.clear();
    },

    answerConfirm: (id, ok) => {
      confirmResolvers.get(id)?.(ok);
      confirmResolvers.delete(id);
      set((s) => ({ entries: s.entries.map((e) => (e.id === id && e.role === "confirm" ? { ...e, state: ok ? "approved" : "denied" } : e)) }));
    },

    send: async (text) => {
      if (get().running || !text.trim()) return;
      push({ id: uid(), role: "user", text });
      set((s) => ({ running: true, transcript: trim([...s.transcript, { role: "user", content: text }]) }));
      const ctl = beginRun();
      const tools = toOpenAITools(TOOLS);

      try {
        for (let step = 0; step < MAX_STEPS; step++) {
          const { settings } = getKitchen();
          const res = await fetch("/api/chat", {
            method: "POST",
            signal: ctl.signal,
            headers: { "content-type": "application/json", ...(settings.openrouterKey ? { "x-openrouter-key": settings.openrouterKey } : {}) },
            body: JSON.stringify({
              model: settings.model,
              messages: [{ role: "system", content: buildSystemPrompt() }, ...get().transcript],
              tools,
            }),
          });
          const data = await res.json().catch(() => ({ error: `Server returned ${res.status}` }));
          if (!res.ok || data.error) throw new Error(data.error ?? `Request failed (${res.status})`);
          set({ demoMode: !!data.mock, lastModel: data.mock ? null : (data.model ?? null) });

          const msg = data.message as { content?: string | null; tool_calls?: ToolCall[] };
          const calls = (msg.tool_calls ?? []).filter((c) => c?.function?.name);
          set((s) => ({ transcript: [...s.transcript, { role: "assistant", content: msg.content ?? null, ...(calls.length ? { tool_calls: calls } : {}) }] }));
          if (msg.content?.trim()) push({ id: uid(), role: "assistant", text: msg.content.trim() });
          if (!calls.length) break;

          for (const call of calls) {
            let args: Record<string, unknown> = {};
            try {
              args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
            } catch {
              /* malformed JSON is reported back as a validation error below */
            }
            const id = uid();
            push({ id, role: "step", step: { tool: call.function.name, title: stepTitle(call.function.name, args), status: "running", mode: "read" } });
            const out = await executeTool(call.function.name, args, { via: "chat", confirm });
            patchStep(id, { title: out.title, status: out.ok ? "done" : "error", mode: out.mode, error: out.error });
            set((s) => ({
              transcript: [...s.transcript, { role: "tool", tool_call_id: call.id, content: out.ok ? compact(out.result) : compact({ error: out.error }) }],
            }));
          }
          if (step === MAX_STEPS - 1) push({ id: uid(), role: "notice", tone: "info", text: "Stopped after the step limit. Ask me to continue if needed." });
        }
      } catch (e) {
        if (e instanceof AgentAborted || (e instanceof DOMException && e.name === "AbortError")) {
          push({ id: uid(), role: "notice", tone: "info", text: "Stopped." });
          // Close out the dangling tool calls so the transcript stays valid for the next turn.
          set((s) => ({ transcript: closeDangling(s.transcript) }));
        } else {
          push({ id: uid(), role: "notice", tone: "error", text: e instanceof Error ? e.message : String(e) });
          set((s) => ({ transcript: closeDangling(s.transcript) }));
        }
        set((s) => ({ entries: s.entries.map((en) => (en.role === "step" && en.step.status === "running" ? { ...en, step: { ...en.step, status: "error", error: "Stopped" } } : en)) }));
      } finally {
        hideCursor();
        set({ running: false });
      }
    },
  };
});

function closeDangling(t: LLMMessage[]): LLMMessage[] {
  const out = [...t];
  for (let i = out.length - 1; i >= 0; i--) {
    const m = out[i];
    if (m.role === "assistant" && m.tool_calls?.length) {
      const answered = new Set(out.slice(i + 1).filter((x): x is Extract<LLMMessage, { role: "tool" }> => x.role === "tool").map((x) => x.tool_call_id));
      for (const c of m.tool_calls) if (!answered.has(c.id)) out.push({ role: "tool", tool_call_id: c.id, content: compact({ error: "Stopped by user" }) });
      break;
    }
    if (m.role === "user") break;
  }
  return out;
}
