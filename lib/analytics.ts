import { BRANDS, CHANNELS, dayKey, seedDailyStats } from "@/lib/data/seed";
import type { KitchenData } from "@/lib/store";
import type { ChannelId, DailyStat, Ingredient, MenuItem, Order } from "@/lib/types";

const statsCache = new Map<string, DailyStat[]>();

/** Historic daily aggregates, regenerated from the seed date (deterministic, not persisted). */
export function historyFor(seededAt: string): DailyStat[] {
  const key = seededAt.slice(0, 10);
  let s = statsCache.get(key);
  if (!s) {
    s = seedDailyStats(new Date(seededAt));
    statsCache.set(key, s);
  }
  return s;
}

export function fmtMoney(n: number, currency = "INR", locale = "en-IN", compact = false) {
  if (compact && currency === "INR") {
    // Indian grouping reads as K, L (lakh) and Cr (crore), not the ambiguous Intl "T".
    const a = Math.abs(n);
    const sign = n < 0 ? "-" : "";
    const fmt = (v: number, unit: string) => `${sign}₹${v >= 100 ? Math.round(v) : +v.toFixed(1)}${unit}`;
    if (a >= 1e7) return fmt(a / 1e7, "Cr");
    if (a >= 1e5) return fmt(a / 1e5, "L");
    if (a >= 1e3) return fmt(a / 1e3, "K");
    return `${sign}₹${Math.round(a)}`;
  }
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: compact ? 1 : 0,
    notation: compact ? "compact" : "standard",
  }).format(n);
}

export function fmtNum(n: number, locale = "en-IN", digits = 0) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(n);
}

export function fmtPct(n: number, digits = 1) {
  return `${(n * 100).toFixed(digits)}%`;
}

export const brandName = (id: string) => BRANDS.find((b) => b.id === id)?.name ?? (id === "all" ? "All brands" : id);
export const channelName = (id: string) =>
  CHANNELS.find((c) => c.id === id)?.name ?? (id === "instagram" ? "Instagram" : id === "sms" ? "SMS" : id);

export function isToday(iso: string) {
  return dayKey(new Date(iso)) === dayKey(new Date());
}

export function todaysOrders(orders: Order[]) {
  const today = dayKey(new Date());
  return orders.filter((o) => dayKey(new Date(o.createdAt)) === today);
}

export function liveRevenue(orders: Order[]) {
  return todaysOrders(orders)
    .filter((o) => o.status !== "cancelled")
    .reduce((s, o) => s + o.total, 0);
}

export function itemCost(item: MenuItem, ingredients: Ingredient[]) {
  return item.recipe.reduce((s, r) => s + (ingredients.find((i) => i.id === r.ingredientId)?.costPerUnit ?? 0) * r.qty, 0);
}

export function lowStock(ingredients: Ingredient[], threshold = 0.6) {
  return ingredients
    .map((i) => ({ ...i, ratio: i.stock / i.par }))
    .filter((i) => i.ratio < threshold)
    .sort((a, b) => a.ratio - b.ratio);
}

/** Merge history with today's live orders into one daily series. */
export function dailySeries(data: Pick<KitchenData, "seededAt" | "orders">, daysBack: number, brandId?: string, channel?: ChannelId, includeToday = true) {
  const hist = historyFor(data.seededAt).filter((s) => (!brandId || s.brandId === brandId) && (!channel || s.channel === channel));
  const byDay = new Map<string, { date: string; revenue: number; orders: number; foodCost: number }>();
  for (const s of hist) {
    const d = byDay.get(s.date) ?? { date: s.date, revenue: 0, orders: 0, foodCost: 0 };
    d.revenue += s.revenue;
    d.orders += s.orders;
    d.foodCost += s.foodCost;
    byDay.set(s.date, d);
  }
  const today = dayKey(new Date());
  const live = todaysOrders(data.orders).filter((o) => o.status !== "cancelled" && (!brandId || o.brandId === brandId) && (!channel || o.channel === channel));
  if (includeToday && !byDay.has(today)) {
    const revenue = live.reduce((s, o) => s + o.total, 0);
    byDay.set(today, { date: today, revenue, orders: live.length, foodCost: revenue * 0.31 });
  }
  return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-daysBack);
}

