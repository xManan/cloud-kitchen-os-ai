"use client";

import { z } from "zod";
import * as A from "@/lib/analytics";
import { BRANDS, CHANNELS } from "@/lib/data/seed";
import * as S from "@/lib/schemas";
import { getKitchen } from "@/lib/store";
import { useUI } from "@/lib/ui-store";
import { click, fillAndSubmit, flash, navigate, waitFor } from "./driver";
import { defineTool, type ToolDef } from "./registry";

/** Every page the agent can open, with what it is for. Also feeds the system prompt. */
export const PAGES = [
  { route: "/", name: "Command center", purpose: "Today at a glance: live revenue, ticket rail, things that need attention, recent activity." },
  { route: "/orders", name: "Orders", purpose: "Live kitchen display (new, preparing, ready, dispatched), order history, manual orders, refunds." },
  { route: "/sales", name: "Sales", purpose: "Revenue and order trends, brand and channel split, hourly heatmap, top items." },
  { route: "/menu", name: "Menu", purpose: "Items per brand with price, food cost and margin; add items, change prices, mark sold out." },
  { route: "/inventory", name: "Inventory", purpose: "Stock vs par levels, purchase orders, suppliers, waste log, stock counts." },
  { route: "/billing", name: "Billing", purpose: "Catering invoices, aggregator payouts and commission reconciliation." },
  { route: "/marketing", name: "Marketing", purpose: "Campaigns, coupons, customer reviews and replies." },
  { route: "/finance", name: "Finance", purpose: "Month-to-date P&L, food and prime cost, expenses, budgets vs actual." },
  { route: "/customers", name: "Customers", purpose: "Customer list, lifetime value, tags and notes." },
  { route: "/staff", name: "Staff", purpose: "Team roster and the 7-day shift schedule." },
  { route: "/settings", name: "Settings", purpose: "Kitchen profile, AI model, agent behaviour, demo reset." },
] as const;

const routes = PAGES.map((p) => p.route) as [string, ...string[]];
const k = () => getKitchen();
const money = (n: number) => Math.round(n);
const ing = (id: string) => k().ingredients.find((i) => i.id === id);

/** Navigate (in Show me mode) then run the background action and ring the affected row. */
async function onPage<T>(route: string, run: () => T, row?: (r: T) => string): Promise<T> {
  await navigate(route);
  const r = run();
  if (row) await flash(row(r));
  return r;
}

const brandEnum = z.enum(BRANDS.map((b) => b.id) as [string, ...string[]]);

