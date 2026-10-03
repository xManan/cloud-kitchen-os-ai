"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCursor } from "@/lib/agent/driver";

/**
 * The agent's visible hand. Primary motion: the arrow glides on the signature curve.
 * Secondary: the caption trails on a soft spring. Press: the arrow dips and a ring expands.
 */
export function GhostCursor() {
  const { visible, x, y, travel, pressing, caption } = useCursor();
  const ease = [0.2, 0, 0, 1] as const;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="cursor"
          aria-hidden
          className="pointer-events-none fixed top-0 left-0 z-[100]"
          initial={{ opacity: 0, x, y, scale: 0.6 }}
          animate={{ opacity: 1, x, y, scale: 1 }}
          exit={{ opacity: 0, scale: 0.6, transition: { duration: 0.16, ease: [0.3, 0, 1, 1] } }}
          transition={{ x: { duration: travel, ease }, y: { duration: travel, ease }, opacity: { duration: 0.18 }, scale: { duration: 0.24, ease } }}
        >
          <AnimatePresence>
            {pressing && (
              <motion.span
                key="ring"
                className="absolute -top-4 -left-4 size-8 rounded-full ring-2 ring-heat"
                initial={{ scale: 0.3, opacity: 0.9 }}
                animate={{ scale: 1.4, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4, ease: [0.05, 0.7, 0.1, 1] }}
              />
            )}
          </AnimatePresence>
          <motion.svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            className="-translate-x-[3px] -translate-y-[2px] drop-shadow-[0_4px_10px_rgb(194_65_12/0.45)]"
            animate={{ scale: pressing ? 0.82 : 1 }}
            transition={{ duration: 0.12, ease }}
          >
            {/* Pointer glyph drawn as a plain triangle so it reads as a cursor, not an icon. */}
            <path d="M3 2.5 20 11l-7.2 1.8L9.6 20z" fill="var(--heat)" stroke="var(--paper)" strokeWidth="1.6" strokeLinejoin="round" />
          </motion.svg>
          <motion.div
            className="absolute top-5 left-4 flex items-center gap-1.5 rounded-full bg-heat py-1 pr-2.5 pl-2 text-xs font-medium whitespace-nowrap text-heat-ink shadow-[var(--shadow)]"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
          >
            <span className="font-semibold">Agent</span>
            {caption && <span className="opacity-85">{caption}</span>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
