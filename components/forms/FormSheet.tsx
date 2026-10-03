"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRef } from "react";
import { useFieldArray, useForm, type FieldValues, type UseFieldArrayReturn, type UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { Button, Sheet } from "@/components/ui";
import { useCursor } from "@/lib/agent/driver";
import { useAgentForm } from "@/lib/agent/forms";
import type { Actor } from "@/lib/store";
import { useUI } from "@/lib/ui-store";

export interface FormApi {
  form: UseFormReturn<FieldValues, unknown, FieldValues>;
  array: UseFieldArrayReturn<FieldValues, string, "key"> | null;
  err: (name: string) => string | undefined;
}

interface Props {
  id: string;
  title: string;
  description?: string;
  schema: z.ZodObject;
  defaults: Record<string, unknown>;
  arrayName?: string;
  blankRow?: Record<string, unknown>;
  submitLabel: string;
  /** Runs the real store action. Throw to show an error on the form. */
  action: (values: Record<string, unknown>, actor: Actor) => unknown;
  success: (result: unknown) => string;
  children: (api: FormApi) => React.ReactNode;
  width?: number;
}

/**
 * A form in a side sheet that both people and the agent use. The agent finds it through
 * the form registry, types into the same inputs and presses the same submit button.
 */
export function FormSheet(props: Props) {
  const current = useUI((s) => s.form);
  const closeForm = useUI((s) => s.closeForm);
  const open = current?.id === props.id;
  return (
    <Sheet open={open} onOpenChange={(o) => !o && closeForm()} title={props.title} description={props.description} width={props.width}>
      {open && <FormBody {...props} initial={current?.initial} />}
    </Sheet>
  );
}

function FormBody({ id, title, schema, defaults, arrayName, blankRow, submitLabel, action, success, children, initial }: Props & { initial?: Record<string, unknown> }) {
  const closeForm = useUI((s) => s.closeForm);
  const formRef = useRef<HTMLFormElement>(null);
  const form = useForm<FieldValues, unknown, FieldValues>({
    resolver: zodResolver(schema as never) as never,
    defaultValues: { ...defaults, ...initial },
    mode: "onSubmit",
  });
  // A form has at most one repeating group (order lines, PO lines, invoice lines).
  const fa = useFieldArray({ control: form.control, name: arrayName ?? "__none", keyName: "key" });
  const array = arrayName ? fa : null;

  const { settle } = useAgentForm({
    id,
    title,
    form,
    formRef,
    arrays: arrayName
      ? {
          [arrayName]: {
            resize: (n) => {
              const cur = (form.getValues(arrayName) as unknown[] | undefined)?.length ?? 0;
              if (n > cur) fa.append(Array.from({ length: n - cur }, () => ({ ...blankRow })));
              else if (n < cur) fa.remove(Array.from({ length: cur - n }, (_, i) => n + i));
            },
          },
        }
      : undefined,
  });

  const onValid = (values: FieldValues) => {
    const actor: Actor = useCursor.getState().visible ? "agent" : "user";
    try {
      const result = action(values, actor);
      toast.success(success(result), { description: actor === "agent" ? "Done by the agent" : undefined });
      settle({ ok: true, result });
      closeForm();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      form.setError("root", { message: msg });
      settle({ ok: false, error: msg });
    }
  };

  const onInvalid = (errors: Record<string, unknown>) => {
    const flat: string[] = [];
    const walk = (o: unknown, path: string) => {
      if (!o || typeof o !== "object") return;
      const rec = o as Record<string, unknown>;
      if (typeof rec.message === "string") flat.push(`${path}: ${rec.message}`);
      for (const [k, v] of Object.entries(rec)) if (k !== "ref" && k !== "message" && k !== "type") walk(v, path ? `${path}.${k}` : k);
    };
    walk(errors, "");
    settle({ ok: false, error: `The form has errors: ${flat.join("; ")}` });
  };

  const err = (name: string) => {
    const parts = name.split(".");
    let cur: unknown = form.formState.errors;
    for (const p of parts) cur = (cur as Record<string, unknown> | undefined)?.[p];
    return (cur as { message?: string } | undefined)?.message;
  };

  return (
    <form ref={formRef} data-agent-form={id} onSubmit={form.handleSubmit(onValid, onInvalid)} className="flex flex-col gap-4" noValidate>
      {children({ form, array, err })}
      {form.formState.errors.root?.message && (
        <p role="alert" className="rounded-[8px] bg-bad-wash px-3 py-2 text-sm text-bad">
          {form.formState.errors.root.message}
        </p>
      )}
      <div className="sticky bottom-0 -mx-6 mt-2 flex justify-end gap-2 border-t border-rule bg-paper px-6 py-4">
        <Button variant="ghost" onClick={closeForm}>
          Cancel
        </Button>
        <Button variant="primary" type="submit" data-agent-submit>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
