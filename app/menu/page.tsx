"use client";

import { PencilSimple, Plus } from "@phosphor-icons/react";
import { useState } from "react";
import { MenuItemForm, PriceForm } from "@/components/forms";
import { AgentButton, PageFrame } from "@/components/shell/Page";
import { Badge, Button, Meter, PageHeader, Panel, Segmented, Switch, Table, Td, Th, cn } from "@/components/ui";
import * as A from "@/lib/analytics";
import { BRANDS } from "@/lib/data/seed";
import { useMoney } from "@/lib/hooks";
import { useKitchen } from "@/lib/store";
import { useUI } from "@/lib/ui-store";

export default function MenuPage() {
  const menu = useKitchen((s) => s.menu);
  const ingredients = useKitchen((s) => s.ingredients);
  const setAvailability = useKitchen((s) => s.setAvailability);
  const openForm = useUI((s) => s.openForm);
  const money = useMoney();
  const [brand, setBrand] = useState("all");

  const rows = menu
    .filter((m) => brand === "all" || m.brandId === brand)
    .map((m) => {
      const cost = A.itemCost(m, ingredients);
      return { ...m, cost, margin: m.price ? 1 - cost / m.price : 0 };
    });
  const soldOut = menu.filter((m) => !m.available).length;
  const lowMargin = rows.filter((r) => r.recipe.length && r.margin < 0.62);

  return (
    <PageFrame route="/menu">
      <PageHeader
        title="Menu"
        sub={`${menu.length} items across ${BRANDS.length} brands${soldOut ? `, ${soldOut} sold out` : ""}. Food cost comes from each item's recipe and current ingredient prices.`}
        actions={
          <Button variant="primary" data-agent-open="menu-item" onClick={() => openForm("menu-item")}>
            <Plus size={16} weight="bold" /> Add item
          </Button>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented label="Brand" value={brand} onChange={setBrand} options={[{ value: "all", label: "All brands" }, ...BRANDS.map((b) => ({ value: b.id, label: b.name }))]} />
        {lowMargin.length > 0 && (
          <AgentButton prompt="Find menu items with gross margin under 62% and suggest new prices that bring them to 65% margin, rounded to end in 9. Show me before changing anything.">
            {lowMargin.length} items under 62% margin
          </AgentButton>
        )}
      </div>

      <Panel className="overflow-hidden">
        <Table>
          <thead>
            <tr>
              <Th>Item</Th>
              <Th>Brand</Th>
              <Th>Category</Th>
              <Th className="text-right">Price</Th>
              <Th className="text-right">Food cost</Th>
              <Th className="w-[180px]">Margin</Th>
              <Th>Available</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id} data-row-id={m.id} className={cn(!m.available && "opacity-60")}>
                <Td className="font-medium">
                  {m.name}
                  {!m.available && (
                    <Badge tone="bad" className="ml-2">
                      Sold out
                    </Badge>
                  )}
                </Td>
                <Td className="text-ink-2">{A.brandName(m.brandId)}</Td>
                <Td className="text-ink-2">{m.category}</Td>
                <Td className="text-right">
                  <button
                    type="button"
                    data-agent-target={`price:${m.id}`}
                    onClick={() => openForm("price", { itemId: m.id })}
                    className="num group inline-flex cursor-pointer items-center gap-1.5 rounded-[6px] px-1.5 py-0.5 hover:bg-paper-2"
                    aria-label={`Change price of ${m.name}`}
                  >
                    {money(m.price)}
                    <PencilSimple size={12} className="text-ink-3 opacity-0 transition-opacity group-hover:opacity-100" />
                  </button>
                </Td>
                <Td className="num text-right text-ink-2">{m.recipe.length ? money(m.cost) : "No recipe"}</Td>
                <Td>
                  {m.recipe.length ? (
                    <div className="flex items-center gap-2.5">
                      <Meter value={m.margin} tone={m.margin < 0.62 ? "warn" : "good"} label={`${m.name} margin`} />
                      <span className={cn("num w-10 text-right text-xs", m.margin < 0.62 ? "font-medium text-warn" : "text-ink-2")}>{Math.round(m.margin * 100)}%</span>
                    </div>
                  ) : (
                    <span className="text-xs text-ink-3">Add a recipe</span>
                  )}
                </Td>
                <Td>
                  <Switch checked={m.available} onCheckedChange={(v) => setAvailability(m.id, v)} label={`${m.name} available`} data-agent-target={`avail:${m.id}`} />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Panel>

      <MenuItemForm />
      <PriceForm />
    </PageFrame>
  );
}
