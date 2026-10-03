"use client";

import { create } from "zustand";
import { getKitchen } from "@/lib/store";
import { useUI } from "@/lib/ui-store";
import { getForm, waitForForm, type RegisteredForm, type SubmitOutcome } from "./forms";

/**
 * The UI driver performs actions the way a person would: it moves a visible cursor,
 * clicks real buttons and types into real inputs. Tools call it in "Show me" mode.
 */

interface CursorState {
  visible: boolean;
  x: number;
  y: number;
  /** Travel duration for the current move, in seconds. */
  travel: number;
  pressing: boolean;
  caption: string;
  set: (p: Partial<Omit<CursorState, "set">>) => void;
}

export const useCursor = create<CursorState>()((set) => ({
  visible: false,
  x: 0,
  y: 0,
  travel: 0.5,
  pressing: false,
  caption: "",
  set: (p) => set(p),
}));

type Router = { push: (href: string) => void };
let router: Router | null = null;
let currentPath = "/";
let abortCtl: AbortController | null = null;

export function bindRouter(r: Router) {
  router = r;
}
export function setCurrentPath(p: string) {
  currentPath = p;
}
export function getCurrentPath() {
  return currentPath;
}

export class AgentAborted extends Error {
  constructor() {
    super("Stopped by user");
  }
}

export function beginRun() {
  abortCtl = new AbortController();
  return abortCtl;
}
export function abortRun() {
  abortCtl?.abort();
  useCursor.getState().set({ visible: false, pressing: false });
}

function checkAbort() {
  if (abortCtl?.signal.aborted) throw new AgentAborted();
}

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const fast = () => getKitchen().settings.agentSpeed === "fast";

export function sleep(ms: number) {
  return new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    abortCtl?.signal.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new AgentAborted());
    });
  });
}

export async function waitFor<T extends Element>(selector: string, timeoutMs = 5000): Promise<T> {
  const start = performance.now();
  while (performance.now() - start < timeoutMs) {
    checkAbort();
    const el = document.querySelector<T>(selector);
    if (el) return el;
    await sleep(50);
  }
  throw new Error(`Could not find ${selector} on screen`);
}

function caption(text: string) {
  useCursor.getState().set({ caption: text });
}

export async function navigate(path: string) {
  checkAbort();
  const route = path.split("?")[0];
  if (currentPath !== route) {
    const navLink = document.querySelector<HTMLElement>(`[data-agent-nav="${route}"]`);
    if (navLink && isVisible(navLink)) {
      caption("Opening page");
      await moveTo(navLink);
      await press();
    }
    useUI.getState().closeForm();
    router?.push(path);
  }
  await waitFor(`[data-page="${route}"]`, 8000);
  await sleep(reducedMotion() ? 0 : 280);
}

