"use client";

import * as A from "@/lib/analytics";
import { getKitchen } from "@/lib/store";
import { getCurrentPath } from "./driver";
import type { JevQuestions, JevResult } from "./jev-types";
import { PAGES, TOOLS } from "./tools";

/** Call Jev through our /api/jev proxy. Throws on network or API errors. */
export async function askJev(state: string, questions: JevQuestions, signal?: AbortSignal): Promise<JevResult> {
  const { settings } = getKitchen();
  const t0 = performance.now();
  const res = await fetch("/api/jev", {
    method: "POST",
    signal,
    headers: { "content-type": "application/json", ...(settings.openrouterKey ? { "x-openrouter-key": settings.openrouterKey } : {}) },
    body: JSON.stringify({ state, questions, model: settings.jevModel || undefined }),
  });
  const data = await res.json().catch(() => ({ error: `Jev proxy returned ${res.status}` }));
  if (!res.ok || data.error) throw new Error(data.error ?? `Jev failed (${res.status})`);
  // Round trip as the user feels it, including our proxy hop.
  return { answers: data.answers ?? {}, model: data.model ?? "jev", mock: !!data.mock, ms: Math.round(performance.now() - t0) };
}

// ---------------------------------------------------------------------------------------
// Tool groups: Jev scores which areas a request touches, so the big model gets a shortlist.
// ---------------------------------------------------------------------------------------

export const TOOL_GROUPS: Record<string, { about: string; tools: string[] }> = {
  orders: { about: "live orders, tickets, kitchen display, phone orders, refunds, bump order status", tools: ["list_orders", "update_order_status", "create_manual_order", "refund_order"] },
  menu: { about: "menu items, dishes, prices, margins, sold out or available items", tools: ["list_menu", "add_menu_item", "set_item_price", "set_item_availability", "get_top_items"] },
  inventory: { about: "stock, ingredients, par levels, restock, reorder, purchase orders, suppliers, waste", tools: ["list_inventory", "list_suppliers", "list_purchase_orders", "create_purchase_order", "send_purchase_order", "receive_purchase_order", "log_waste", "adjust_stock", "list_waste"] },
  sales: { about: "sales, revenue, orders trend, brand or channel performance, food cost, best sellers", tools: ["query_sales", "get_top_items"] },
  billing: { about: "invoices, catering clients, aggregator payouts, commission, disputes", tools: ["list_invoices", "create_invoice", "mark_invoice_paid", "list_payouts", "set_payout_status"] },
  finance: { about: "profit and loss, expenses, budgets, prime cost, spending", tools: ["get_pnl", "list_expenses", "add_expense", "set_budget"] },
  marketing: { about: "campaigns, ads, coupons, discount codes, reviews, ratings, replies", tools: ["list_campaigns", "create_campaign", "set_campaign_status", "list_coupons", "create_coupon", "toggle_coupon", "list_reviews", "reply_to_review"] },
  customers: { about: "customers, regulars, lifetime value, tags, notes, win-back", tools: ["list_customers", "annotate_customer"] },
  staff: { about: "staff, team, shifts, roster, schedule, who is working", tools: ["list_staff_schedule", "add_shift", "remove_shift"] },
};
const ALWAYS = ["navigate_to", "get_kitchen_overview", "get_activity_log", "set_theme"];

// ---------------------------------------------------------------------------------------
// Fast path: requests fully described by picks from closed sets run without the big model.
// ---------------------------------------------------------------------------------------

const INTENTS: Record<string, string> = {
  navigate: "open, go to, show or take me to a page or screen of the app",
  item_availability: "mark a menu item or dish sold out, 86 it, out of stock, or available again",
  campaign_status: "pause, resume or end a marketing campaign",
  coupon_toggle: "activate, enable, pause or disable a coupon code",
  invoice_paid: "mark an invoice paid or record that a client paid an invoice",
  theme: "switch theme, dark mode or light mode",
  overview: "quick status of today, how are we doing right now, today's numbers",
  followup: "refers to something said earlier in this chat, like do it, send them, same again, undo that, yes",
  complex: "anything else: questions needing analysis, creating orders, purchase orders, invoices, coupons, campaigns, replies, numbers, multi-step requests",
};

