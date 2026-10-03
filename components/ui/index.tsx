"use client";

import * as Dialog from "@radix-ui/react-dialog";
import * as SwitchPrim from "@radix-ui/react-switch";
import { X } from "@phosphor-icons/react";
import { clsx, type ClassValue } from "clsx";
import { motion } from "motion/react";
import { forwardRef } from "react";
import { twMerge } from "tailwind-merge";

export const cn = (...c: ClassValue[]) => twMerge(clsx(c));

type BtnVariant = "primary" | "secondary" | "ghost" | "danger";
const btnBase =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-control)] text-sm font-medium transition-[background,color,box-shadow,transform] duration-150 ease-[var(--ease)] active:translate-y-px disabled:opacity-50 disabled:pointer-events-none cursor-pointer";
const btnVariants: Record<BtnVariant, string> = {
  primary: "bg-heat text-heat-ink hover:bg-heat-hover",
  secondary: "bg-paper text-ink ring-1 ring-inset ring-rule-strong hover:bg-paper-2",
  ghost: "text-ink-2 hover:text-ink hover:bg-paper-2",
  danger: "bg-paper text-bad ring-1 ring-inset ring-rule-strong hover:bg-bad-wash",
};
const btnSizes = { sm: "h-8 px-3", md: "h-9 px-3.5", lg: "h-10 px-4" };

export const Button = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: keyof typeof btnSizes }
>(function Button({ variant = "secondary", size = "md", className, type = "button", ...p }, ref) {
  return <button ref={ref} type={type} className={cn(btnBase, btnVariants[variant], btnSizes[size], className)} {...p} />;
});

export function IconButton({ label, className, children, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn("inline-flex size-8 items-center justify-center rounded-[var(--radius-control)] text-ink-2 transition-colors hover:bg-paper-2 hover:text-ink cursor-pointer", className)}
      {...p}
    >
      {children}
    </button>
  );
}

export type Tone = "neutral" | "good" | "warn" | "bad" | "heat" | "info";
const toneCls: Record<Tone, string> = {
  neutral: "bg-paper-2 text-ink-2 ring-rule",
  good: "bg-good-wash text-good ring-good/25",
  warn: "bg-warn-wash text-warn ring-warn/25",
  bad: "bg-bad-wash text-bad ring-bad/25",
  heat: "bg-heat-wash text-heat ring-heat/25",
  info: "bg-paper-2 text-ink ring-rule-strong",
};

export function Badge({ tone = "neutral", children, className, icon }: { tone?: Tone; children: React.ReactNode; className?: string; icon?: React.ReactNode }) {
  return (
    <span className={cn("inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-full px-2.5 text-xs font-medium ring-1 ring-inset", toneCls[tone], className)}>
      {icon}
      {children}
    </span>
  );
}

export function Panel({ className, children, ...p }: React.HTMLAttributes<HTMLElement>) {
  return (
    <section className={cn("relative min-w-0 rounded-[var(--radius-panel)] bg-paper ring-1 ring-rule", className)} {...p}>
      {children}
    </section>
  );
}

export function PanelHeader({ title, sub, actions, className }: { title: React.ReactNode; sub?: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3 px-5 pt-4 pb-3", className)}>
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
        {sub && <p className="mt-0.5 text-[13px] text-ink-3">{sub}</p>}
      </div>
      {actions && <div className="flex min-w-0 max-w-full items-center gap-2">{actions}</div>}
    </div>
  );
}

export function PageHeader({ title, sub, actions }: { title: string; sub?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 pb-6">
      <div className="min-w-0">
        <h1 className="font-display text-[28px] leading-[1.1] font-semibold tracking-[-0.02em] text-ink md:text-[32px]">{title}</h1>
        {sub && <p className="mt-1.5 max-w-[65ch] text-sm text-ink-2">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** A metric in plain layout (no card). Density 7: hairlines and space, not boxes. */
export function Metric({ label, value, delta, hint, className }: { label: string; value: React.ReactNode; delta?: { text: string; good: boolean } | null; hint?: string; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="text-[13px] text-ink-3">{label}</div>
      <div className="num mt-1 font-display text-[26px] leading-none font-semibold tracking-[-0.01em] text-ink">{value}</div>
      {(delta || hint) && (
        <div className="mt-1.5 flex items-center gap-2 text-xs">
          {delta && <span className={cn("num font-medium", delta.good ? "text-good" : "text-bad")}>{delta.text}</span>}
          {hint && <span className="text-ink-3">{hint}</span>}
        </div>
      )}
    </div>
  );
}

// ---------- Form fields: label above, error below ----------

export function Field({ label, error, hint, htmlFor, children, className }: { label: string; error?: string; hint?: string; htmlFor?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-ink-3">{hint}</p>}
      {error && (
        <p role="alert" className="text-xs font-medium text-bad">
          {error}
        </p>
      )}
    </div>
  );
}

const inputCls =
  "h-9 w-full rounded-[var(--radius-control)] bg-paper px-3 text-sm text-ink ring-1 ring-inset ring-rule-strong placeholder:text-ink-3 transition-shadow duration-150 focus:outline-none focus:ring-2 focus:ring-heat aria-[invalid=true]:ring-bad";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...p }, ref) {
  return <input ref={ref} className={cn(inputCls, className)} {...p} />;
});

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...p }, ref) {
  return (
    <select ref={ref} className={cn(inputCls, "cursor-pointer appearance-none bg-[length:16px] bg-[right_10px_center] bg-no-repeat pr-8", "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 256 256'%3E%3Cpath fill='%237b8794' d='M213.66 101.66l-80 80a8 8 0 0 1-11.32 0l-80-80a8 8 0 0 1 11.32-11.32L128 164.69l74.34-74.35a8 8 0 0 1 11.32 11.32Z'/%3E%3C/svg%3E\")]", className)} {...p}>
      {children}
    </select>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...p }, ref) {
  return <textarea ref={ref} className={cn(inputCls, "h-auto min-h-[88px] py-2 leading-relaxed", className)} {...p} />;
});

