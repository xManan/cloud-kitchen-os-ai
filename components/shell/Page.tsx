"use client";

import { Lightning } from "@phosphor-icons/react";
import { motion, useReducedMotion } from "motion/react";
import { Children, useEffect, useState } from "react";
import { cn } from "@/components/ui";
import { useAgent } from "@/lib/agent/agent-store";
import { useUI } from "@/lib/ui-store";

/**
 * Page wrapper. `data-page` lets the agent know a navigation has landed.
 * Entrance: the one orchestrated moment per route (8px rise, 30ms micro-cascade, under 300ms total).
 */
export function PageFrame({ route, children, className }: { route: string; children: React.ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  const items = Children.toArray(children);
  return (
    <div data-page={route} className={cn("flex flex-col gap-6", className)}>
      {items.map((child, i) => (
        <motion.div
          key={i}
          className="min-w-0"
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, delay: Math.min(i, 8) * 0.03, ease: [0.05, 0.7, 0.1, 1] }}
        >
          {child}
        </motion.div>
      ))}
    </div>
  );
}

/** Re-render on an interval so ticket ages and clocks stay current. */
export function useNow(ms = 30000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export function askAgent(prompt: string) {
  useUI.getState().setDockOpen(true);
  void useAgent.getState().send(prompt);
}

/** Inline hand-off to the agent, used next to things that need attention. */
export function AgentButton({ prompt, children = "Let the agent handle it", className }: { prompt: string; children?: React.ReactNode; className?: string }) {
  const running = useAgent((s) => s.running);
  return (
    <button
      type="button"
      disabled={running}
      onClick={() => askAgent(prompt)}
      className={cn(
        "inline-flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-heat ring-1 ring-inset ring-heat/30 transition-colors hover:bg-heat-wash disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      <Lightning size={12} weight="fill" />
      {children}
    </button>
  );
}

export function minutesAgo(iso: string, now = Date.now()) {
  return Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
}

export function relTime(iso: string, now = Date.now()) {
  const m = minutesAgo(iso, now);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return `${d} d ago`;
}

export function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