export interface FastAction {
  tool: string;
  args: Record<string, unknown>;
  /** Turns the tool result into the reply text, so no LLM is needed. */
  reply: (result: unknown) => string;
}

export interface RouteDecision {
  fast: FastAction | null;
  /** Tool names for the big model; null means send everything. */
  shortlist: string[] | null;
  jev: { ms: number; model: string; mock: boolean; intent: string; p: number } | null;
}

const pageName = (route: string) => PAGES.find((p) => p.route === route)?.name ?? route;

export async function routeMessage(text: string, signal?: AbortSignal): Promise<RouteDecision> {
  const k = getKitchen();
  const threshold = k.settings.jevThreshold || 0.8;
  const campaigns = k.campaigns.filter((c) => c.status !== "ended");
  const unpaid = k.invoices.filter((i) => i.status === "sent" || i.status === "overdue");

  const questions: JevQuestions = {
    intent: { type: "choice", instructions: "What does the user want the app to do?", criteria: INTENTS },
    page: { type: "choice", instructions: "Which page of the app is the user talking about?", criteria: Object.fromEntries(PAGES.map((p) => [p.route, `${p.name}: ${p.purpose}`])) },
    item: { type: "choice", instructions: "Which menu item is meant, if any?", criteria: Object.fromEntries(k.menu.map((m) => [m.id, `${m.name} (${A.brandName(m.brandId)}, ${m.category})`])) },
    available: { type: "noul", instructions: "Should the menu item end up available to order (not sold out)?" },
    theme: { type: "choice", instructions: "Which theme?", criteria: { light: "light mode, bright", dark: "dark mode, night", system: "system default, automatic" } },
    ...Object.fromEntries(Object.entries(TOOL_GROUPS).map(([g, v]) => [`area_${g}`, { type: "noul" as const, instructions: `Does handling this request involve ${v.about}?` }])),
  };
  if (campaigns.length) {
    questions.campaign = { type: "choice", instructions: "Which campaign is meant?", criteria: Object.fromEntries(campaigns.map((c) => [c.id, `${c.name} (${A.brandName(c.brandId)}, ${A.channelName(c.channel)})`])) };
    questions.campaign_action = { type: "choice", instructions: "What should happen to the campaign?", criteria: { paused: "pause, stop for now, hold", live: "resume, restart, unpause, turn back on", ended: "end, finish, kill permanently" } };
  }
  if (k.coupons.length) {
    questions.coupon = { type: "choice", instructions: "Which coupon code is meant?", criteria: Object.fromEntries(k.coupons.map((c) => [c.id, `${c.code} coupon, ${c.discountPct}% off`])) };
    questions.coupon_on = { type: "noul", instructions: "Should the coupon end up active (enabled, turned on)?" };
  }
  if (unpaid.length) {
    questions.invoice = { type: "choice", instructions: "Which invoice is meant?", criteria: Object.fromEntries(unpaid.map((i) => [i.id, `${i.number} for ${i.client}`])) };
  }

  const state = `Current page: ${pageName(getCurrentPath())}\nUser request: ${text}`;
  const r = await askJev(state, questions, signal);
  const a = r.answers;
  const pick = (key: string) => (a[key]?.type === "choice" ? (a[key] as { pick: string; p: number }) : null);
  const yes = (key: string) => (a[key]?.type === "noul" ? (a[key] as { p: number }).p : 0.5);

  const intent = pick("intent");
  const jev = { ms: r.ms, model: r.model, mock: r.mock, intent: intent?.pick ?? "complex", p: intent?.p ?? 0 };

  // Shortlist: areas Jev thinks are involved, plus the always-on tools. Fall back to all
  // tools when nothing or nearly everything is flagged.
  const groups = Object.keys(TOOL_GROUPS).filter((g) => yes(`area_${g}`) >= 0.3);
  const page = pick("page");
  if (page && page.p >= 0.6) {
    const g = page.pick.replace("/", "");
    if (TOOL_GROUPS[g] && !groups.includes(g)) groups.push(g);
  }
  const shortlist = groups.length === 0 || groups.length > 5 ? null : [...new Set([...ALWAYS, ...groups.flatMap((g) => TOOL_GROUPS[g].tools)])];

  const sure = (x: { p: number } | null) => !!x && x.p >= threshold;
  let fast: FastAction | null = null;
  if (intent && sure(intent)) {
    switch (intent.pick) {
      case "navigate":
        if (sure(page)) fast = { tool: "navigate_to", args: { page: page!.pick }, reply: () => `Opened ${pageName(page!.pick)}.` };
        break;
      case "item_availability": {
        const item = pick("item");
        const p = yes("available");
        if (sure(item) && (p <= 1 - threshold || p >= threshold)) {
          const available = p >= threshold;
          const name = k.menu.find((m) => m.id === item!.pick)?.name ?? item!.pick;
          fast = { tool: "set_item_availability", args: { itemId: item!.pick, available }, reply: () => `${name} is now ${available ? "available again" : "marked sold out"} on every channel.` };
        }
        break;
      }
      case "campaign_status": {
        const c = pick("campaign");
        const act = pick("campaign_action");
        if (sure(c) && sure(act)) {
          const name = campaigns.find((x) => x.id === c!.pick)?.name ?? c!.pick;
          fast = { tool: "set_campaign_status", args: { campaignId: c!.pick, status: act!.pick }, reply: () => `"${name}" is now ${act!.pick}.` };
        }
        break;
      }
      case "coupon_toggle": {
        const c = pick("coupon");
        const p = yes("coupon_on");
        if (sure(c) && (p <= 1 - threshold || p >= threshold)) {
          const code = k.coupons.find((x) => x.id === c!.pick)?.code ?? c!.pick;
          const active = p >= threshold;
          fast = { tool: "toggle_coupon", args: { coupon: c!.pick, active }, reply: () => `Coupon ${code} is ${active ? "active" : "paused"}.` };
        }
        break;
      }
      case "invoice_paid": {
        const inv = pick("invoice");
        if (sure(inv)) {
          const number = unpaid.find((i) => i.id === inv!.pick)?.number ?? inv!.pick;
          fast = { tool: "mark_invoice_paid", args: { invoice: inv!.pick }, reply: () => `Marked ${number} as paid.` };
        }
        break;
      }
      case "theme": {
        const t = pick("theme");
        if (sure(t)) fast = { tool: "set_theme", args: { theme: t!.pick }, reply: () => `Switched to the ${t!.pick} theme.` };
        break;
      }
      case "overview":
        fast = { tool: "get_kitchen_overview", args: {}, reply: overviewReply };
        break;
    }
  }
  return { fast, shortlist, jev };
}