export function Switch({ checked, onCheckedChange, label, ...p }: { checked: boolean; onCheckedChange: (v: boolean) => void; label: string } & Omit<React.HTMLAttributes<HTMLButtonElement>, "onChange">) {
  return (
    <SwitchPrim.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      aria-label={label}
      className="relative h-5 w-9 shrink-0 cursor-pointer rounded-full bg-rule-strong transition-colors duration-150 data-[state=checked]:bg-good"
      {...p}
    >
      <SwitchPrim.Thumb className="block size-4 translate-x-0.5 rounded-full bg-paper shadow-sm transition-transform duration-150 ease-[var(--ease)] data-[state=checked]:translate-x-[18px]" />
    </SwitchPrim.Root>
  );
}

export function Segmented<T extends string>({ value, onChange, options, label, size = "md" }: { value: T; onChange: (v: T) => void; options: { value: T; label: React.ReactNode }[]; label: string; size?: "sm" | "md" }) {
  return (
    <div role="radiogroup" aria-label={label} className="scrollbar-thin inline-flex max-w-full overflow-x-auto rounded-[var(--radius-control)] bg-paper-2 p-0.5 ring-1 ring-inset ring-rule">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "relative shrink-0 cursor-pointer rounded-[6px] font-medium text-ink-2 transition-colors hover:text-ink",
            size === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3 text-[13px]",
            value === o.value && "text-ink",
          )}
        >
          {value === o.value && <motion.span layoutId={`seg-${label}`} className="absolute inset-0 rounded-[6px] bg-paper shadow-sm ring-1 ring-rule" transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }} />}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

/** Right-side sheet. Non-modal so the agent dock stays usable while a form is open. */
export function Sheet({ open, onOpenChange, title, description, children, width = 480 }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: string; children: React.ReactNode; width?: number }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange} modal={false}>
      <Dialog.Portal>
        {open && <div className="fixed inset-0 z-40 bg-[rgb(14_19_22/0.28)]" aria-hidden onClick={() => onOpenChange(false)} />}
        <Dialog.Content
          onInteractOutside={(e) => {
            const t = e.target as HTMLElement | null;
            if (t?.closest("[data-agent-dock]")) e.preventDefault();
          }}
          onOpenAutoFocus={(e) => e.preventDefault()}
          style={{ maxWidth: width }}
          className="fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-paper shadow-[var(--shadow)] ring-1 ring-rule data-[state=open]:animate-[sheet-in_320ms_var(--ease-in)]"
        >
          <div className="flex items-start justify-between gap-4 border-b border-rule px-6 py-5">
            <div>
              <Dialog.Title className="font-display text-xl font-semibold tracking-[-0.01em] text-ink">{title}</Dialog.Title>
              {description ? <Dialog.Description className="mt-1 text-sm text-ink-2">{description}</Dialog.Description> : <Dialog.Description className="sr-only">{title}</Dialog.Description>}
            </div>
            <Dialog.Close asChild>
              <IconButton label="Close">
                <X size={18} />
              </IconButton>
            </Dialog.Close>
          </div>
          <div className="scrollbar-thin flex-1 overflow-y-auto px-6 py-5">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function Th({ className, children, ...p }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className={cn("h-9 px-3 text-left text-xs font-medium whitespace-nowrap text-ink-3 first:pl-5 last:pr-5", className)} {...p}>
      {children}
    </th>
  );
}
export function Td({ className, children, ...p }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn("h-11 px-3 text-sm text-ink first:pl-5 last:pr-5", className)} {...p}>
      {children}
    </td>
  );
}
export function Table({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("scrollbar-thin relative overflow-x-auto", className)}>
      <table className="w-full border-collapse [&_tbody_tr]:border-t [&_tbody_tr]:border-rule [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-paper-2/60">{children}</table>
    </div>
  );
}

export function Empty({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2 px-5 py-10">
      <p className="text-sm font-medium text-ink">{title}</p>
      {body && <p className="max-w-[48ch] text-sm text-ink-3">{body}</p>}
      {action}
    </div>
  );
}

export function Meter({ value, tone = "neutral", label }: { value: number; tone?: Tone; label: string }) {
  const color = tone === "bad" ? "bg-bad" : tone === "warn" ? "bg-warn" : tone === "good" ? "bg-good" : "bg-ink-3";
  return (
    <div role="meter" aria-label={label} aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100} className="h-1.5 w-full overflow-hidden rounded-full bg-paper-2 ring-1 ring-inset ring-rule">
      <div className={cn("h-full rounded-full transition-[width] duration-500 ease-[var(--ease)]", color)} style={{ width: `${Math.min(100, Math.max(2, value * 100))}%` }} />
    </div>
  );
}