export const TOOLS: ToolDef[] = [
  // ---------- navigation and context ----------
  defineTool({
    name: "navigate_to",
    kind: "nav",
    title: (a) => `Opening ${PAGES.find((p) => p.route === a.page)?.name ?? a.page}`,
    description: "Open a page of the app so the user can see it. Use when the user asks to see or go somewhere, or before explaining something on screen.",
    schema: z.object({ page: z.enum(routes).describe("Route of the page") }),
    run: async (a) => {
      await navigate(a.page);
      return { opened: a.page };
    },
  }),
  defineTool({
    name: "get_kitchen_overview",
    kind: "read",
    title: () => "Checking today's numbers",
    description: "Snapshot of today: revenue so far, order counts by status, low-stock count, overdue invoices, pending payouts, average rating, live campaigns.",
    schema: z.object({}),
    run: () => {
      const d = k();
      const today = A.todaysOrders(d.orders);
      const byStatus = Object.fromEntries(["new", "preparing", "ready", "dispatched", "delivered", "cancelled"].map((s) => [s, today.filter((o) => o.status === s).length]));
      const yesterday = A.dailySeries(d, 2)[0];
      return {
        date: new Date().toDateString(),
        revenueToday: money(A.liveRevenue(d.orders)),
        ordersToday: today.length,
        revenueYesterday: money(yesterday?.revenue ?? 0),
        ordersByStatus: byStatus,
        lowStock: A.lowStock(d.ingredients).map((i) => `${i.name} (${Math.round(i.ratio * 100)}% of par)`),
        soldOut: d.menu.filter((m) => !m.available).map((m) => m.name),
        overdueInvoices: d.invoices.filter((i) => i.status === "overdue").map((i) => i.number),
        pendingPayouts: d.payouts.filter((p) => p.status === "pending").length,
        avgRating: +(d.reviews.reduce((s, r) => s + r.rating, 0) / d.reviews.length).toFixed(2),
        unrepliedReviews: d.reviews.filter((r) => !r.reply).length,
        liveCampaigns: d.campaigns.filter((c) => c.status === "live").map((c) => c.name),
      };
    },
  }),
  defineTool({
    name: "get_activity_log",
    kind: "read",
    title: () => "Reading the activity log",
    description: "Recent actions taken in the app by the user or the agent.",
    schema: z.object({ limit: z.number().int().min(1).max(50).default(15) }),
    run: (a) => k().activity.slice(0, a.limit),
  }),

  // ---------- sales ----------
  defineTool({
    name: "query_sales",
    kind: "read",
    title: (a) => `Pulling sales for the last ${a.days} days`,
    description: "Revenue, orders, average order value and food cost. Group by day, brand or channel; optionally filter by brand or channel.",
    schema: z.object({
      days: z.number().int().min(1).max(90).default(7),
      groupBy: z.enum(["day", "brand", "channel"]).default("day"),
      brandId: brandEnum.optional(),
      channel: z.enum(["dashbite", "foodrun", "direct"]).optional(),
    }),
    run: (a) => {
      const d = k();
      if (a.groupBy === "day") {
        return A.dailySeries(d, a.days, a.brandId, a.channel).map((r) => ({
          date: r.date,
          revenue: money(r.revenue),
          orders: r.orders,
          aov: money(r.revenue / Math.max(1, r.orders)),
          foodCostPct: +(r.foodCost / Math.max(1, r.revenue)).toFixed(3),
        }));
      }
      return A.breakdown(d, a.days, a.groupBy).map((r) => ({ ...r, revenue: money(r.revenue), aov: money(r.aov), foodCostPct: +r.foodCostPct.toFixed(3) }));
    },
  }),
  defineTool({
    name: "get_top_items",
    kind: "read",
    title: () => "Ranking best sellers",
    description: "Best-selling menu items today by revenue, with quantity and gross margin.",
    schema: z.object({ limit: z.number().int().min(1).max(20).default(8) }),
    run: (a) => A.topItems(k(), a.limit).map((t) => ({ ...t, brand: A.brandName(t.brandId), margin: +t.margin.toFixed(2) })),
  }),

  // ---------- orders ----------
  defineTool({
    name: "list_orders",
    kind: "read",
    title: () => "Looking at orders",
    description: "Today's orders, newest first. Filter by status or brand.",
    schema: z.object({
      status: z.enum(["new", "preparing", "ready", "dispatched", "delivered", "cancelled"]).optional(),
      brandId: brandEnum.optional(),
      limit: z.number().int().min(1).max(50).default(15),
    }),
    run: (a) => {
      const d = k();
      return A.todaysOrders(d.orders)
        .filter((o) => (!a.status || o.status === a.status) && (!a.brandId || o.brandId === a.brandId))
        .slice(-a.limit)
        .reverse()
        .map((o) => ({
          id: o.id,
          number: o.number,
          brand: A.brandName(o.brandId),
          channel: o.channel,
          status: o.status,
          minutesAgo: Math.round((Date.now() - new Date(o.createdAt).getTime()) / 60000),
          total: o.total,
          items: o.lines.map((l) => `${l.qty}x ${d.menu.find((m) => m.id === l.itemId)?.name}`).join(", "),
        }));
    },
  }),
  defineTool({
    name: "update_order_status",
    kind: "write",
    title: (a) => `Moving order ${a.order} to ${a.status}`,
    description: "Move an order along the kitchen line (new -> preparing -> ready -> dispatched -> delivered).",
    schema: z.object({
      order: z.string().describe("Order id (o-12) or number (#4112)"),
      status: z.enum(["preparing", "ready", "dispatched", "delivered"]),
    }),
    run: (a) => k().setOrderStatus(a.order, a.status, "agent"),
    ui: async (a) => {
      await navigate("/orders");
      const o = k().orders.find((x) => x.id === a.order || x.number === a.order || x.number === `#${a.order}`);
      const btn = o && document.querySelector<HTMLElement>(`[data-agent-target="advance:${o.id}"]`);
      if (o && btn && nextStatus(o.status) === a.status) {
        await click(btn, `Bumping ${o.number}`);
        return k().orders.find((x) => x.id === o.id);
      }
      const r = k().setOrderStatus(a.order, a.status, "agent");
      await flash(`[data-row-id="${r.id}"]`);
      return r;
    },
  }),
  defineTool({
    name: "create_manual_order",
    kind: "write",
    form: true,
    title: (a) => `Creating an order for ${a.customerName}`,
    description: "Create a phone or walk-in order. All items must belong to the chosen brand; use list_menu for item ids.",
    schema: S.manualOrderSchema,
    run: (a) => k().createManualOrder(a, "agent"),
    ui: (a, ctx) => fillAndSubmit({ route: "/orders", formId: "manual-order", values: a, submit: ctx.submit }),
  }),
  defineTool({
    name: "refund_order",
    kind: "write",
    title: (a) => `Refunding order ${a.order}`,
    description: "Cancel and refund an order. Always confirm with the user first; the app will also ask them.",
    schema: z.object({ order: z.string().describe("Order id or number"), reason: z.string().max(120).optional() }),
    confirm: (a) => `Refund and cancel order ${a.order}${a.reason ? ` (${a.reason})` : ""}?`,
    run: (a) => k().refundOrder(a.order, "agent"),
    ui: (a) => onPage("/orders", () => k().refundOrder(a.order, "agent"), (r) => `[data-row-id="${r.id}"]`),
  }),

  // ---------- menu ----------
  defineTool({
    name: "list_menu",
    kind: "read",
    title: () => "Reading the menu",
    description: "Menu items with id, brand, price, food cost, margin and availability.",
    schema: z.object({ brandId: brandEnum.optional() }),
    run: (a) => {
      const d = k();
      return d.menu
        .filter((m) => !a.brandId || m.brandId === a.brandId)
        .map((m) => {
          const cost = A.itemCost(m, d.ingredients);
          return { id: m.id, name: m.name, brandId: m.brandId, category: m.category, price: m.price, foodCost: money(cost), margin: +(1 - cost / m.price).toFixed(2), available: m.available };
        });
    },
  }),
  defineTool({
    name: "add_menu_item",
    kind: "write",
    form: true,
    title: (a) => `Adding ${a.name} to the menu`,
    description: "Add a new item to a brand's menu.",
    schema: S.menuItemSchema,
    run: (a) => k().addMenuItem(a, "agent"),
    ui: (a, ctx) => fillAndSubmit({ route: "/menu", formId: "menu-item", values: a, submit: ctx.submit }),
  }),
  defineTool({
    name: "set_item_price",
    kind: "write",
    title: (a) => `Repricing ${k().menu.find((m) => m.id === a.itemId)?.name ?? a.itemId}`,
    description: "Change a menu item's price.",
    schema: S.priceChangeSchema,
    run: (a) => k().setPrice(a, "agent"),
    ui: async (a, ctx) => {
      await navigate("/menu");
      const btn = document.querySelector<HTMLElement>(`[data-agent-target="price:${a.itemId}"]`);
      if (btn) await click(btn, "Editing price");
      else useUI.getState().openForm("price", { itemId: a.itemId });
      return fillAndSubmit({ route: "/menu", formId: "price", values: { price: a.price }, submit: ctx.submit });
    },
  }),
  defineTool({
    name: "set_item_availability",
    kind: "write",
    title: (a) => `${a.available ? "Restoring" : "Marking sold out"}: ${k().menu.find((m) => m.id === a.itemId)?.name ?? a.itemId}`,
    description: "Mark a menu item sold out (86) or available again.",
    schema: z.object({ itemId: z.string(), available: z.boolean() }),
    run: (a) => k().setAvailability(a.itemId, a.available, "agent"),
    ui: async (a) => {
      await navigate("/menu");
      const sw = await waitFor<HTMLElement>(`[data-agent-target="avail:${a.itemId}"]`).catch(() => null);
      const item = k().menu.find((m) => m.id === a.itemId);
      if (sw && item && item.available !== a.available) {
        await click(sw, "Flipping availability");
        return k().menu.find((m) => m.id === a.itemId);
      }
      return k().setAvailability(a.itemId, a.available, "agent");
    },
  }),

  // ---------- inventory ----------
  defineTool({
    name: "list_inventory",
    kind: "read",
    title: (a) => (a.onlyLow ? "Finding items below par" : "Checking stock levels"),
    description: "Ingredients with stock, par level, unit, unit cost and default supplier.",
    schema: z.object({
      onlyLow: z.boolean().default(false).describe("Only items under 60% of par"),
      category: z.enum(["Produce", "Dairy", "Protein", "Dry goods", "Packaging", "Sauces"]).optional(),
    }),
    run: (a) => {
      const d = k();
      return d.ingredients
        .filter((i) => (!a.onlyLow || i.stock / i.par < 0.6) && (!a.category || i.category === a.category))
        .map((i) => ({ id: i.id, name: i.name, category: i.category, unit: i.unit, stock: i.stock, par: i.par, pctOfPar: Math.round((i.stock / i.par) * 100), unitCost: i.costPerUnit, defaultSupplierId: i.supplierId, suggestedOrderQty: Math.max(0, Math.ceil(i.par * 1.2 - i.stock)) }));
    },
  }),
  defineTool({
    name: "list_suppliers",
    kind: "read",
    title: () => "Comparing suppliers",
    description: "Suppliers with categories, lead time, rating and price factor (multiplier on base cost; lower is cheaper).",
    schema: z.object({ category: z.enum(["Produce", "Dairy", "Protein", "Dry goods", "Packaging", "Sauces"]).optional() }),
    run: (a) => k().suppliers.filter((s) => !a.category || s.categories.includes(a.category)),
  }),
  defineTool({
    name: "list_purchase_orders",
    kind: "read",
    title: () => "Reviewing purchase orders",
    description: "Purchase orders with supplier, status, lines and total.",
    schema: z.object({ status: z.enum(["draft", "sent", "received", "cancelled"]).optional() }),
    run: (a) => {
      const d = k();
      return d.purchaseOrders
        .filter((p) => !a.status || p.status === a.status)
        .map((p) => ({
          id: p.id,
          number: p.number,
          supplier: d.suppliers.find((s) => s.id === p.supplierId)?.name,
          status: p.status,
          expected: p.expectedAt.slice(0, 10),
          total: money(p.lines.reduce((s, l) => s + l.qty * l.unitCost, 0)),
          lines: p.lines.map((l) => `${l.qty} ${ing(l.ingredientId)?.unit} ${ing(l.ingredientId)?.name}`),
        }));
    },
  }),
  defineTool({
    name: "create_purchase_order",
    kind: "write",
    form: true,
    title: (a) => `Drafting a purchase order for ${k().suppliers.find((s) => s.id === a.supplierId)?.name ?? a.supplierId}`,
    description: "Draft a purchase order to one supplier. Check list_suppliers first; a supplier should cover the ingredient's category. Use send_purchase_order afterwards if the user wants it sent.",
    schema: S.purchaseOrderSchema,
    run: (a) => k().createPurchaseOrder(a, "agent"),
    ui: async (a, ctx) => {
      const po = await fillAndSubmit({ route: "/inventory", formId: "purchase-order", values: a, submit: ctx.submit });
      if (po && typeof po === "object" && "id" in po) await flash(`[data-row-id="${(po as { id: string }).id}"]`);
      return po;
    },
  }),
  defineTool({
    name: "send_purchase_order",
    kind: "write",
    title: (a) => `Sending ${a.po}`,
    description: "Send a draft purchase order to its supplier.",
    schema: z.object({ po: z.string().describe("PO id or number, e.g. PO-1022") }),
    run: (a) => k().sendPurchaseOrder(a.po, "agent"),
    ui: async (a) => {
      await navigate("/inventory");
      const po = k().purchaseOrders.find((p) => p.id === a.po || p.number === a.po);
      const btn = po && document.querySelector<HTMLElement>(`[data-agent-target="send:${po.id}"]`);
      if (btn) {
        await click(btn, `Sending ${po!.number}`);
        return k().purchaseOrders.find((p) => p.id === po!.id);
      }
      return k().sendPurchaseOrder(a.po, "agent");
    },
  }),
  defineTool({
    name: "receive_purchase_order",
    kind: "write",
    title: (a) => `Receiving ${a.po}`,
    description: "Mark a purchase order as delivered; adds its quantities to stock.",
    schema: z.object({ po: z.string() }),
    run: (a) => k().receivePurchaseOrder(a.po, "agent"),
    ui: async (a) => {
      await navigate("/inventory");
      const po = k().purchaseOrders.find((p) => p.id === a.po || p.number === a.po);
      const btn = po && document.querySelector<HTMLElement>(`[data-agent-target="receive:${po.id}"]`);
      if (btn) {
        await click(btn, `Receiving ${po!.number}`);
        return k().purchaseOrders.find((p) => p.id === po!.id);
      }
      return k().receivePurchaseOrder(a.po, "agent");
    },
  }),
  defineTool({
    name: "log_waste",
    kind: "write",
    form: true,
    title: (a) => `Logging waste: ${ing(a.ingredientId)?.name ?? a.ingredientId}`,
    description: "Record wasted stock; it is deducted from inventory.",
    schema: S.wasteSchema,
    run: (a) => k().logWaste(a, "agent"),
    ui: (a, ctx) => fillAndSubmit({ route: "/inventory", formId: "waste", values: a, submit: ctx.submit }),
  }),
  defineTool({
    name: "adjust_stock",
    kind: "write",
    title: (a) => `Updating count for ${ing(a.ingredientId)?.name ?? a.ingredientId}`,
    description: "Set an ingredient's stock to a counted value.",
    schema: S.stockAdjustSchema,
    run: (a) => k().adjustStock(a, "agent"),
    ui: (a) => onPage("/inventory", () => k().adjustStock(a, "agent"), (r) => `[data-row-id="${r.id}"]`),
  }),
  defineTool({
    name: "list_waste",
    kind: "read",
    title: () => "Reading the waste log",
    description: "Recent waste entries with cost.",
    schema: z.object({}),
    run: () => k().waste.map((w) => ({ ...w, item: ing(w.ingredientId)?.name, cost: money((ing(w.ingredientId)?.costPerUnit ?? 0) * w.qty) })),
  }),

  // ---------- billing ----------
  defineTool({
    name: "list_invoices",
    kind: "read",
    title: () => "Checking invoices",
    description: "Catering and corporate invoices with totals and status.",
    schema: z.object({ status: z.enum(["draft", "sent", "paid", "overdue"]).optional() }),
    run: (a) =>
      k()
        .invoices.filter((i) => !a.status || i.status === a.status)
        .map((i) => {
          const sub = i.lines.reduce((s, l) => s + l.qty * l.rate, 0);
          return { id: i.id, number: i.number, client: i.client, status: i.status, due: i.dueAt.slice(0, 10), total: money(sub * (1 + i.taxPct / 100)) };
        }),
  }),
  defineTool({
    name: "create_invoice",
    kind: "write",
    form: true,
    title: (a) => `Invoicing ${a.client}`,
    description: "Create and send an invoice to a catering or corporate client.",
    schema: S.invoiceSchema,
    run: (a) => k().createInvoice(a, "agent"),
    ui: (a, ctx) => fillAndSubmit({ route: "/billing", formId: "invoice", values: a, submit: ctx.submit }),
  }),
  defineTool({
    name: "mark_invoice_paid",
    kind: "write",
    title: (a) => `Marking ${a.invoice} paid`,
    description: "Record payment for an invoice.",
    schema: z.object({ invoice: z.string().describe("Invoice id or number") }),
    run: (a) => k().markInvoicePaid(a.invoice, "agent"),
    ui: async (a) => {
      await navigate("/billing");
      const inv = k().invoices.find((i) => i.id === a.invoice || i.number === a.invoice);
      const btn = inv && document.querySelector<HTMLElement>(`[data-agent-target="paid:${inv.id}"]`);
      if (btn) {
        await click(btn, `Marking ${inv!.number} paid`);
        return k().invoices.find((i) => i.id === inv!.id);
      }
      return k().markInvoicePaid(a.invoice, "agent");
    },
  }),
  defineTool({
    name: "list_payouts",
    kind: "read",
    title: () => "Reconciling aggregator payouts",
    description: "Weekly DashBite and FoodRun payouts: gross, commission, adjustments, net, status and notes. Commission rates: DashBite 24%, FoodRun 21%.",
    schema: z.object({ status: z.enum(["pending", "reconciled", "disputed"]).optional() }),
    run: (a) =>
      k()
        .payouts.filter((p) => !a.status || p.status === a.status)
        .map((p) => ({ ...p, periodStart: p.periodStart.slice(0, 10), periodEnd: p.periodEnd.slice(0, 10), effectiveCommission: +(p.commission / p.gross).toFixed(3) })),
  }),
  defineTool({
    name: "set_payout_status",
    kind: "write",
    title: (a) => `Marking payout ${a.status}`,
    description: "Mark a payout reconciled, or raise a dispute with a note.",
    schema: z.object({ payoutId: z.string(), status: z.enum(["reconciled", "disputed", "pending"]), note: z.string().max(200).optional() }),
    confirm: (a) => (a.status === "disputed" ? `Raise a dispute on this payout${a.note ? `: "${a.note}"` : ""}?` : ""),
    run: (a) => k().setPayoutStatus(a.payoutId, a.status, a.note, "agent"),
    ui: (a) => onPage("/billing", () => k().setPayoutStatus(a.payoutId, a.status, a.note, "agent"), (r) => `[data-row-id="${r.id}"]`),
  }),

  // ---------- finance ----------
  defineTool({
    name: "get_pnl",
    kind: "read",
    title: () => "Building the P&L",
    description: "Month-to-date profit and loss: revenue, food cost, aggregator commissions, labour, rent, marketing, other, net; plus budget vs actual by category.",
    schema: z.object({ month: z.string().regex(/^\d{4}-\d{2}$/).optional().describe("YYYY-MM, defaults to this month") }),
    run: (a) => {
      const d = k();
      const p = A.pnl(d, a.month);
      const month = p.month;
      const budget = d.budgets.map((b) => ({ category: b.category, budget: b.monthly, actual: money(d.expenses.filter((e) => e.category === b.category && e.date.startsWith(month)).reduce((s, e) => s + e.amount, 0)) }));
      return { ...Object.fromEntries(Object.entries(p).map(([kk, v]) => [kk, typeof v === "number" && Math.abs(v) > 1 ? money(v) : v])), budget };
    },
  }),
  defineTool({
    name: "list_expenses",
    kind: "read",
    title: () => "Reading expenses",
    description: "Recorded expenses, newest first.",
    schema: z.object({ category: S.expenseSchema.shape.category.optional(), limit: z.number().int().min(1).max(50).default(20) }),
    run: (a) => k().expenses.filter((e) => !a.category || e.category === a.category).slice(0, a.limit).map((e) => ({ ...e, date: e.date.slice(0, 10), amount: money(e.amount) })),
  }),
  defineTool({
    name: "add_expense",
    kind: "write",
    form: true,
    title: (a) => `Recording a ${a.category.toLowerCase()} expense`,
    description: "Record an expense.",
    schema: S.expenseSchema,
    run: (a) => k().addExpense(a, "agent"),
    ui: (a, ctx) => fillAndSubmit({ route: "/finance", formId: "expense", values: a, submit: ctx.submit }),
  }),
  defineTool({
    name: "set_budget",
    kind: "write",
    title: (a) => `Setting the ${a.category} budget`,
    description: "Set a monthly budget for an expense category.",
    schema: S.budgetSchema,
    run: (a) => k().setBudget(a, "agent"),
    ui: (a) => onPage("/finance", () => k().setBudget(a, "agent"), (r) => `[data-row-id="budget-${r.category}"]`),
  }),

  // ---------- marketing ----------
  defineTool({
    name: "list_campaigns",
    kind: "read",
    title: () => "Reviewing campaigns",
    description: "Marketing campaigns with budget, spend, impressions, attributed orders and status.",
    schema: z.object({}),
    run: () => k().campaigns.map((c) => ({ ...c, brand: A.brandName(c.brandId), startAt: c.startAt.slice(0, 10), endAt: c.endAt.slice(0, 10), costPerOrder: c.orders ? money(c.spent / c.orders) : null })),
  }),
  defineTool({
    name: "create_campaign",
    kind: "write",
    form: true,
    title: (a) => `Setting up campaign "${a.name}"`,
    description: "Create a campaign. Starts live if startInDays is 0, otherwise scheduled.",
    schema: S.campaignSchema,
    run: (a) => k().createCampaign(a, "agent"),
    ui: (a, ctx) => fillAndSubmit({ route: "/marketing", formId: "campaign", values: a, submit: ctx.submit }),
  }),
  defineTool({
    name: "set_campaign_status",
    kind: "write",
    title: (a) => `Setting campaign to ${a.status}`,
    description: "Pause, resume (live) or end a campaign.",
    schema: z.object({ campaignId: z.string(), status: z.enum(["live", "paused", "ended"]) }),
    run: (a) => k().setCampaignStatus(a.campaignId, a.status, "agent"),
    ui: (a) => onPage("/marketing", () => k().setCampaignStatus(a.campaignId, a.status, "agent"), (r) => `[data-row-id="${r.id}"]`),
  }),
  defineTool({
    name: "list_coupons",
    kind: "read",
    title: () => "Checking coupons",
    description: "Coupon codes with discount, minimum order, brand, validity and usage.",
    schema: z.object({}),
    run: () => k().coupons.map((c) => ({ ...c, validTo: c.validTo.slice(0, 10) })),
  }),
  defineTool({
    name: "create_coupon",
    kind: "write",
    form: true,
    title: (a) => `Creating coupon ${a.code}`,
    description: "Create a coupon code. Code must be capital letters and digits.",
    schema: S.couponSchema,
    run: (a) => k().createCoupon(a, "agent"),
    ui: (a, ctx) => fillAndSubmit({ route: "/marketing", formId: "coupon", values: a, submit: ctx.submit }),
  }),
  defineTool({
    name: "toggle_coupon",
    kind: "write",
    title: (a) => `${a.active ? "Activating" : "Pausing"} coupon ${a.coupon}`,
    description: "Activate or pause a coupon.",
    schema: z.object({ coupon: z.string().describe("Coupon id or code"), active: z.boolean() }),
    run: (a) => k().toggleCoupon(a.coupon, a.active, "agent"),
    ui: (a) => onPage("/marketing", () => k().toggleCoupon(a.coupon, a.active, "agent"), (r) => `[data-row-id="${r.id}"]`),
  }),
  defineTool({
    name: "list_reviews",
    kind: "read",
    title: () => "Reading reviews",
    description: "Customer reviews from DashBite and FoodRun with rating, text, any reply, and Jev's topic and urgency tags (urgency 0 to 1). Sorted most urgent first.",
    schema: z.object({
      maxRating: z.number().int().min(1).max(5).optional(),
      unrepliedOnly: z.boolean().default(false),
      urgentOnly: z.boolean().default(false).describe("Only reviews Jev tagged as needing a reply today"),
    }),
    run: (a) =>
      k()
        .reviews.filter((r) => (!a.maxRating || r.rating <= a.maxRating) && (!a.unrepliedOnly || !r.reply) && (!a.urgentOnly || (r.urgency ?? 0) >= 0.6))
        .sort((x, y) => (y.urgency ?? 0) - (x.urgency ?? 0))
        .map((r) => ({ ...r, brand: A.brandName(r.brandId) })),
  }),
  defineTool({
    name: "reply_to_review",
    kind: "write",
    form: true,
    title: () => "Replying to a review",
    description: "Post a public reply to a review. Keep it short, specific and warm; apologise and offer a fix for complaints.",
    schema: S.reviewReplySchema,
    run: (a) => k().replyToReview(a, "agent"),
    ui: async (a, ctx) => {
      await navigate("/marketing");
      const btn = document.querySelector<HTMLElement>(`[data-agent-target="reply:${a.reviewId}"]`);
      if (btn) await click(btn, "Opening reply");
      else useUI.getState().openForm("review-reply", { reviewId: a.reviewId });
      return fillAndSubmit({ route: "/marketing", formId: "review-reply", values: { reply: a.reply }, submit: ctx.submit });
    },
  }),

  // ---------- customers ----------
  defineTool({
    name: "list_customers",
    kind: "read",
    title: () => "Looking up customers",
    description: "Customers with orders, lifetime value, last order date, tags and notes.",
    schema: z.object({
      search: z.string().optional().describe("Name contains"),
      tag: z.string().optional(),
      sort: z.enum(["ltv", "recent", "lapsed"]).default("ltv"),
      limit: z.number().int().min(1).max(50).default(10),
    }),
    run: (a) => {
      const list = k().customers.filter((c) => (!a.search || c.name.toLowerCase().includes(a.search.toLowerCase())) && (!a.tag || c.tags.includes(a.tag)));
      const sorted = [...list].sort((x, y) =>
        a.sort === "ltv" ? y.ltv - x.ltv : a.sort === "recent" ? y.lastOrderAt.localeCompare(x.lastOrderAt) : x.lastOrderAt.localeCompare(y.lastOrderAt),
      );
      return sorted.slice(0, a.limit).map((c) => ({ ...c, lastOrderAt: c.lastOrderAt.slice(0, 10) }));
    },
  }),
  defineTool({
    name: "annotate_customer",
    kind: "write",
    title: () => "Updating a customer",
    description: "Add a note and/or tag to a customer.",
    schema: S.customerNoteSchema,
    run: (a) => k().annotateCustomer(a, "agent"),
    ui: (a) => onPage("/customers", () => k().annotateCustomer(a, "agent"), (r) => `[data-row-id="${r.id}"]`),
  }),

  // ---------- staff ----------
  defineTool({
    name: "list_staff_schedule",
    kind: "read",
    title: () => "Checking the roster",
    description: "Staff (id, name, role, hourly rate) and their shifts for the next 7 days. Optionally filter one date.",
    schema: z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }),
    run: (a) => {
      const d = k();
      return {
        staff: d.staff,
        shifts: d.shifts.filter((s) => !a.date || s.date === a.date).map((s) => ({ ...s, name: d.staff.find((x) => x.id === s.staffId)?.name })),
      };
    },
  }),
  defineTool({
    name: "add_shift",
    kind: "write",
    form: true,
    title: (a) => `Scheduling ${k().staff.find((s) => s.id === a.staffId)?.name ?? a.staffId}`,
    description: "Add a shift for a staff member.",
    schema: S.shiftSchema,
    run: (a) => k().addShift(a, "agent"),
    ui: (a, ctx) => fillAndSubmit({ route: "/staff", formId: "shift", values: a, submit: ctx.submit }),
  }),
  defineTool({
    name: "remove_shift",
    kind: "write",
    title: () => "Removing a shift",
    description: "Delete a scheduled shift.",
    schema: z.object({ shiftId: z.string() }),
    confirm: () => "Remove this shift from the schedule?",
    run: (a) => {
      k().removeShift(a.shiftId, "agent");
      return { removed: a.shiftId };
    },
  }),

  // ---------- app ----------
  defineTool({
    name: "set_theme",
    kind: "write",
    title: (a) => `Switching to ${a.theme} theme`,
    description: "Switch the app between light, dark and system theme.",
    schema: z.object({ theme: z.enum(["light", "dark", "system"]) }),
    run: (a) => {
      useUI.getState().setTheme(a.theme);
      return { theme: a.theme };
    },
  }),
];

export const CHANNEL_LIST = CHANNELS;

function nextStatus(s: string) {
  return ({ new: "preparing", preparing: "ready", ready: "dispatched", dispatched: "delivered" } as Record<string, string>)[s];
}

export function findTool(name: string) {
  return TOOLS.find((t) => t.name === name);
}
