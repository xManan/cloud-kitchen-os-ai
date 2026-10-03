"use client";

import { Plus, Trash } from "@phosphor-icons/react";
import { useState } from "react";
import { PurchaseOrderForm, WasteForm } from "@/components/forms";
import { AgentButton, PageFrame, shortDate } from "@/components/shell/Page";
import { Badge, Button, PageHeader, Panel, PanelHeader, Segmented, Table, Td, Th, cn, type Tone } from "@/components/ui";
import * as A from "@/lib/analytics";
import { useMoney } from "@/lib/hooks";
import { useKitchen } from "@/lib/store";
import type { Ingredient, POStatus } from "@/lib/types";
import { useUI } from "@/lib/ui-store";

const CATS: Ingredient["category"][] = ["Protein", "Dairy", "Produce", "Dry goods", "Sauces", "Packaging"];
const PO_TONE: Record<POStatus, Tone> = { draft: "neutral", sent: "heat", received: "good", cancelled: "bad" };

export default function InventoryPage() {
  const d = useKitchen();
  const money = useMoney();
  const openForm = useUI((s) => s.openForm);
  const [cat, setCat] = useState<"all" | Ingredient["category"]>("all");

  const low = A.lowStock(d.ingredients);
  const stockValue = d.ingredients.reduce((s, i) => s + i.stock * i.costPerUnit, 0);
  const wasteWeek = d.waste.filter((w) => Date.now() - new Date(w.date).getTime() < 7 * 86400000);
  const wasteCost = wasteWeek.reduce((s, w) => s + w.qty * (d.ingredients.find((i) => i.id === w.ingredientId)?.costPerUnit ?? 0), 0);
  const shown = d.ingredients.filter((i) => cat === "all" || i.category === cat);
  const supplierName = (id: string) => d.suppliers.find((s) => s.id === id)?.name ?? id;
  const ingName = (id: string) => d.ingredients.find((i) => i.id === id);

  return (
    <PageFrame route="/inventory">
      <PageHeader
        title="Inventory"
        sub="Stock against par. Bars turn amber under 60% of par and red under 35%."
        actions={
          <>
            <Button data-agent-open="waste" onClick={() => openForm("waste")}>
              <Trash size={16} /> Log waste
            </Button>
            <Button variant="primary" data-agent-open="purchase-order" onClick={() => openForm("purchase-order")}>
              <Plus size={16} weight="bold" /> New purchase order
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-3">
        <div className="border-l-2 border-bad pl-4">
          <div className="text-[13px] text-ink-3">Below par</div>
          <div className="num font-display text-2xl font-semibold text-ink">{low.length} items</div>
        </div>
        <div className="border-l-2 border-rule-strong pl-4">
          <div className="text-[13px] text-ink-3">Stock on hand</div>
          <div className="num font-display text-2xl font-semibold text-ink">{money(stockValue)}</div>
        </div>
        <div className="border-l-2 border-rule-strong pl-4">
          <div className="text-[13px] text-ink-3">Waste, last 7 days</div>
          <div className="num font-display text-2xl font-semibold text-ink">{money(wasteCost)}</div>
        </div>
      </div>

      <Panel>
        <PanelHeader
          title="Shelf"
          sub="The tick on each bar is the par level"
          actions={
            <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
              {low.length > 0 && <AgentButton prompt="Restock everything that's below par. Group by supplier, use the cheapest supplier covering each category, and draft the purchase orders.">Restock {low.length} items</AgentButton>}
              <Segmented size="sm" label="Category" value={cat} onChange={setCat} options={[{ value: "all", label: "All" }, ...CATS.map((c) => ({ value: c, label: c }))]} />
            </div>
          }
        />
        <ul className="grid grid-cols-1 gap-x-8 gap-y-3 px-5 pt-1 pb-5 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((i) => {
            const ratio = i.stock / i.par;
            const tone = ratio < 0.35 ? "bg-bad" : ratio < 0.6 ? "bg-warn" : "bg-ink-3/70";
            const fill = Math.min(1, ratio / 1.6);
            return (
              <li key={i.id} data-row-id={i.id} className="rounded-[6px] px-1 py-1">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="truncate text-ink">{i.name}</span>
                  <span className="num shrink-0 text-xs text-ink-2">
                    <span className={cn(ratio < 0.6 && "font-semibold text-ink")}>{i.stock}</span> / {i.par} {i.unit}
                  </span>
                </div>
                <div className="relative mt-1.5 h-2 rounded-full bg-paper-2 ring-1 ring-inset ring-rule" role="meter" aria-label={`${i.name} stock`} aria-valuenow={Math.round(ratio * 100)} aria-valuemin={0} aria-valuemax={160}>
                  <div className={cn("h-full rounded-full transition-[width] duration-700 ease-[var(--ease)]", tone)} style={{ width: `${Math.max(3, fill * 100)}%` }} />
                  <span className="absolute -top-1 -bottom-1 w-[2px] rounded-full bg-ink" style={{ left: `${100 / 1.6}%` }} aria-hidden />
                </div>
              </li>
            );
          })}
        </ul>
      </Panel>

      <Panel>
        <PanelHeader title="Purchase orders" sub="Drafts need sending; sent orders are received when the delivery arrives." />
        <Table>
          <thead>
            <tr>
              <Th>PO</Th>
              <Th>Supplier</Th>
              <Th>Items</Th>
              <Th className="text-right">Total</Th>
              <Th>Expected</Th>
              <Th>Status</Th>
              <Th className="text-right">
                <span className="sr-only">Actions</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {d.purchaseOrders.map((p) => (
              <tr key={p.id} data-row-id={p.id}>
                <Td className="font-mono text-[13px]">
                  {p.number}
                  {p.createdBy === "agent" && (
                    <Badge tone="heat" className="ml-2 font-sans">
                      Agent
                    </Badge>
                  )}
                </Td>
                <Td>{supplierName(p.supplierId)}</Td>
                <Td className="max-w-[300px] truncate text-ink-2">{p.lines.map((l) => `${l.qty} ${ingName(l.ingredientId)?.unit} ${ingName(l.ingredientId)?.name}`).join(", ")}</Td>
                <Td className="num text-right">{money(p.lines.reduce((s, l) => s + l.qty * l.unitCost, 0))}</Td>
                <Td className="text-ink-2">{shortDate(p.expectedAt)}</Td>
                <Td>
                  <Badge tone={PO_TONE[p.status]}>{p.status[0].toUpperCase() + p.status.slice(1)}</Badge>
                </Td>
                <Td className="text-right">
                  {p.status === "draft" && (
                    <Button size="sm" variant="primary" data-agent-target={`send:${p.id}`} onClick={() => d.sendPurchaseOrder(p.id)}>
                      Send
                    </Button>
                  )}
                  {p.status === "sent" && (
                    <Button size="sm" data-agent-target={`receive:${p.id}`} onClick={() => d.receivePurchaseOrder(p.id)}>
                      Receive
                    </Button>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Panel>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Suppliers" sub="Price factor is relative to our standard cost; lower is cheaper." />
          <Table>
            <thead>
              <tr>
                <Th>Supplier</Th>
                <Th>Supplies</Th>
                <Th className="text-right">Lead</Th>
                <Th className="text-right">Price</Th>
                <Th className="text-right">Rating</Th>
              </tr>
            </thead>
            <tbody>
              {d.suppliers.map((s) => (
                <tr key={s.id}>
                  <Td className="font-medium">{s.name}</Td>
                  <Td className="text-ink-2">{s.categories.join(", ")}</Td>
                  <Td className="num text-right text-ink-2">{s.leadDays}d</Td>
                  <Td className={cn("num text-right", s.priceFactor < 1 ? "text-good" : s.priceFactor > 1 ? "text-warn" : "text-ink-2")}>×{s.priceFactor.toFixed(2)}</Td>
                  <Td className="num text-right text-ink-2">{s.rating.toFixed(1)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Panel>
        <Panel>
          <PanelHeader title="Waste log" />
          <Table>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Ingredient</Th>
                <Th className="text-right">Qty</Th>
                <Th>Reason</Th>
                <Th className="text-right">Cost</Th>
              </tr>
            </thead>
            <tbody>
              {d.waste.slice(0, 8).map((w) => {
                const g = ingName(w.ingredientId);
                return (
                  <tr key={w.id} data-row-id={w.id}>
                    <Td className="text-ink-2">{shortDate(w.date)}</Td>
                    <Td>{g?.name}</Td>
                    <Td className="num text-right">
                      {w.qty} {g?.unit}
                    </Td>
                    <Td className="text-ink-2">{w.reason}</Td>
                    <Td className="num text-right">{money(w.qty * (g?.costPerUnit ?? 0))}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Panel>
      </div>

      <PurchaseOrderForm />
      <WasteForm />
    </PageFrame>
  );
}
