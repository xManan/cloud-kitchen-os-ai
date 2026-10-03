"use client";

import { create } from "zustand";

type Theme = "light" | "dark" | "system";

interface UIState {
  /** Id of the form sheet currently open, plus optional initial values. */
  form: { id: string; initial?: Record<string, unknown> } | null;
  openForm: (id: string, initial?: Record<string, unknown>) => void;
  closeForm: () => void;
  dockOpen: boolean;
  setDockOpen: (open: boolean) => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  navOpen: boolean;
  setNavOpen: (open: boolean) => void;
}

function readTheme(): Theme {
  try {
    return (localStorage.getItem("kos-theme") as Theme) || "light";
  } catch {
    return "light";
  }
}

export function applyTheme(t: Theme) {
  const root = document.documentElement;
  if (t === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", t);
}

export const useUI = create<UIState>()((set) => ({
  form: null,
  openForm: (id, initial) => set({ form: { id, initial } }),
  closeForm: () => set({ form: null }),
  dockOpen: false,
  setDockOpen: (dockOpen) => set({ dockOpen }),
  theme: typeof window === "undefined" ? "light" : readTheme(),
  setTheme: (theme) => {
    try {
      localStorage.setItem("kos-theme", theme);
    } catch {}
    applyTheme(theme);
    set({ theme });
  },
  navOpen: false,
  setNavOpen: (navOpen) => set({ navOpen }),
}));

export function resolvedTheme(): "light" | "dark" {
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "light" || attr === "dark") return attr;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
