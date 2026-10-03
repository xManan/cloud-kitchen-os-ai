"use client";

import { Plus, Star, Ticket } from "@phosphor-icons/react";
import { CampaignForm, CouponForm, ReviewReplyForm } from "@/components/forms";
import { SERIES } from "@/components/charts";
import { AgentButton, PageFrame, relTime, shortDate, useNow } from "@/components/shell/Page";
import { Badge, Button, PageHeader, Panel, PanelHeader, Switch, Table, Td, Th, cn, type Tone } from "@/components/ui";
import * as A from "@/lib/analytics";
import { BRANDS } from "@/lib/data/seed";
import { useMoney } from "@/lib/hooks";
import { useKitchen } from "@/lib/store";
import type { CampaignStatus } from "@/lib/types";
import { useUI } from "@/lib/ui-store";

const C_TONE: Record<CampaignStatus, Tone> = { live: "good", scheduled: "heat", paused: "warn", ended: "neutral" };
const DAY = 86400000;

export default function MarketingPage() {
  const d = useKitchen();
  const money = useMoney();
  const openForm = useUI((s) => s.openForm);
  const now = useNow();

  // Timeline window: 30 days back to 30 days ahead.
  const start = now - 30 * DAY;
  const span = 60 * DAY;
  const pos = (iso: string) => Math.min(100, Math.max(0, ((new Date(iso).getTime() - start) / span) * 100));
  const avgRating = d.reviews.reduce((s, r) => s + r.rating, 0) / d.reviews.length;
  const unreplied = d.reviews.filter((r) => !r.reply);
  const slot = (brandId: string) => SERIES[(BRANDS.find((b) => b.id === brandId)?.slot ?? 1) - 1];

  return (
    <PageFrame route="/marketing">
      <PageHeader
        title="Marketing"
        sub="Campaigns, coupons and what customers are saying."
        actions={
          <>
            <Button data-agent-open="coupon" onClick={() => openForm("coupon")}>
              <Ticket size={16} /> New coupon
            </Button>
            <Button variant="primary" data-agent-open="campaign" onClick={() => openForm("campaign")}>
              <Plus size={16} weight="bold" /> New campaign
            </Button>
          </>
        }
      />

      <Panel>
        <PanelHeader title="Campaign timeline" sub="30 days back to 30 days ahead" />
        <div className="px-5 pb-5">
          <div className="relative">
            <div className="absolute top-0 bottom-0 w-px bg-heat" style={{ left: "50%" }} aria-hidden>
              <span className="absolute -top-0.5 left-1.5 text-[11px] font-medium whitespace-nowrap text-heat">Today</span>
            </div>
            <ul className="space-y-2.5 pt-6">
              {d.campaigns.map((c) => {
                const l = pos(c.startAt);
                const r = pos(c.endAt);
                return (
                  <li key={c.id} className="relative h-9">
                    <div
                      className={cn("absolute inset-y-0 flex items-center overflow-hidden rounded-[6px] px-2.5 ring-1 ring-inset", c.status === "ended" || c.status === "paused" ? "opacity-55" : "")}
                      style={{ left: `${l}%`, width: `${Math.max(r - l, 6)}%`, background: `color-mix(in oklab, ${slot(c.brandId)} 18%, var(--paper))`, boxShadow: `inset 3px 0 0 ${slot(c.brandId)}` }}
                      title={`${c.name}: ${shortDate(c.startAt)} to ${shortDate(c.endAt)}`}
                    >
                      <span className="truncate text-xs font-medium text-ink">{c.name}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
        <Table>
          <thead>
            <tr>
              <Th>Campaign</Th>
              <Th>Brand</Th>
              <Th>Channel</Th>
              <Th className="text-right">Spent</Th>
              <Th className="text-right">Orders</Th>
              <Th className="text-right">Cost per order</Th>
              <Th>Status</Th>
              <Th className="text-right">
                <span className="sr-only">Actions</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {d.campaigns.map((c) => (
              <tr key={c.id} data-row-id={c.id}>
                <Td className="font-medium">
                  {c.name}
                  {c.couponCode && <span className="ml-2 font-mono text-xs text-ink-3">{c.couponCode}</span>}
                </Td>
                <Td className="text-ink-2">{A.brandName(c.brandId)}</Td>
                <Td className="text-ink-2">{A.channelName(c.channel)}</Td>
                <Td className="num text-right">
                  {money(c.spent)} <span className="text-xs text-ink-3">of {money(c.budget, true)}</span>
                </Td>
                <Td className="num text-right">{c.orders}</Td>
                <Td className="num text-right">{c.orders ? money(c.spent / c.orders) : "None yet"}</Td>
                <Td>
                  <Badge tone={C_TONE[c.status]}>{c.status[0].toUpperCase() + c.status.slice(1)}</Badge>
                </Td>
                <Td className="text-right">
                  {c.status === "live" && (
                    <Button size="sm" variant="ghost" onClick={() => d.setCampaignStatus(c.id, "paused")}>
                      Pause
                    </Button>
                  )}
                  {c.status === "paused" && (
                    <Button size="sm" variant="ghost" onClick={() => d.setCampaignStatus(c.id, "live")}>
                      Resume
                    </Button>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Panel>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Panel>
          <PanelHeader
            title="Reviews"
            sub={`${avgRating.toFixed(1)} average from ${d.reviews.length} recent reviews, ${unreplied.length} unanswered`}
            actions={unreplied.some((r) => r.rating <= 2) ? <AgentButton prompt="Reply to every unanswered review rated 2 stars or lower. Be specific to what went wrong, apologise, and offer a credit on the next order.">Answer low ratings</AgentButton> : null}
          />
          <ul className="divide-y divide-rule border-t border-rule">
            {d.reviews.map((r) => (
              <li key={r.id} data-row-id={r.id} className="px-5 py-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="flex items-center gap-0.5" aria-label={`${r.rating} out of 5`}>
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star key={i} size={13} weight={i < r.rating ? "fill" : "regular"} className={i < r.rating ? (r.rating <= 2 ? "text-bad" : "text-warn") : "text-rule-strong"} />
                    ))}
                  </span>
                  <span className="text-sm font-medium text-ink">{r.customerName}</span>
                  <span className="text-xs text-ink-3">
                    {A.brandName(r.brandId)} on {A.channelName(r.channel)}, {relTime(r.createdAt, now)}
                  </span>
                </div>
                <p className="mt-1.5 text-sm text-ink-2">{r.text}</p>
                {r.reply ? (
                  <p className="mt-2 border-l-2 border-rule-strong pl-3 text-sm text-ink">
                    <span className="mr-1.5 text-xs text-ink-3">Your reply:</span>
                    {r.reply}
                  </p>
                ) : (
                  <Button size="sm" variant="ghost" className="mt-1.5 -ml-2" data-agent-target={`reply:${r.id}`} onClick={() => openForm("review-reply", { reviewId: r.id })}>
                    Reply
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </Panel>

        <Panel>
          <PanelHeader title="Coupons" />
          <ul className="divide-y divide-rule border-t border-rule">
            {d.coupons.map((c) => (
              <li key={c.id} data-row-id={c.id} className="flex items-center gap-4 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-sm font-semibold text-ink">{c.code}</div>
                  <div className="text-xs text-ink-3">
                    {c.discountPct}% off over {money(c.minOrder)}, {A.brandName(c.brandId)}, until {shortDate(c.validTo)}
                  </div>
                </div>
                <div className="num text-right text-xs text-ink-2">{c.uses} uses</div>
                <Switch checked={c.active} onCheckedChange={(v) => d.toggleCoupon(c.id, v)} label={`${c.code} active`} />
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <CampaignForm />
      <CouponForm />
      <ReviewReplyForm />
    </PageFrame>
  );
}
