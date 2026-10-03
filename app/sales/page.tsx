"use client";

import { useMemo, useState } from "react";
import { ColumnChart, Heatmap, Legend, RankBars, SERIES, TrendChart } from "@/components/charts";
import { AgentButton, PageFrame } from "@/components/shell/Page";
import { Metric, PageHeader, Panel, PanelHeader, Segmented, Select } from "@/components/ui";
import * as A from "@/lib/analytics";
import { BRANDS, CHANNELS } from "@/lib/data/seed";
import { useMoney } from "@/lib/hooks";
import { useKitchen } from "@/lib/store";

export default function SalesPage() {
  const d = useKitchen();
  const money = useMoney();
  const [range, setRange] = useState<"7" | "30" | "90">("30");
  const [brand, setBrand] = useState<string>("all");
  const days = Number(range);
  const brandId = brand === "all" ? undefined : brand;

  const series = useMemo(() => A.dailySeries(d, days, brandId, undefined, false), [d, days, brandId]);
  const prev = useMemo(() => A.dailySeries(d, days * 2, brandId, undefined, false).slice(0, days), [d, days, brandId]);
  const sum = (rows: typeof series, k: "revenue" | "orders" | "foodCost") => rows.reduce((s, r) => s + r[k], 0);
  const rev = sum(series, "revenue");
  const ord = sum(series, "orders");
  const prevRev = sum(prev, "revenue");
  const prevOrd = sum(prev, "orders");
  const fc = sum(series, "foodCost") / Math.max(1, rev);
  const prevFc = sum(prev, "foodCost") / Math.max(1, prevRev);
  const delta = (a: number, b: number) => (b ? a / b - 1 : 0);
  const pct = (x: number) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(1)}%`;

  const trend = useMemo(() => {
    if (brandId) return series.map((r) => ({ date: r.date, revenue: Math.round(r.revenue) }));
    const per = BRANDS.map((b) => A.dailySeries(d, days, b.id, undefined, false));
    return per[0].map((row, i) => ({ date: row.date, ...Object.fromEntries(BRANDS.map((b, j) => [b.id, Math.round(per[j][i]?.revenue ?? 0)])) }));
  }, [d, days, brandId, series]);
  const trendKeys = brandId
    ? [{ key: "revenue", label: A.brandName(brandId), color: SERIES[(BRANDS.find((b) => b.id === brandId)?.slot ?? 1) - 1] }]
    : BRANDS.map((b) => ({ key: b.id, label: b.name, color: SERIES[b.slot - 1] }));

  const channels = A.breakdown(d, days, "channel");
  const brands = A.breakdown(d, days, "brand");
  const heat = useMemo(() => A.hourHeat(d), [d]);
  const top = A.topItems(d, 8);

  return (
    <PageFrame route="/sales">
      <PageHeader
        title="Sales"
        sub="Revenue includes tax and is net of discounts, before aggregator commission."
        actions={
          <>
            <label className="sr-only" htmlFor="brand-filter">
              Brand
            </label>
            <Select id="brand-filter" value={brand} onChange={(e) => setBrand(e.target.value)} className="w-[170px]">
              <option value="all">All brands</option>
              {BRANDS.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
            <Segmented
              label="Date range"
              value={range}
              onChange={setRange}
              options={[
                { value: "7", label: "7 days" },
                { value: "30", label: "30 days" },
                { value: "90", label: "90 days" },
              ]}
            />
          </>
        }
      />

      <Panel>
        <div className="grid grid-cols-2 gap-6 px-5 pt-5 pb-2 md:grid-cols-4">
          <Metric label="Revenue" value={money(rev, true)} delta={{ text: pct(delta(rev, prevRev)), good: rev >= prevRev }} hint={`vs. previous ${days} days`} />
          <Metric label="Orders" value={A.fmtNum(ord)} delta={{ text: pct(delta(ord, prevOrd)), good: ord >= prevOrd }} />
          <Metric label="Average order" value={money(rev / Math.max(1, ord))} delta={{ text: pct(delta(rev / ord, prevRev / prevOrd)), good: rev / ord >= prevRev / prevOrd }} />
          <Metric label="Food cost" value={A.fmtPct(fc)} delta={{ text: `${fc >= prevFc ? "+" : ""}${((fc - prevFc) * 100).toFixed(1)} pts`, good: fc <= prevFc }} hint="target under 31%" />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4">
          <Legend items={trendKeys.map((k) => ({ label: k.label, color: k.color }))} />
          {fc > 0.315 && <AgentButton prompt="Why did food cost go up recently? Break it down by brand and tell me which ingredients are driving it.">Ask why food cost is up</AgentButton>}
        </div>
        <div className="px-3 pt-2 pb-4">
          <TrendChart data={trend} keys={trendKeys} format={(v) => money(v, true)} height={280} />
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Revenue by channel" sub={`Last ${days} days. Direct orders keep ~20 pts more margin.`} />
          <div className="px-3 pb-2">
            <ColumnChart data={channels.map((c) => ({ label: c.name, value: Math.round(c.revenue), color: SERIES[(CHANNELS.find((x) => x.id === c.key)?.slot ?? 1) - 1] }))} format={(v) => money(v, true)} />
          </div>
          <ul className="grid grid-cols-3 gap-4 border-t border-rule px-5 py-4">
            {channels.map((c) => (
              <li key={c.key}>
                <div className="text-xs text-ink-3">{c.name}</div>
                <div className="num mt-0.5 text-sm font-medium text-ink">{money(c.aov)} avg.</div>
                <div className="num text-xs text-ink-3">{A.fmtNum(c.orders)} orders</div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel>
          <PanelHeader title="Brand performance" sub={`Last ${days} days`} />
          <div className="px-5 pb-5">
            <RankBars rows={brands.map((b) => ({ label: b.name, value: b.revenue, sub: `${A.fmtPct(b.foodCostPct)} food cost`, colorKey: (BRANDS.find((x) => x.id === b.key)?.slot ?? 1) - 1 }))} format={(v) => money(v, true)} colorFor={(i) => SERIES[i]} />
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel>
          <PanelHeader title="When orders come in" sub="Average orders per hour, last 4 weeks. Darker is busier." />
          <div className="px-4 pb-5">
            <Heatmap rows={heat} />
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="Top items today" sub="By revenue, with gross margin" />
          <div className="px-5 pb-5">
            <RankBars rows={top.map((t) => ({ label: t.name, value: t.revenue, sub: `${Math.round(t.margin * 100)}% margin`, colorKey: (BRANDS.find((b) => b.id === t.brandId)?.slot ?? 1) - 1 }))} format={(v) => money(v)} colorFor={(i) => SERIES[i]} />
          </div>
        </Panel>
      </div>
    </PageFrame>
  );
}