export function breakdown(data: Pick<KitchenData, "seededAt">, daysBack: number, by: "brand" | "channel") {
  const all = historyFor(data.seededAt);
  const dates = [...new Set(all.map((s) => s.date))].sort().slice(-daysBack);
  const from = dates[0];
  const rows = all.filter((s) => s.date >= from);
  const keys = by === "brand" ? BRANDS.map((b) => b.id) : CHANNELS.map((c) => c.id);
  return keys.map((k) => {
    const sel = rows.filter((r) => (by === "brand" ? r.brandId : r.channel) === k);
    const revenue = sel.reduce((s, r) => s + r.revenue, 0);
    const orders = sel.reduce((s, r) => s + r.orders, 0);
    const foodCost = sel.reduce((s, r) => s + r.foodCost, 0);
    return { key: k, name: by === "brand" ? brandName(k) : channelName(k), revenue, orders, aov: orders ? revenue / orders : 0, foodCostPct: revenue ? foodCost / revenue : 0 };
  });
}

/** Top items: today's live mix scaled to the window, which keeps the ranking stable and plausible. */
export function topItems(data: Pick<KitchenData, "orders" | "menu" | "ingredients">, limit = 8) {
  const counts = new Map<string, { qty: number; revenue: number }>();
  for (const o of data.orders) {
    if (o.status === "cancelled") continue;
    for (const l of o.lines) {
      const c = counts.get(l.itemId) ?? { qty: 0, revenue: 0 };
      c.qty += l.qty;
      c.revenue += l.qty * l.price;
      counts.set(l.itemId, c);
    }
  }
  return [...counts.entries()]
    .map(([itemId, c]) => {
      const item = data.menu.find((m) => m.id === itemId);
      const cost = item ? itemCost(item, data.ingredients) : 0;
      return { itemId, name: item?.name ?? itemId, brandId: item?.brandId ?? "", ...c, margin: item ? 1 - cost / item.price : 0 };
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

/** Orders per hour-of-day x weekday, from history shape. */
export function hourHeat(data: Pick<KitchenData, "seededAt">) {
  const weights = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.3, 0.9, 1.3, 1.0, 0.45, 0.35, 0.5, 0.8, 1.35, 1.6, 1.45, 0.9, 0.35];
  const sum = weights.reduce((a, b) => a + b, 0);
  const hist = historyFor(data.seededAt).slice(-28 * 9);
  const byDow = Array.from({ length: 7 }, () => 0);
  const cnt = Array.from({ length: 7 }, () => 0);
  for (const s of hist) {
    const dow = new Date(`${s.date}T12:00:00`).getDay();
    byDow[dow] += s.orders;
    cnt[dow] += 1;
  }
  return byDow.map((total, dow) => {
    const perDay = cnt[dow] ? (total / cnt[dow]) * 9 : 0;
    return { dow, hours: weights.map((w) => (perDay * w) / sum) };
  });
}

export function monthKey(iso: string) {
  return iso.slice(0, 7);
}

/** Month-to-date P&L. Revenue and food cost from history plus today, opex from expenses. */
export function pnl(data: Pick<KitchenData, "seededAt" | "orders" | "expenses" | "payouts">, month = monthKey(new Date().toISOString())) {
  const series = dailySeries(data, 90).filter((d) => d.date.startsWith(month));
  const revenue = series.reduce((s, d) => s + d.revenue, 0);
  const foodCost = series.reduce((s, d) => s + d.foodCost, 0);
  const hist = historyFor(data.seededAt).filter((s) => s.date.startsWith(month));
  const commissions = hist.reduce((s, r) => s + r.revenue * (CHANNELS.find((c) => c.id === r.channel)?.commission ?? 0), 0);
  const exp = data.expenses.filter((e) => e.date.startsWith(month));
  const opexBy = (cat: string) => exp.filter((e) => e.category === cat).reduce((s, e) => s + e.amount, 0);
  const labor = opexBy("Salaries");
  const rent = opexBy("Rent");
  const marketing = opexBy("Marketing");
  const other = exp.reduce((s, e) => s + e.amount, 0) - labor - rent - marketing;
  const net = revenue - foodCost - commissions - labor - rent - marketing - other;
  return {
    month,
    revenue,
    foodCost,
    commissions,
    labor,
    rent,
    marketing,
    other,
    net,
    foodCostPct: revenue ? foodCost / revenue : 0,
    primeCostPct: revenue ? (foodCost + labor) / revenue : 0,
  };
}

export function dueSoon(iso: string, days = 3) {
  return new Date(iso).getTime() - Date.now() < days * 86400000;
}
