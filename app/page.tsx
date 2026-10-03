"use client";

import { ArrowRight, Lightning, User } from "@phosphor-icons/react";
import Link from "next/link";
import { useMemo } from "react";
import { Legend, SERIES, TrendChart } from "@/components/charts";
import { AgentButton, PageFrame, minutesAgo, relTime, useNow } from "@/components/shell/Page";
import { Badge, Metric, PageHeader, Panel, PanelHeader, cn } from "@/components/ui";
import * as A from "@/lib/analytics";
import { BRANDS } from "@/lib/data/seed";
import { useMoney } from "@/lib/hooks";
import { useKitchen } from "@/lib/store";

export default function CommandCenter() {
  const d = useKitchen();
  const money = useMoney();
  const now = useNow();

  const today = A.todaysOrders(d.orders);
  const revenue = A.liveRevenue(d.orders);
  const lastWeek = useMemo(() => {
    const series = A.dailySeries(d, 8);
    return series[0];
  }, [d]);
  // Compare against the same weekday last week, scaled to the share of the day elapsed.
  const elapsedShare = Math.min(1, Math.max(0.05, (new Date().getHours() - 11 + new Date().getMinutes() / 60) / 12));
  const pace = lastWeek ? revenue / (lastWeek.revenue * elapsedShare) - 1 : 0;

  const live = d.orders.filter((o) => ["new", "preparing", "ready"].includes(o.status)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const low = A.lowStock(d.ingredients);
  const overdue = d.invoices.filter((i) => i.status === "overdue");
  const shortPayout = d.payouts.find((p) => p.status === "pending" && p.adjustments < -1000);
  const badReviews = d.reviews.filter((r) => r.rating <= 2 && !r.reply);
  const lateReady = d.orders.filter((o) => o.status === "ready" && minutesAgo(o.createdAt, now) > 18);

  const trend = useMemo(() => {
    const per = BRANDS.map((b) => A.dailySeries(d, 14, b.id, undefined, false));
    return per[0].map((row, i) => ({ date: row.date, ...Object.fromEntries(BRANDS.map((b, j) => [b.id, Math.round(per[j][i]?.revenue ?? 0)])) }));
  }, [d]);

  const attention = [
    lateReady.length > 0 && {
      key: "ready",
      tone: "bad" as const,
      title: `${lateReady.length} ready order${lateReady.length > 1 ? "s" : ""} waiting for pickup`,
      body: "Food is getting cold on the pass.",
      prompt: "Move every order that is ready to dispatched.",
    },
    low.length > 0 && {
      key: "stock",
      tone: low[0].ratio < 0.35 ? ("bad" as const) : ("warn" as const),
      title: `${low.length} ingredients below par`,
      body: low
        .slice(0, 3)
        .map((i) => `${i.name} ${Math.round(i.ratio * 100)}%`)
        .join(", "),
      prompt: "Restock everything that's below par. Group items by supplier, pick the cheapest supplier that covers each category, and draft the purchase orders.",
    },
    shortPayout && {
      key: "payout",
      tone: "warn" as const,
      title: `${A.channelName(shortPayout.channel)} payout is short ${money(-shortPayout.adjustments)}`,
      body: shortPayout.note ?? "Unexplained deduction",
      prompt: `Look into the ${A.channelName(shortPayout.channel)} payout for the week ending ${shortPayout.periodEnd.slice(0, 10)} with an unexplained deduction. If it looks wrong, raise a dispute with a clear note.`,
    },
    badReviews.length > 0 && {
      key: "reviews",
      tone: "warn" as const,
      title: `${badReviews.length} unanswered low ratings`,
      body: `"${badReviews[0].text.slice(0, 60)}..."`,
      prompt: "Reply to every unanswered review rated 2 stars or lower. Apologise specifically and offer a credit.",
    },
    overdue.length > 0 && {
      key: "invoice",
      tone: "warn" as const,
      title: `${overdue[0].client} invoice is overdue`,
      body: `${overdue[0].number}, due ${new Date(overdue[0].dueAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`,
      prompt: `Summarise the overdue invoice ${overdue[0].number} and tell me how much we're owed in total.`,
    },
  ].filter(Boolean) as { key: string; tone: "bad" | "warn"; title: string; body: string; prompt: string }[];

  return (
    <PageFrame route="/">
      <PageHeader
        title="Command center"
        sub={`${new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}. Three brands live on DashBite, FoodRun and direct.`}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Panel className="flex flex-col overflow-hidden">
          <div className="grid grid-cols-1 gap-6 px-5 pt-5 pb-4 sm:grid-cols-[auto_1fr] sm:items-end">
            <div>
              <div className="text-[13px] text-ink-3">Revenue today</div>
              <div className="num mt-1 font-display text-[44px] leading-none font-semibold tracking-[-0.02em] text-ink md:text-[52px]">{money(revenue)}</div>
              <div className="mt-2 text-sm">
                <span className={cn("num font-medium", pace >= 0 ? "text-good" : "text-bad")}>
                  {pace >= 0 ? "+" : ""}
                  {(pace * 100).toFixed(0)}%
                </span>
                <span className="text-ink-3"> vs. same time last {new Date().toLocaleDateString("en-IN", { weekday: "long" })}</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 border-rule sm:border-l sm:pl-6">
              <Metric label="Orders" value={today.length} />
              <Metric label="Avg. order" value={money(revenue / Math.max(1, today.filter((o) => o.status !== "cancelled").length))} />
              <Metric label="On the line" value={live.length} />
            </div>
          </div>

          <div className="flex-1 border-t border-rule bg-steel/50 px-5 pt-4 pb-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink">Ticket rail</h2>
              <Link href="/orders" className="inline-flex items-center gap-1 text-xs font-medium text-ink-2 hover:text-ink">
                Kitchen display <ArrowRight size={12} />
              </Link>
            </div>
            <div className="scrollbar-thin -mx-1 flex gap-3 overflow-x-auto px-1 pt-1 pb-2">
              {live.map((o) => {
                const age = minutesAgo(o.createdAt, now);
                const late = (o.status === "preparing" && age > 15) || (o.status === "ready" && age > 18);
                return (
                  <div key={o.id} className="ticket w-[168px] shrink-0 px-3 pt-3 pb-2.5 shadow-[0_1px_2px_rgb(21_33_43/0.08)] ring-1 ring-rule">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[13px] font-medium text-ink">{o.number}</span>
                      <span className={cn("num text-xs", late ? "font-medium text-bad" : "text-ink-3")}>{age}m</span>
                    </div>
                    <div className="mt-1 truncate text-xs text-ink-2">{A.brandName(o.brandId)}</div>
                    <div className="mt-2 space-y-0.5">
                      {o.lines.slice(0, 2).map((l) => (
                        <div key={l.itemId} className="truncate text-xs text-ink">
                          {l.qty}× {d.menu.find((m) => m.id === l.itemId)?.name}
                        </div>
                      ))}
                      {o.lines.length > 2 && <div className="text-xs text-ink-3">+{o.lines.length - 2} more</div>}
                    </div>
                    <div className="mt-2.5">
                      <Badge tone={o.status === "ready" ? "good" : o.status === "new" ? "heat" : "neutral"}>{o.status === "new" ? "New" : o.status === "preparing" ? "Preparing" : "Ready"}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Needs attention" sub={attention.length ? `${attention.length} things the agent can take off your plate` : undefined} />
          {attention.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-ink-3">All clear. Nothing needs you right now.</p>
          ) : (
            <ul className="divide-y divide-rule border-t border-rule">
              {attention.map((a) => (
                <li key={a.key} className="flex gap-3 px-5 py-3.5">
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", a.tone === "bad" ? "bg-bad" : "bg-warn")} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink">{a.title}</p>
                    <p className="mt-0.5 truncate text-xs text-ink-3">{a.body}</p>
                    <AgentButton prompt={a.prompt} className="mt-2" />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Panel>
          <PanelHeader title="Revenue by brand" sub="Last 14 full days" actions={<Legend items={BRANDS.map((b) => ({ label: b.name, color: SERIES[b.slot - 1] }))} />} />
          <div className="px-3 pb-4">
            <TrendChart data={trend} keys={BRANDS.map((b) => ({ key: b.id, label: b.name, color: SERIES[b.slot - 1] }))} format={(v) => money(v, true)} height={260} />
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Activity" sub="Changes by you and the agent" />
          {d.activity.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-ink-3">Nothing yet today. Actions you or the agent take will show up here.</p>
          ) : (
            <ul className="scrollbar-thin max-h-[300px] space-y-0 overflow-y-auto border-t border-rule">
              {d.activity.slice(0, 20).map((a) => (
                <li key={a.id} className="flex gap-3 border-b border-rule px-5 py-2.5 last:border-0">
                  <span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full", a.actor === "agent" ? "bg-heat-wash text-heat" : "bg-paper-2 text-ink-3")}>
                    {a.actor === "agent" ? <Lightning size={11} weight="fill" /> : <User size={11} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] text-ink">{a.text}</p>
                    <p className="text-xs text-ink-3">
                      {a.actor === "agent" ? "Agent" : "You"}, {relTime(a.at, now)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </PageFrame>
  );
}
