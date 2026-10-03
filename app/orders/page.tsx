"use client";

import { Plus } from "@phosphor-icons/react";
import { useState } from "react";
import { ManualOrderForm } from "@/components/forms";
import { PageFrame, minutesAgo, useNow } from "@/components/shell/Page";
import { Badge, Button, PageHeader, Panel, PanelHeader, Segmented, Table, Td, Th, cn, type Tone } from "@/components/ui";
import * as A from "@/lib/analytics";
import { useMoney } from "@/lib/hooks";
import { useKitchen } from "@/lib/store";
import type { Order, OrderStatus } from "@/lib/types";
import { useUI } from "@/lib/ui-store";

const COLUMNS: { status: OrderStatus; label: string; action: string; next: OrderStatus; sla: number }[] = [
  { status: "new", label: "New", action: "Start", next: "preparing", sla: 3 },
  { status: "preparing", label: "Preparing", action: "Mark ready", next: "ready", sla: 15 },
  { status: "ready", label: "Ready for pickup", action: "Dispatch", next: "dispatched", sla: 18 },
  { status: "dispatched", label: "Out for delivery", action: "Delivered", next: "delivered", sla: 45 },
];

const STATUS_TONE: Record<OrderStatus, Tone> = { new: "heat", preparing: "neutral", ready: "good", dispatched: "info", delivered: "neutral", cancelled: "bad" };

export default function OrdersPage() {
  const orders = useKitchen((s) => s.orders);
  const menu = useKitchen((s) => s.menu);
  const setOrderStatus = useKitchen((s) => s.setOrderStatus);
  const refundOrder = useKitchen((s) => s.refundOrder);
  const openForm = useUI((s) => s.openForm);
  const money = useMoney();
  const now = useNow(20000);
  const [filter, setFilter] = useState<"all" | "active" | "done">("all");

  const today = A.todaysOrders(orders);
  const history = [...today]
    .reverse()
    .filter((o) => (filter === "all" ? true : filter === "active" ? !["delivered", "cancelled"].includes(o.status) : ["delivered", "cancelled"].includes(o.status)))
    .slice(0, 40);
  const itemName = (id: string) => menu.find((m) => m.id === id)?.name ?? id;

  return (
    <PageFrame route="/orders">
      <PageHeader
        title="Orders"
        sub={`${today.length} orders today. Tickets turn red when they pass the target time for their stage.`}
        actions={
          <Button variant="primary" data-agent-open="manual-order" onClick={() => openForm("manual-order")}>
            <Plus size={16} weight="bold" /> New phone order
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const list = orders.filter((o) => o.status === col.status).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
          return (
            <section key={col.status} aria-label={col.label} className="flex min-h-[220px] flex-col rounded-[12px] bg-paper-2/70 p-3 ring-1 ring-rule">
              <header className="mb-3 flex items-center justify-between px-1">
                <h2 className="text-sm font-semibold text-ink">{col.label}</h2>
                <span className="num text-xs text-ink-3">{list.length}</span>
              </header>
              <div className="scrollbar-thin flex max-h-[520px] flex-col gap-3 overflow-y-auto px-0.5 pt-1 pb-1">
                {list.length === 0 && <p className="px-1 py-6 text-xs text-ink-3">No tickets here.</p>}
                {list.map((o) => (
                  <Ticket key={o.id} order={o} now={now} sla={col.sla} itemName={itemName} action={col.action} onAdvance={() => setOrderStatus(o.id, col.next)} money={money} />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <Panel>
        <PanelHeader
          title="Today's orders"
          actions={
            <Segmented
              size="sm"
              label="Order filter"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: "All" },
                { value: "active", label: "Active" },
                { value: "done", label: "Completed" },
              ]}
            />
          }
        />
        <Table>
          <thead>
            <tr>
              <Th>Order</Th>
              <Th>Placed</Th>
              <Th>Brand</Th>
              <Th>Channel</Th>
              <Th>Items</Th>
              <Th className="text-right">Total</Th>
              <Th>Status</Th>
              <Th className="text-right">
                <span className="sr-only">Actions</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {history.map((o) => (
              <tr key={o.id} data-row-id={o.id}>
                <Td className="font-mono text-[13px]">{o.number}</Td>
                <Td className="num text-ink-2">{new Date(o.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</Td>
                <Td>{A.brandName(o.brandId)}</Td>
                <Td className="text-ink-2">{A.channelName(o.channel)}</Td>
                <Td className="max-w-[280px] truncate text-ink-2">{o.lines.map((l) => `${l.qty}× ${itemName(l.itemId)}`).join(", ")}</Td>
                <Td className="num text-right">{money(o.total)}</Td>
                <Td>
                  <Badge tone={STATUS_TONE[o.status]}>{o.refunded ? "Refunded" : o.status[0].toUpperCase() + o.status.slice(1)}</Badge>
                </Td>
                <Td className="text-right">
                  {!o.refunded && o.status !== "cancelled" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (window.confirm(`Refund and cancel ${o.number} (${money(o.total)})?`)) refundOrder(o.id);
                      }}
                    >
                      Refund
                    </Button>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Panel>

      <ManualOrderForm />
    </PageFrame>
  );
}

function Ticket({ order: o, now, sla, itemName, action, onAdvance, money }: { order: Order; now: number; sla: number; itemName: (id: string) => string; action: string; onAdvance: () => void; money: (n: number) => string }) {
  const age = minutesAgo(o.createdAt, now);
  const late = age > sla;
  return (
    <article data-row-id={o.id} className={cn("ticket px-3.5 pt-3.5 pb-3 shadow-[0_1px_2px_rgb(21_33_43/0.08)] ring-1", late ? "ring-bad/50" : "ring-rule")}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-sm font-semibold text-ink">{o.number}</span>
        <span className={cn("num text-xs", late ? "font-semibold text-bad" : "text-ink-3")}>{age} min</span>
      </div>
      <div className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-2">
        <span>{A.brandName(o.brandId)}</span>
        <span aria-hidden className="text-ink-3">/</span>
        <span>{A.channelName(o.channel)}</span>
      </div>
      <ul className="mt-2.5 space-y-1 border-t border-dashed border-rule-strong pt-2.5">
        {o.lines.map((l) => (
          <li key={l.itemId} className="flex gap-2 text-[13px] text-ink">
            <span className="num w-5 shrink-0 font-semibold">{l.qty}×</span>
            <span className="min-w-0">{itemName(l.itemId)}</span>
          </li>
        ))}
      </ul>
      {o.note && <p className="mt-2 rounded-[4px] bg-warn-wash px-2 py-1 text-xs text-warn">{o.note}</p>}
      <div className="mt-3 flex items-center justify-between">
        <span className="num text-xs text-ink-3">{money(o.total)}</span>
        <Button size="sm" variant={o.status === "new" ? "primary" : "secondary"} data-agent-target={`advance:${o.id}`} onClick={onAdvance}>
          {action}
        </Button>
      </div>
    </article>
  );
}