function isVisible(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

/** Glide the agent cursor to an element's center. Duration scales with distance. */
export async function moveTo(el: Element) {
  checkAbort();
  const cur = useCursor.getState();
  const rect0 = el.getBoundingClientRect();
  if (rect0.top < 60 || rect0.bottom > window.innerHeight - 40) {
    el.scrollIntoView({ block: "center", behavior: reducedMotion() ? "auto" : "smooth" });
    await sleep(reducedMotion() ? 0 : 320);
  }
  const r = el.getBoundingClientRect();
  const x = r.left + Math.min(r.width / 2, 40);
  const y = r.top + r.height / 2;
  if (!cur.visible) {
    // Enter from the dock corner so the cursor visibly comes from the agent.
    cur.set({ visible: true, x: 48, y: window.innerHeight - 64, travel: 0 });
    await sleep(30);
  }
  const dist = Math.hypot(x - useCursor.getState().x, y - useCursor.getState().y);
  const travel = reducedMotion() ? 0 : Math.min(0.75, 0.28 + dist / 1800) * (fast() ? 0.55 : 1);
  useCursor.getState().set({ x, y, travel });
  await sleep(travel * 1000 + 40);
}

async function press() {
  useCursor.getState().set({ pressing: true });
  await sleep(fast() ? 70 : 130);
  useCursor.getState().set({ pressing: false });
}

export async function click(target: string | HTMLElement, label?: string) {
  const el = typeof target === "string" ? await waitFor<HTMLElement>(target) : target;
  if (label) caption(label);
  await moveTo(el);
  await press();
  el.click();
  await sleep(fast() ? 80 : 180);
}

/** Briefly ring an element, e.g. the row the agent just created. */
export async function flash(selector: string) {
  try {
    const el = await waitFor<HTMLElement>(selector, 2500);
    el.scrollIntoView({ block: "center", behavior: reducedMotion() ? "auto" : "smooth" });
    el.setAttribute("data-agent-active", "true");
    setTimeout(() => el.removeAttribute("data-agent-active"), 1600);
  } catch {
    /* row may be filtered out of view; not an error */
  }
}

function flatten(values: Record<string, unknown>, prefix = ""): [string, unknown][] {
  const out: [string, unknown][] = [];
  for (const [k, v] of Object.entries(values)) {
    if (v === undefined || v === null || v === "") continue;
    const key = prefix ? `${prefix}.${k}` : k;
    if (Array.isArray(v)) {
      v.forEach((row, i) => {
        if (row && typeof row === "object") out.push(...flatten(row as Record<string, unknown>, `${key}.${i}`));
        else out.push([`${key}.${i}`, row]);
      });
    } else if (typeof v === "object") {
      out.push(...flatten(v as Record<string, unknown>, key));
    } else {
      out.push([key, v]);
    }
  }
  return out;
}

async function typeInto(form: RegisteredForm, name: string, value: unknown) {
  const root = form.root();
  const el = root?.querySelector<HTMLElement>(`[name="${CSS.escape(name)}"]`);
  if (!el) {
    form.setValue(name, value);
    return;
  }
  caption(`Filling ${el.getAttribute("data-label") ?? name.split(".").pop()}`);
  await moveTo(el);
  el.setAttribute("data-agent-active", "true");
  try {
    if (el instanceof HTMLSelectElement || (el instanceof HTMLInputElement && ["date", "time", "hidden"].includes(el.type))) {
      await press();
      form.setValue(name, String(value));
      await sleep(fast() ? 90 : 220);
    } else if (el instanceof HTMLInputElement && el.type === "checkbox") {
      await press();
      form.setValue(name, Boolean(value));
    } else {
      el.focus({ preventScroll: true });
      const text = String(value);
      const perChar = reducedMotion() ? 0 : fast() ? 8 : Math.max(14, Math.min(38, 600 / Math.max(text.length, 1)));
      if (!perChar) form.setValue(name, text);
      for (let i = 1; i <= text.length && perChar; i++) {
        form.setValue(name, text.slice(0, i));
        await sleep(perChar);
      }
      el.blur();
    }
  } finally {
    el.removeAttribute("data-agent-active");
  }
}

/**
 * Open a form sheet on a page, fill it field by field and press its submit button.
 * Returns the action result, or throws with the validation message the person would see.
 */
export async function fillAndSubmit(opts: {
  route: string;
  formId: string;
  values: Record<string, unknown>;
  submit?: boolean;
}): Promise<unknown> {
  await navigate(opts.route);
  if (!getForm(opts.formId)?.root()) {
    const opener = document.querySelector<HTMLElement>(`[data-agent-open="${opts.formId}"]`);
    if (opener && isVisible(opener)) await click(opener, "Opening form");
    else useUI.getState().openForm(opts.formId);
  }
  const form = await waitForForm(opts.formId);
  await sleep(reducedMotion() ? 0 : 260);

  for (const [key, v] of Object.entries(opts.values)) {
    if (Array.isArray(v)) form.ensureArray(key, v.length);
  }
  await sleep(60);
  for (const [name, value] of flatten(opts.values)) {
    await typeInto(form, name, value);
  }
  if (opts.submit === false) {
    caption("Waiting for you to review");
    await sleep(600);
    useCursor.getState().set({ visible: false });
    return { status: "filled_not_submitted", note: "The form is filled in and open for the user to review and submit." };
  }
  const submitBtn = form.root()?.querySelector<HTMLElement>("[data-agent-submit]");
  const outcome: Promise<SubmitOutcome> = form.awaitSubmit();
  if (submitBtn) await click(submitBtn, "Submitting");
  else form.root()?.requestSubmit();
  const res = await outcome;
  if (!res.ok) throw new Error(res.error);
  return res.result;
}

export function hideCursor() {
  useCursor.getState().set({ visible: false, caption: "" });
}
