/**
 * Scripted stand-in for the LLM, used when no OpenRouter key is configured (and in e2e tests).
 * It speaks the same OpenAI tool-calling format, so the whole client loop, the UI driver
 * and the tools run for real; only the "thinking" is canned.
 */

interface Msg {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | null;
  tool_calls?: { id: string; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
}

type Out = { content: string | null; tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[] };

let n = 0;
const call = (name: string, args: Record<string, unknown>, content: string | null = null): Out => ({
  content,
  tool_calls: [{ id: `mock_${Date.now()}_${n++}`, type: "function", function: { name, arguments: JSON.stringify(args) } }],
});
const say = (content: string): Out => ({ content });

const PAGES: [RegExp, string][] = [
  [/inventory|stock/, "/inventory"],
  [/order/, "/orders"],
  [/sales|revenue/, "/sales"],
  [/menu/, "/menu"],
  [/billing|invoice|payout/, "/billing"],
  [/marketing|campaign|coupon|review/, "/marketing"],
  [/financ|p&l|pnl|expense|budget/, "/finance"],
  [/customer/, "/customers"],
  [/staff|shift|roster/, "/staff"],
  [/setting/, "/settings"],
  [/home|command|dashboard|overview/, "/"],
];

const inr = (v: number) => `₹${Math.round(v).toLocaleString("en-IN")}`;

export function mockPlanner(messages: Msg[]): Out {
  let lastUser = -1;
  for (let i = messages.length - 1; i >= 0; i--) if (messages[i].role === "user") { lastUser = i; break; }
  const text = String(messages[lastUser]?.content ?? "").toLowerCase();
  const after = messages.slice(lastUser + 1);
  const results = after.filter((m) => m.role === "tool").map((m) => safeJson(m.content));
  const step = results.length;
  const last = results[step - 1] as Record<string, unknown> | undefined;
  const failed = last && typeof last === "object" && "error" in last;
  if (failed) return say(`That didn't go through: ${(last as { error: string }).error}`);

  // Restock / purchase order flow
  if (/restock|reorder|purchase order|low stock|\bpo\b|order more/.test(text)) {
    if (step === 0) return call("list_inventory", { onlyLow: true }, "Checking what's under par first.");
    if (step === 1) return call("list_suppliers", {});
    const low = (results[0] as { id: string; name: string; category: string; suggestedOrderQty: number }[]) ?? [];
    const suppliers = (results[1] as { id: string; name: string; categories: string[]; priceFactor: number }[]) ?? [];
    const named = low.find((i) => text.includes(i.name.toLowerCase()));
    const qtyMatch = text.match(/(\d+(?:\.\d+)?)\s*(kg|l|pcs|litre|liter)/);
    // One purchase order per cheapest supplier, covering every low item it can supply.
    const groups = new Map<string, { ingredientId: string; qty: number }[]>();
    for (const i of named ? [named] : low) {
      const sup = suppliers.filter((s) => s.categories.includes(i.category)).sort((a, b) => a.priceFactor - b.priceFactor)[0];
      if (!sup) continue;
      groups.set(sup.id, [...(groups.get(sup.id) ?? []), { ingredientId: i.id, qty: named && qtyMatch ? Number(qtyMatch[1]) : i.suggestedOrderQty }]);
    }
    const plan = [...groups.entries()];
    if (step === 2 && plan.length === 0) return say("Everything is at or above 60% of par, so nothing needs reordering right now.");
    const idx = step - 2;
    if (idx < plan.length) {
      const [supplierId, lines] = plan[idx];
      return call("create_purchase_order", { supplierId, lines, expectedInDays: 1, notes: "Raised by Kitchen OS agent" });
    }
    if (idx === plan.length) {
      const pos = results.slice(2) as { number: string; supplierId: string; lines: unknown[] }[];
      const nameOf = (id: string) => suppliers.find((s) => s.id === id)?.name ?? id;
      return say(
        `Drafted ${pos.length} purchase order${pos.length > 1 ? "s" : ""} from the cheapest supplier for each category:\n\n${pos
          .map((p) => `- ${p.number}: ${nameOf(p.supplierId)}, ${p.lines.length} item${p.lines.length > 1 ? "s" : ""}`)
          .join("\n")}\n\nThey're saved as drafts. Say "send them" when you're ready.`,
      );
    }
    return say("Done. The purchase order has been sent to the supplier.");
  }

  if (/^send (it|them|all)|send (the )?pos?\b/.test(text)) {
    if (step === 0) return call("list_purchase_orders", { status: "draft" });
    const drafts = results[0] as { number: string }[];
    if (!drafts.length) return say("There are no draft purchase orders to send.");
    if (step <= drafts.length) return call("send_purchase_order", { po: drafts[step - 1].number });
    return say(`Sent ${drafts.length} purchase order${drafts.length > 1 ? "s" : ""}. Suppliers have them now.`);
  }

  if (/coupon|promo code|discount code/.test(text)) {
    if (step === 0) {
      const pct = Number(text.match(/(\d{1,2})\s*%/)?.[1] ?? 15);
      const code = (messages[lastUser].content ?? "").match(/\b[A-Z][A-Z0-9]{3,}\b/)?.[0] ?? `WEEKEND${pct}`;
      return call("create_coupon", { code, discountPct: pct, minOrder: 399, brandId: "all", validDays: 7 });
    }
    const cp = results[0] as { code: string; discountPct: number };
    return say(`Coupon ${cp.code} is live: ${cp.discountPct}% off orders above ₹399, valid for 7 days across all brands.`);
  }

  if (/expense|paid .* for|bill for/.test(text)) {
    if (step === 0) {
      const amount = Number(text.replace(/,/g, "").match(/(\d{3,})/)?.[1] ?? 4500);
      const category = /gas|electric|water|power|utilit/.test(text) ? "Utilities" : /repair|fix|service|hvac|chiller/.test(text) ? "Maintenance" : /box|packag/.test(text) ? "Packaging" : /ad|marketing|instagram/.test(text) ? "Marketing" : "Other";
      return call("add_expense", { category, amount, vendor: category === "Maintenance" ? "CoolTech HVAC" : "Local vendor", note: "Logged by agent" });
    }
    const e = results[0] as { category: string; amount: number };
    return say(`Recorded a ${e.category.toLowerCase()} expense of ${inr(e.amount)}. It's reflected in this month's P&L.`);
  }

  if (/review/.test(text)) {
    if (step === 0) return call("list_reviews", { unrepliedOnly: true, maxRating: 2 });
    if (step === 1) {
      const list = results[0] as { id: string; customerName: string; text: string }[];
      if (!list.length) return say("No unanswered low ratings right now.");
      const r = list[0];
      return call("reply_to_review", { reviewId: r.id, reply: `Hi ${r.customerName.split(" ")[0]}, we're sorry about this. That's not the standard we hold ourselves to. We've flagged it with the kitchen and added a credit to your account for your next order.` });
    }
    return say("Replied to the most recent unanswered low rating with an apology and a credit offer.");
  }

  if (/sold out|86|out of stock|unavailable/.test(text)) {
    if (step === 0) return call("list_menu", {});
    if (step === 1) {
      const menu = results[0] as { id: string; name: string }[];
      const item = menu.find((m) => text.includes(m.name.toLowerCase())) ?? menu.find((m) => m.name.toLowerCase().split(" ").some((w) => w.length > 4 && text.includes(w)));
      if (!item) return say("Which item should I mark as sold out?");
      return call("set_item_availability", { itemId: item.id, available: false });
    }
    const it = results[1] as { name: string };
    return say(`${it.name} is now marked sold out on every channel.`);
  }

  if (/sales|revenue|how .*doing|food cost|best brand|which brand/.test(text)) {
    if (step === 0) return call("query_sales", { days: 7, groupBy: "brand" });
    const rows = results[0] as { name: string; revenue: number; orders: number; foodCostPct: number }[];
    const total = rows.reduce((s, r) => s + r.revenue, 0);
    const top = [...rows].sort((a, b) => b.revenue - a.revenue)[0];
    return say(
      `Last 7 days: ${inr(total)} across ${rows.reduce((s, r) => s + r.orders, 0)} orders.\n\n${rows
        .map((r) => `- ${r.name}: ${inr(r.revenue)}, food cost ${(r.foodCostPct * 100).toFixed(1)}%`)
        .join("\n")}\n\n${top.name} leads. Tandoor Theory's food cost ran hot last week; paneer and cream prices are the likely cause.`,
    );
  }

  if (/^(go to|open|show( me)?|take me to)\b/.test(text)) {
    const hit = PAGES.find(([re]) => re.test(text));
    if (hit && step === 0) return call("navigate_to", { page: hit[1] });
    if (hit) return say("Here you go.");
  }

  return say(
    "I'm running in demo mode (no OpenRouter key), so I only understand a few scripted requests. Try:\n- Restock what's low\n- Create a 20% coupon WEEKEND20\n- Mark garlic bread sold out\n- Reply to the latest bad review\n- How are sales this week?\n\nAdd OPENROUTER_API_KEY to .env.local or paste a key in Settings for the full agent.",
  );
}

function safeJson(s: unknown) {
  try {
    return JSON.parse(String(s));
  } catch {
    return s;
  }
}
