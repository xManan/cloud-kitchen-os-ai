"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { cn } from "@/components/ui";
import { fmtMoney } from "@/lib/analytics";

/** Series colors come from the validated dataviz categorical order; slot follows the entity. */
export const SERIES = ["var(--s1)", "var(--s2)", "var(--s3)"];
const axisTick = { fill: "var(--ink-3)", fontSize: 11 };

function TooltipBox({ title, rows }: { title: string; rows: { label: string; value: string; color?: string }[] }) {
  return (
    <div className="min-w-[160px] rounded-[10px] bg-paper px-3 py-2.5 text-xs shadow-[var(--shadow)] ring-1 ring-rule">
      <div className="mb-1.5 font-medium text-ink">{title}</div>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5 text-ink-2">
            {r.color && <span className="size-2 rounded-full" style={{ background: r.color }} />}
            {r.label}
          </span>
          <span className="num font-medium text-ink">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-2">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px]" style={{ background: i.color }} aria-hidden />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

const shortDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

/** Revenue over time; one series per key, stacked when several. Single y-axis, always. */
export function TrendChart({
  data,
  keys,
  height = 240,
  format = (v: number) => fmtMoney(v, "INR", "en-IN", true),
}: {
  data: Record<string, number | string>[];
  keys: { key: string; label: string; color: string }[];
  height?: number;
  format?: (v: number) => string;
}) {
  const stacked = keys.length > 1;
  return (
    <div style={{ height }} role="img" aria-label={`Trend of ${keys.map((k) => k.label).join(", ")}`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            {keys.map((k) => (
              <linearGradient key={k.key} id={`g-${k.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={k.color} stopOpacity={stacked ? 0.55 : 0.22} />
                <stop offset="100%" stopColor={k.color} stopOpacity={stacked ? 0.35 : 0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis dataKey="date" tickFormatter={shortDate} tick={axisTick} axisLine={{ stroke: "var(--rule-strong)" }} tickLine={false} minTickGap={28} />
          <YAxis tickFormatter={(v) => format(v)} tick={axisTick} axisLine={false} tickLine={false} width={56} />
          <Tooltip
            cursor={{ stroke: "var(--ink-3)", strokeWidth: 1, strokeDasharray: "3 3" }}
            content={(p: TooltipContentProps<ValueType, NameType>) =>
              p.active && p.payload?.length ? (
                <TooltipBox
                  title={shortDate(String(p.label))}
                  rows={[...p.payload].reverse().map((r) => ({ label: keys.find((k) => k.key === r.dataKey)?.label ?? String(r.dataKey), value: format(Number(r.value)), color: String(r.color) }))}
                />
              ) : null
            }
          />
          {keys.map((k) => (
            <Area
              key={k.key}
              type="monotone"
              dataKey={k.key}
              stackId={stacked ? "s" : undefined}
              stroke={k.color}
              strokeWidth={2}
              fill={`url(#g-${k.key})`}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--paper)" }}
              isAnimationActive
              animationDuration={600}
              animationEasing="ease-out"
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Horizontal bars for ranking (top items, channels). Values are direct-labelled. */
export function RankBars({ rows, format, colorFor }: { rows: { label: string; value: number; sub?: string; colorKey?: number }[]; format: (v: number) => string; colorFor?: (i: number) => string }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="space-y-2.5">
      {rows.map((r, i) => (
        <li key={r.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
          <span className="truncate text-sm text-ink">
            {r.label}
            {r.sub && <span className="ml-2 text-xs text-ink-3">{r.sub}</span>}
          </span>
          <span className="num text-sm font-medium text-ink">{format(r.value)}</span>
          <div className="col-span-2 h-2 overflow-hidden rounded-full bg-paper-2">
            <div className="h-full rounded-full transition-[width] duration-700 ease-[var(--ease)]" style={{ width: `${(r.value / max) * 100}%`, background: colorFor ? colorFor(r.colorKey ?? i) : "var(--ink-3)" }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Grouped vertical bars, one bar per entity. */
export function ColumnChart({ data, height = 220, format }: { data: { label: string; value: number; color: string }[]; height?: number; format: (v: number) => string }) {
  return (
    <div style={{ height }} role="img" aria-label="Column chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis dataKey="label" tick={axisTick} axisLine={{ stroke: "var(--rule-strong)" }} tickLine={false} />
          <YAxis tickFormatter={format} tick={axisTick} axisLine={false} tickLine={false} width={56} />
          <Tooltip
            cursor={{ fill: "var(--paper-2)" }}
            content={(p: TooltipContentProps<ValueType, NameType>) =>
              p.active && p.payload?.length ? <TooltipBox title={String(p.label)} rows={[{ label: "Value", value: format(Number(p.payload[0].value)), color: String(p.payload[0].payload.color) }]} /> : null
            }
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={48}>
            {data.map((d) => (
              <Cell key={d.label} fill={d.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** P&L waterfall: revenue, then each cost stepping down, ending at net. Floating bars use [low, high] ranges. */
export function Waterfall({ steps, format, height = 260 }: { steps: { label: string; value: number }[]; format: (v: number) => string; height?: number }) {
  const data = useMemo(() => {
    let run = 0;
    return steps.map((s, i) => {
      if (i === 0) {
        run = s.value;
        return { label: s.label, range: [0, s.value] as [number, number], kind: "total" as const, raw: s.value };
      }
      if (i === steps.length - 1) {
        return { label: s.label, range: [Math.min(0, s.value), Math.max(0, s.value)] as [number, number], kind: s.value >= 0 ? ("net" as const) : ("loss" as const), raw: s.value };
      }
      const top = run;
      run -= s.value;
      return { label: s.label, range: [Math.min(top, run), Math.max(top, run)] as [number, number], kind: "cost" as const, raw: -s.value };
    });
  }, [steps]);
  const color = { total: "var(--s1)", cost: "var(--rule-strong)", net: "var(--good)", loss: "var(--bad)" };
  return (
    <div style={{ height }} role="img" aria-label="Profit and loss waterfall">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 16, right: 8, bottom: 0, left: 0 }} barCategoryGap="22%">
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis dataKey="label" tick={axisTick} axisLine={{ stroke: "var(--rule-strong)" }} tickLine={false} interval={0} />
          <YAxis tickFormatter={format} tick={axisTick} axisLine={false} tickLine={false} width={56} />
          <Tooltip
            cursor={{ fill: "var(--paper-2)" }}
            content={(p: TooltipContentProps<ValueType, NameType>) => {
              const d = p.payload?.[0]?.payload as (typeof data)[number] | undefined;
              return p.active && d ? <TooltipBox title={d.label} rows={[{ label: d.kind === "cost" ? "Cost" : "Amount", value: format(d.raw) }]} /> : null;
            }}
          />
          <Bar dataKey="range" radius={[4, 4, 4, 4]} maxBarSize={56} animationDuration={700}>
            {data.map((d) => (
              <Cell key={d.label} fill={color[d.kind]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Weekday x hour heatmap in one sequential hue (blue), light to dark. */
export function Heatmap({ rows }: { rows: { dow: number; hours: number[] }[] }) {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const hours = Array.from({ length: 13 }, (_, i) => i + 11); // 11:00 to 23:00, service hours
  const max = Math.max(...rows.flatMap((r) => hours.map((h) => r.hours[h])), 1);
  const order = [1, 2, 3, 4, 5, 6, 0];
  return (
    <div className="scrollbar-thin overflow-x-auto">
      <table className="w-full min-w-[560px] table-fixed border-separate border-spacing-[3px]" aria-label="Orders by weekday and hour">
        <thead>
          <tr>
            <th className="w-10" />
            {hours.map((h) => (
              <th key={h} scope="col" className="text-center text-[10px] font-normal text-ink-3">
                {h % 2 === 1 ? `${h > 12 ? h - 12 : h}${h >= 12 ? "p" : "a"}` : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {order.map((dow) => {
            const r = rows.find((x) => x.dow === dow)!;
            return (
              <tr key={dow}>
                <th scope="row" className="pr-1 text-left text-xs font-normal text-ink-3">
                  {days[dow]}
                </th>
                {hours.map((h) => {
                  const v = r.hours[h];
                  const t = v / max;
                  return (
                    <td
                      key={h}
                      title={`${days[dow]} ${h}:00, about ${Math.round(v)} orders`}
                      className={cn("h-6 rounded-[4px]")}
                      style={{ background: `color-mix(in oklab, var(--s1) ${Math.round(8 + t * 86)}%, var(--paper-2))` }}
                    />
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function Sparkline({ values, color = "var(--s1)", height = 32 }: { values: number[]; color?: string; height?: number }) {
  const data = values.map((v, i) => ({ i, v }));
  return (
    <div style={{ height }} aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill={color} fillOpacity={0.12} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
