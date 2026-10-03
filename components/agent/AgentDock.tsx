"use client";

import { ArrowUp, Broom, Check, CircleNotch, Minus, Stop, WarningCircle, Globe } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { usePathname } from "next/navigation";
import { Fragment, useEffect, useRef, useState } from "react";
import { Button, IconButton, Segmented, cn } from "@/components/ui";
import { useAgent, type Entry } from "@/lib/agent/agent-store";
import { useCursor } from "@/lib/agent/driver";
import { useKitchen } from "@/lib/store";
import { useUI } from "@/lib/ui-store";

const SUGGESTIONS: Record<string, string[]> = {
  default: ["Restock everything that's low from the cheapest suppliers", "How did each brand do this week?", "Reply to the latest bad review", "Create a 20% coupon WEEKEND20 for all brands"],
  "/inventory": ["Order 20 kg paneer from the cheapest dairy supplier", "Log 2 kg spoiled coriander", "Which supplier is cheapest for dry goods?"],
  "/orders": ["Bump every ready order to dispatched", "Create a phone order: 2 butter chicken and 4 naan for Rhea", "How many orders are waiting?"],
  "/menu": ["Mark garlic bread sold out", "Which items have the lowest margin?", "Raise Margherita to 419"],
  "/marketing": ["Launch a 2-week Instagram campaign for Crust Lab with 15k budget", "Reply to every unanswered review under 3 stars", "Pause the lunch bowls campaign"],
  "/finance": ["Record a 6,800 HVAC repair expense", "Are we over budget anywhere this month?", "What's our prime cost?"],
  "/billing": ["Is any aggregator payout short?", "Invoice Northwind Labs for 30 lunches at 320", "Mark INV-2040 paid"],
  "/sales": ["Why did food cost go up last week?", "Which channel has the best order value?", "Compare weekends vs weekdays"],
  "/staff": ["Who is working tomorrow evening?", "Add a 10:00 to 18:00 shift for Asha tomorrow"],
  "/customers": ["Who are our top 5 customers?", "Tag lapsed regulars for a win-back"],
};

