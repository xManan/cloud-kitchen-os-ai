"use client";

import { useEffect, useRef } from "react";
import type { FieldValues, Path, UseFormReturn } from "react-hook-form";

export type SubmitOutcome = { ok: true; result: unknown } | { ok: false; error: string };

/** A live form on screen that the agent can see, fill and submit. */
export interface RegisteredForm {
  id: string;
  title: string;
  root: () => HTMLFormElement | null;
  fields: () => string[];
  setValue: (name: string, value: unknown) => void;
  getValues: () => Record<string, unknown>;
  /** Grow or shrink a field array (e.g. order lines) to `length` rows. */
  ensureArray: (name: string, length: number) => void;
  /** Resolves on the next submit attempt with the action result or validation errors. */
  awaitSubmit: () => Promise<SubmitOutcome>;
}

const forms = new Map<string, RegisteredForm>();
const listeners = new Set<() => void>();

export function getForm(id: string) {
  return forms.get(id);
}

export function listForms() {
  return [...forms.values()].map((f) => ({ id: f.id, title: f.title, fields: f.fields() }));
}

export function waitForForm(id: string, timeoutMs = 4000): Promise<RegisteredForm> {
  const existing = forms.get(id);
  if (existing?.root()) return Promise.resolve(existing);
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      listeners.delete(check);
      reject(new Error(`Form "${id}" did not open`));
    }, timeoutMs);
    function check() {
      const f = forms.get(id);
      if (f?.root()) {
        clearTimeout(t);
        listeners.delete(check);
        resolve(f);
      }
    }
    listeners.add(check);
  });
}

function notify() {
  // Let React commit the DOM before waiters look for the form element.
  requestAnimationFrame(() => listeners.forEach((l) => l()));
}

interface ArrayCtl {
  /** Set the number of rows in one step (append blanks or drop trailing rows). */
  resize: (length: number) => void;
}

/**
 * Register a react-hook-form instance with the agent. `onValid` runs the real store action
 * and returns its result, which flows back to the agent through `awaitSubmit`.
 */
export function useAgentForm<T extends FieldValues>(opts: {
  id: string;
  title: string;
  form: UseFormReturn<T, unknown, FieldValues>;
  formRef: React.RefObject<HTMLFormElement | null>;
  arrays?: Record<string, ArrayCtl>;
}) {
  const pending = useRef<((o: SubmitOutcome) => void) | null>(null);
  const optsRef = useRef(opts);
  useEffect(() => {
    optsRef.current = opts;
  });

  useEffect(() => {
    const { id, title } = optsRef.current;
    const reg: RegisteredForm = {
      id,
      title,
      root: () => optsRef.current.formRef.current,
      fields: () =>
        [...(optsRef.current.formRef.current?.querySelectorAll<HTMLElement>("[name]") ?? [])].map((el) => el.getAttribute("name")!),
      setValue: (name, value) =>
        optsRef.current.form.setValue(name as Path<T>, value as never, { shouldDirty: true, shouldValidate: false }),
      getValues: () => optsRef.current.form.getValues() as Record<string, unknown>,
      ensureArray: (name, length) => {
        optsRef.current.arrays?.[name]?.resize(length);
      },
      awaitSubmit: () =>
        new Promise<SubmitOutcome>((resolve) => {
          pending.current = resolve;
        }),
    };
    forms.set(id, reg);
    notify();
    return () => {
      if (forms.get(id) === reg) forms.delete(id);
    };
  }, []);

  /** Call from the form's submit path with the outcome. */
  return {
    settle(outcome: SubmitOutcome) {
      pending.current?.(outcome);
      pending.current = null;
    },
  };
}