function overviewReply(result: unknown) {
  const r = result as {
    revenueToday: number;
    ordersToday: number;
    ordersByStatus: Record<string, number>;
    lowStock: string[];
    overdueInvoices: string[];
    unrepliedReviews: number;
    pendingPayouts: number;
  };
  const { settings } = getKitchen();
  const money = (n: number) => A.fmtMoney(n, settings.currency, settings.locale);
  const line = (r.ordersByStatus.new ?? 0) + (r.ordersByStatus.preparing ?? 0);
  const bits = [
    `- ${money(r.revenueToday)} from ${r.ordersToday} orders so far, ${line} on the line now.`,
    r.lowStock.length ? `- ${r.lowStock.length} ingredients below par: ${r.lowStock.slice(0, 3).join(", ")}.` : "- Stock is above par everywhere.",
    r.overdueInvoices.length ? `- Overdue invoices: ${r.overdueInvoices.join(", ")}.` : null,
    r.pendingPayouts ? `- ${r.pendingPayouts} aggregator payouts waiting to be checked.` : null,
    r.unrepliedReviews ? `- ${r.unrepliedReviews} reviews without a reply.` : null,
  ].filter(Boolean);
  return `Today so far:\n\n${bits.join("\n")}`;
}

export function toolsByName(names: string[] | null) {
  return names ? TOOLS.filter((t) => names.includes(t.name)) : TOOLS;
}