export function AgentDock() {
  const open = useUI((s) => s.dockOpen);
  const setOpen = useUI((s) => s.setDockOpen);
  const { entries, running, demoMode, webmcp, send, stop, clear, answerConfirm } = useAgent();
  const mode = useKitchen((s) => s.settings.agentMode);
  const updateSettings = useKitchen((s) => s.updateSettings);
  const pathname = usePathname();
  // While the agent is driving the screen, fold the panel away so it never covers the work.
  const driving = useCursor((s) => s.visible);
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // "/" opens the agent from anywhere that isn't a text field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === "/" && !/input|textarea|select/i.test(t.tagName) && !t.isContentEditable) {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      if (e.key === "Escape" && running) stop();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen, running, stop]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [entries.length, entries]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 80);
  }, [open]);

  const submit = (value = text) => {
    if (!value.trim() || running) return;
    setText("");
    send(value.trim());
  };

  const currentStep = [...entries].reverse().find((e) => e.role === "step" && e.step.status === "running");
  const suggestions = SUGGESTIONS[pathname] ?? SUGGESTIONS.default;

  return (
    <div data-agent-dock className="fixed bottom-4 left-4 z-[60]">
      <AnimatePresence initial={false} mode="popLayout">
        {!open || driving ? (
          <motion.button
            key="launcher"
            type="button"
            onClick={() => (driving ? stop() : setOpen(true))}
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98, transition: { duration: 0.14 } }}
            transition={{ duration: 0.24, ease: [0.05, 0.7, 0.1, 1] }}
            className={cn(
              "flex h-12 w-[200px] max-w-[calc(100vw-32px)] cursor-pointer items-center gap-3 rounded-[12px] bg-dock pr-3 pl-3.5 text-left text-dock-ink ring-1 ring-white/10 shadow-[var(--shadow)] transition-transform active:scale-[0.98]",
              driving ? "w-[300px]" : "max-lg:w-auto",
            )}
            aria-label={driving ? "Agent is working. Click to stop" : "Open the Kitchen OS agent"}
          >
            <Orb busy={running} />
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{running && currentStep?.role === "step" ? currentStep.step.title : "Ask Kitchen OS"}</span>
            {driving ? (
              <Stop size={14} weight="fill" className="shrink-0 text-dock-ink/80" />
            ) : (
              <kbd className="hidden rounded-[5px] bg-white/15 px-1.5 text-xs text-dock-ink/80 lg:inline">/</kbd>
            )}
          </motion.button>
        ) : (
          <motion.div
            key="panel"
            role="dialog"
            aria-label="Kitchen OS agent"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98, transition: { duration: 0.16, ease: [0.3, 0, 1, 1] } }}
            transition={{ duration: 0.32, ease: [0.05, 0.7, 0.1, 1] }}
            style={{ transformOrigin: "bottom left" }}
            className="flex h-[min(680px,calc(100dvh-32px))] w-[min(420px,calc(100vw-32px))] flex-col overflow-hidden rounded-[14px] bg-paper shadow-[var(--shadow)] ring-1 ring-rule"
          >
            <header className="flex items-center gap-3 border-b border-rule px-4 py-3">
              <Orb busy={running} dark />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-ink">Kitchen OS agent</div>
                <div className="truncate text-xs text-ink-3">{running ? "Working" : demoMode ? "Demo mode: scripted replies" : "Ready"}</div>
              </div>
              <IconButton label="Clear conversation" onClick={clear} disabled={running}>
                <Broom size={17} />
              </IconButton>
              <IconButton label="Minimise" onClick={() => setOpen(false)}>
                <Minus size={17} />
              </IconButton>
            </header>

            <div className="flex items-center justify-between gap-2 border-b border-rule bg-paper-2/60 px-4 py-2">
              <span className="text-xs text-ink-2">How I act</span>
              <Segmented
                size="sm"
                label="Agent mode"
                value={mode}
                onChange={(v) => updateSettings({ agentMode: v })}
                options={[
                  { value: "ui", label: "Show me" },
                  { value: "background", label: "Background" },
                ]}
              />
            </div>

            <div ref={listRef} className="scrollbar-thin flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
              {entries.length === 0 ? (
                <div>
                  <p className="text-sm text-ink">I can run anything in this app for you: look things up, fill in forms, press the buttons.</p>
                  <p className="mt-1.5 text-sm text-ink-3">
                    {mode === "ui" ? "You'll see me move around the screen as I work." : "I'll work quietly and tell you what changed."}
                  </p>
                  <div className="mt-4 flex flex-col items-start gap-2">
                    {suggestions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => submit(s)}
                        className="cursor-pointer rounded-[10px] bg-paper-2 px-3 py-2 text-left text-[13px] text-ink-2 ring-1 ring-inset ring-rule transition-colors hover:bg-heat-wash hover:text-ink"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                entries.map((e) => <EntryView key={e.id} entry={e} onConfirm={answerConfirm} />)
              )}
            </div>

            <form
              className="border-t border-rule p-3"
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              <div className="flex items-end gap-2 rounded-[10px] bg-paper-2 p-1.5 ring-1 ring-inset ring-rule focus-within:ring-2 focus-within:ring-heat">
                <label htmlFor="agent-input" className="sr-only">
                  Message the agent
                </label>
                <textarea
                  id="agent-input"
                  ref={inputRef}
                  rows={1}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      submit();
                    }
                  }}
                  placeholder={running ? "Working on it" : "Ask or tell me what to do"}
                  className="max-h-32 min-h-9 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-ink placeholder:text-ink-3 focus:outline-none"
                />
                {running ? (
                  <Button size="sm" variant="secondary" onClick={stop} aria-label="Stop the agent" className="h-8 w-8 px-0">
                    <Stop size={14} weight="fill" />
                  </Button>
                ) : (
                  <Button size="sm" variant="primary" type="submit" disabled={!text.trim()} aria-label="Send" className="h-8 w-8 px-0">
                    <ArrowUp size={16} weight="bold" />
                  </Button>
                )}
              </div>
              <div className="mt-2 flex items-center gap-1.5 px-1 text-[11px] text-ink-3" title="WebMCP lets agents built into the browser use the same tools as this chat.">
                <Globe size={12} />
                {webmcp ? <span>WebMCP on: {webmcp} tools shared with your browser&apos;s agent</span> : <span>WebMCP not available in this browser</span>}
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Orb({ busy, dark }: { busy: boolean; dark?: boolean }) {
  return (
    <span className="relative grid size-6 shrink-0 place-items-center" aria-hidden>
      <span className={cn("absolute inset-0 rounded-full", dark ? "bg-heat-wash" : "bg-white/15")} />
      <motion.span
        className="relative size-2.5 rounded-full bg-heat"
        animate={busy ? { scale: [1, 1.5, 1] } : { scale: 1 }}
        transition={busy ? { duration: 1.1, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2 }}
      />
    </span>
  );
}

