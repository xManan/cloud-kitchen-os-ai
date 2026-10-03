"use client";

import { Plus } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { Waterfall } from "@/components/charts";
import { ExpenseForm } from "@/components/forms";
import { AgentButton, PageFrame, shortDate } from "@/components/shell/Page";
import { Button, Meter, Metric, PageHeader, Panel, PanelHeader, Segmented, Table, Td, Th, cn } from "@/components/ui";
import * as A from "@/lib/analytics";
import { useMoney } from "@/lib/hooks";
import { useKitchen } from "@/lib/store";
import { useUI } from "@/lib/ui-store";

export default function FinancePage() {
  const d = useKitchen();
  const money = useMoney();
  const openForm = useUI((s) => s.openForm);
  const thisMonth = new Date().toISOString().slice(0, 7);
  const lastMonth = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 15).toISOString().slice(0, 7);
  const [which, setWhich] = useState<"last" | "this">("last");
  const month = which === "last" ? lastMonth : thisMonth;
  const p = useMemo(() => A.pnl(d, month), [d, month]);
  const monthLabel = new Date(`${month}-01T12:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  const steps = [
    { label: "Revenue", value: p.revenue },
    { label: "Food", value: p.foodCost },
    { label: "Commission", value: p.commissions },
    { label: "Labour", value: p.labor },
    { label: "Rent", value: p.rent },
    { label: "Marketing", value: p.marketing },
    { label: "Other", value: p.other },
    { label: "Net", value: p.net },
  ];

  const budgets = d.budgets.map((b) => {
    const actual = d.expenses.filter((e) => e.category === b.category && e.date.startsWith(month)).reduce((s, e) => s + e.amount, 0);
    return { ...b, actual, ratio: b.monthly ? actual / b.monthly : 0 };
  });
  const over = budgets.filter((b) => b.ratio > 1);

  return (
    <PageFrame route="/finance">
      <PageHeader
        title="Finance"
        sub={which === "this" ? `${monthLabel}, month to date. Salaries post on the 28th, so labour looks light early in the month.` : `${monthLabel}, the last full month.`}
        actions={
          <>
          <Segmented
            label="Period"
            value={which}
            onChange={setWhich}
            options={[
              { value: "last", label: "Last month" },
              { value: "this", label: "This month" },
            ]}
          />
          <Button variant="primary" data-agent-open="expense" onClick={() => openForm("expense")}>
            <Plus size={16} weight="bold" /> Record expense
          </Button>
          </>
        }
      />

      <Panel>
        <div className="grid grid-cols-2 gap-6 px-5 pt-5 md:grid-cols-4">
          <Metric label="Net profit" value={money(p.net, true)} hint={`${A.fmtPct(p.net / Math.max(1, p.revenue))} margin`} />
          <Metric label="Food cost" value={A.fmtPct(p.foodCostPct)} hint="target 28 to 31%" />
          <Metric label="Prime cost" value={A.fmtPct(p.primeCostPct)} hint="food + labour, target under 60%" />
          <Metric label="Aggregator commission" value={money(p.commissions, true)} hint={A.fmtPct(p.commissions / Math.max(1, p.revenue)) + " of revenue"} />
        </div>
        <div className="px-3 pt-4 pb-4">
          <Waterfall steps={steps} format={(v) => money(v, true)} height={280} />
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <Panel>
          <PanelHeader
            title="Budget vs actual"
            sub={monthLabel}
            actions={over.length ? <AgentButton prompt="Which expense categories are over budget this month, by how much, and what's driving it?">Explain overspend</AgentButton> : null}
          />
          <ul className="space-y-3.5 px-5 pb-5">
            {budgets.map((b) => (
              <li key={b.category} data-row-id={`budget-${b.category}`} className="rounded-[6px]">
                <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
                  <span className="text-ink">{b.category}</span>
                  <span className="num text-xs text-ink-2">
                    <span className={cn(b.ratio > 1 && "font-semibold text-bad")}>{money(b.actual)}</span> of {money(b.monthly)}
                  </span>
                </div>
                <Meter value={Math.min(1, b.ratio)} tone={b.ratio > 1 ? "bad" : b.ratio > 0.85 ? "warn" : "good"} label={`${b.category} budget used`} />
              </li>
            ))}
          </ul>
        </Panel>

        <Panel>
          <PanelHeader title="Expenses" sub="Last 3 months" />
          <Table className="max-h-[440px]">
            <thead className="sticky top-0 bg-paper">
              <tr>
                <Th>Date</Th>
                <Th>Category</Th>
                <Th>Paid to</Th>
                <Th className="text-right">Amount</Th>
              </tr>
            </thead>
            <tbody>
              {d.expenses.slice(0, 30).map((e) => (
                <tr key={e.id} data-row-id={e.id}>
                  <Td className="text-ink-2">{shortDate(e.date)}</Td>
                  <Td>{e.category}</Td>
                  <Td className="text-ink-2">
                    {e.vendor}
                    {e.note && <span className="block text-xs text-ink-3">{e.note}</span>}
                  </Td>
                  <Td className="num text-right">{money(e.amount)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Panel>
      </div>

      <ExpenseForm />
    </PageFrame>
  );
}