function EntryView({ entry, onConfirm }: { entry: Entry; onConfirm: (id: string, ok: boolean) => void }) {
  switch (entry.role) {
    case "user":
      return (
        <div className="flex justify-end">
          <div className="max-w-[85%] rounded-[12px] rounded-br-[4px] bg-dock px-3 py-2 text-sm whitespace-pre-wrap text-dock-ink">{entry.text}</div>
        </div>
      );
    case "assistant":
      return <div className="text-sm leading-relaxed text-ink">{renderText(entry.text)}</div>;
    case "step": {
      const s = entry.step;
      return (
        <motion.div
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.22, ease: [0.05, 0.7, 0.1, 1] }}
          className="flex items-start gap-2.5 border-l-2 border-dashed border-rule-strong py-0.5 pl-3"
        >
          <span className="mt-0.5 shrink-0">
            {s.status === "running" ? (
              <CircleNotch size={14} className="animate-spin text-heat" />
            ) : s.status === "done" ? (
              <Check size={14} weight="bold" className="text-good" />
            ) : (
              <WarningCircle size={14} weight="fill" className="text-bad" />
            )}
          </span>
          <div className="min-w-0 text-[13px]">
            <span className={cn(s.status === "running" ? "text-ink" : "text-ink-2")}>{s.title}</span>
            {s.mode !== "read" && s.status !== "error" && <span className="ml-1.5 text-xs text-ink-3">{s.mode === "ui" ? "on screen" : "in background"}</span>}
            {s.error && <div className="mt-0.5 text-xs text-bad">{s.error}</div>}
          </div>
        </motion.div>
      );
    }
    case "confirm":
      return (
        <div className="rounded-[10px] bg-warn-wash p-3 ring-1 ring-inset ring-warn/25">
          <p className="text-sm font-medium text-ink">{entry.question}</p>
          {entry.state === "pending" ? (
            <div className="mt-2.5 flex gap-2">
              <Button size="sm" variant="primary" onClick={() => onConfirm(entry.id, true)}>
                Approve
              </Button>
              <Button size="sm" variant="secondary" onClick={() => onConfirm(entry.id, false)}>
                Deny
              </Button>
            </div>
          ) : (
            <p className="mt-1 text-xs text-ink-2">{entry.state === "approved" ? "Approved" : "Denied"}</p>
          )}
        </div>
      );
    case "notice":
      return <p className={cn("text-xs", entry.tone === "error" ? "text-bad" : "text-ink-3")}>{entry.text}</p>;
  }
}

/** Minimal markdown: paragraphs, "- " bullets and **bold**. */
function renderText(text: string) {
  const blocks = text.split(/\n{2,}/);
  return blocks.map((block, i) => {
    const lines = block.split("\n");
    if (lines.every((l) => /^\s*[-*•]\s+/.test(l))) {
      return (
        <ul key={i} className="my-1.5 list-disc space-y-0.5 pl-5 marker:text-ink-3">
          {lines.map((l, j) => (
            <li key={j}>{inline(l.replace(/^\s*[-*•]\s+/, ""))}</li>
          ))}
        </ul>
      );
    }
    return (
      <p key={i} className="my-1.5 first:mt-0 last:mb-0">
        {lines.map((l, j) => (
          <Fragment key={j}>
            {j > 0 && <br />}
            {inline(l)}
          </Fragment>
        ))}
      </p>
    );
  });
}

function inline(s: string) {
  return s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="font-semibold">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <Fragment key={i}>{part.replace(/`([^`]+)`/g, "$1")}</Fragment>
    ),
  );
}
