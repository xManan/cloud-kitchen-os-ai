import type {
  Brand,
  Budget,
  Campaign,
  ChannelId,
  Coupon,
  Customer,
  DailyStat,
  Expense,
  Ingredient,
  Invoice,
  MenuItem,
  Order,
  OrderStatus,
  Payout,
  PurchaseOrder,
  Review,
  Shift,
  Staff,
  Supplier,
  WasteEntry,
} from "@/lib/types";

/** Deterministic PRNG so every demo starts from the same kitchen. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T,>(r: () => number, arr: readonly T[]) => arr[Math.floor(r() * arr.length)];
const round = (n: number, d = 0) => Math.round(n * 10 ** d) / 10 ** d;
export const dayKey = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);

export const CHANNELS: { id: ChannelId; name: string; commission: number; slot: 1 | 2 | 3 }[] = [
  { id: "dashbite", name: "DashBite", commission: 0.24, slot: 1 },
  { id: "foodrun", name: "FoodRun", commission: 0.21, slot: 2 },
  { id: "direct", name: "Direct", commission: 0.03, slot: 3 },
];

export const BRANDS: Brand[] = [
  { id: "b-tandoor", name: "Tandoor Theory", cuisine: "North Indian", slot: 1 },
  { id: "b-bowl", name: "Bowl Republic", cuisine: "Asian bowls", slot: 2 },
  { id: "b-crust", name: "Crust Lab", cuisine: "Wood-fired pizza", slot: 3 },
];

export const SUPPLIERS: Supplier[] = [
  { id: "s-greenleaf", name: "Greenleaf Produce", leadDays: 1, rating: 4.6, priceFactor: 1.0, categories: ["Produce"], phone: "+91 98100 21345" },
  { id: "s-mandi", name: "Mandi Direct", leadDays: 2, rating: 4.1, priceFactor: 0.9, categories: ["Produce", "Dry goods"], phone: "+91 98100 77821" },
  { id: "s-dairyco", name: "Pure Dairy Co.", leadDays: 1, rating: 4.7, priceFactor: 1.04, categories: ["Dairy"], phone: "+91 98111 40021" },
  { id: "s-prime", name: "Prime Proteins", leadDays: 1, rating: 4.4, priceFactor: 1.0, categories: ["Protein"], phone: "+91 98112 65530" },
  { id: "s-metro", name: "Metro Wholesale", leadDays: 3, rating: 3.9, priceFactor: 0.86, categories: ["Dry goods", "Sauces", "Dairy", "Protein"], phone: "+91 98113 90012" },
  { id: "s-packit", name: "PackIt Supplies", leadDays: 2, rating: 4.3, priceFactor: 1.0, categories: ["Packaging"], phone: "+91 98114 11876" },
];

type IngSeed = [id: string, name: string, unit: Ingredient["unit"], category: Ingredient["category"], cost: number, par: number, supplierId: string];
const ING: IngSeed[] = [
  ["i-onion", "Onion", "kg", "Produce", 32, 40, "s-greenleaf"],
  ["i-tomato", "Tomato", "kg", "Produce", 38, 35, "s-greenleaf"],
  ["i-garlic", "Garlic", "kg", "Produce", 180, 6, "s-greenleaf"],
  ["i-ginger", "Ginger", "kg", "Produce", 140, 6, "s-greenleaf"],
  ["i-coriander", "Coriander", "kg", "Produce", 90, 4, "s-greenleaf"],
  ["i-capsicum", "Bell pepper", "kg", "Produce", 110, 12, "s-greenleaf"],
  ["i-mushroom", "Mushroom", "kg", "Produce", 220, 10, "s-greenleaf"],
  ["i-bokchoy", "Bok choy", "kg", "Produce", 160, 8, "s-greenleaf"],
  ["i-basil", "Basil", "kg", "Produce", 420, 2, "s-greenleaf"],
  ["i-paneer", "Paneer", "kg", "Dairy", 380, 25, "s-dairyco"],
  ["i-cream", "Fresh cream", "L", "Dairy", 220, 15, "s-dairyco"],
  ["i-butter", "Butter", "kg", "Dairy", 520, 12, "s-dairyco"],
  ["i-mozzarella", "Mozzarella", "kg", "Dairy", 560, 30, "s-dairyco"],
  ["i-yogurt", "Yogurt", "kg", "Dairy", 90, 20, "s-dairyco"],
  ["i-chicken", "Chicken thigh", "kg", "Protein", 290, 45, "s-prime"],
  ["i-mutton", "Mutton", "kg", "Protein", 720, 12, "s-prime"],
  ["i-tofu", "Tofu", "kg", "Protein", 240, 10, "s-prime"],
  ["i-egg", "Eggs", "pcs", "Protein", 7, 360, "s-prime"],
  ["i-rice", "Basmati rice", "kg", "Dry goods", 110, 60, "s-metro"],
  ["i-jasmine", "Jasmine rice", "kg", "Dry goods", 140, 30, "s-metro"],
  ["i-flour", "00 flour", "kg", "Dry goods", 85, 50, "s-metro"],
  ["i-atta", "Whole wheat atta", "kg", "Dry goods", 48, 40, "s-mandi"],
  ["i-noodles", "Wheat noodles", "kg", "Dry goods", 160, 20, "s-metro"],
  ["i-spice", "Garam masala", "kg", "Dry goods", 900, 3, "s-mandi"],
  ["i-oil", "Sunflower oil", "L", "Dry goods", 145, 40, "s-metro"],
  ["i-olive", "Olive oil", "L", "Dry goods", 780, 8, "s-metro"],
  ["i-soy", "Soy sauce", "L", "Sauces", 210, 10, "s-metro"],
  ["i-gochujang", "Gochujang", "kg", "Sauces", 640, 5, "s-metro"],
  ["i-pizzasauce", "San Marzano sauce", "kg", "Sauces", 330, 20, "s-metro"],
  ["i-makhani", "Makhani base", "kg", "Sauces", 260, 18, "s-metro"],
  ["i-box-pizza", "Pizza box 10in", "pcs", "Packaging", 18, 400, "s-packit"],
  ["i-bowl-cont", "Kraft bowl 750ml", "pcs", "Packaging", 11, 600, "s-packit"],
  ["i-curry-cont", "Curry tub 500ml", "pcs", "Packaging", 9, 600, "s-packit"],
  ["i-bag", "Paper carry bag", "pcs", "Packaging", 6, 800, "s-packit"],
];

/** Stock ratio vs par, tuned so a few items are visibly low on load. */
const STOCK_RATIO: Record<string, number> = {
  "i-paneer": 0.28,
  "i-mozzarella": 0.42,
  "i-bowl-cont": 0.35,
  "i-coriander": 0.5,
  "i-chicken": 0.61,
  "i-gochujang": 0.2,
  "i-cream": 0.55,
};

export function seedIngredients(): Ingredient[] {
  const r = rng(11);
  return ING.map(([id, name, unit, category, cost, par, supplierId]) => {
    const ratio = STOCK_RATIO[id] ?? 0.8 + r() * 0.7;
    return {
      id,
      name,
      unit,
      category,
      costPerUnit: cost,
      par,
      supplierId,
      stock: round(par * ratio, unit === "pcs" ? 0 : 1),
    };
  });
}

type ItemSeed = [id: string, brandId: string, name: string, category: string, price: number, prep: number, recipe: [string, number][]];
const ITEMS: ItemSeed[] = [
  ["m-pbm", "b-tandoor", "Paneer butter masala", "Curries", 329, 14, [["i-paneer", 0.18], ["i-makhani", 0.15], ["i-cream", 0.04], ["i-butter", 0.02], ["i-curry-cont", 1]]],
  ["m-bc", "b-tandoor", "Butter chicken", "Curries", 369, 16, [["i-chicken", 0.22], ["i-makhani", 0.15], ["i-cream", 0.04], ["i-butter", 0.025], ["i-curry-cont", 1]]],
  ["m-dal", "b-tandoor", "Dal makhani", "Curries", 259, 10, [["i-makhani", 0.08], ["i-cream", 0.03], ["i-butter", 0.02], ["i-curry-cont", 1]]],
  ["m-tikka", "b-tandoor", "Chicken tikka", "Tandoor", 349, 18, [["i-chicken", 0.25], ["i-yogurt", 0.06], ["i-spice", 0.006], ["i-bag", 1]]],
  ["m-ptikka", "b-tandoor", "Paneer tikka", "Tandoor", 319, 15, [["i-paneer", 0.2], ["i-yogurt", 0.06], ["i-capsicum", 0.05], ["i-bag", 1]]],
  ["m-rj", "b-tandoor", "Mutton rogan josh", "Curries", 489, 20, [["i-mutton", 0.22], ["i-onion", 0.1], ["i-spice", 0.008], ["i-curry-cont", 1]]],
  ["m-biryani", "b-tandoor", "Chicken dum biryani", "Rice", 389, 22, [["i-chicken", 0.18], ["i-rice", 0.18], ["i-onion", 0.08], ["i-curry-cont", 1]]],
  ["m-naan", "b-tandoor", "Butter naan", "Breads", 69, 6, [["i-flour", 0.09], ["i-butter", 0.01]]],
  ["m-gochu", "b-bowl", "Gochujang chicken bowl", "Bowls", 349, 12, [["i-chicken", 0.18], ["i-jasmine", 0.15], ["i-gochujang", 0.03], ["i-bowl-cont", 1]]],
  ["m-teriyaki", "b-bowl", "Teriyaki tofu bowl", "Bowls", 299, 10, [["i-tofu", 0.16], ["i-jasmine", 0.15], ["i-soy", 0.03], ["i-bowl-cont", 1]]],
  ["m-hakka", "b-bowl", "Hakka noodles", "Noodles", 249, 9, [["i-noodles", 0.15], ["i-capsicum", 0.05], ["i-soy", 0.02], ["i-bowl-cont", 1]]],
  ["m-chilli", "b-bowl", "Chilli paneer bowl", "Bowls", 319, 11, [["i-paneer", 0.16], ["i-jasmine", 0.15], ["i-capsicum", 0.05], ["i-bowl-cont", 1]]],
  ["m-ramen", "b-bowl", "Spicy egg ramen", "Noodles", 329, 12, [["i-noodles", 0.15], ["i-egg", 2], ["i-bokchoy", 0.05], ["i-bowl-cont", 1]]],
  ["m-friedrice", "b-bowl", "Garlic fried rice", "Rice", 229, 8, [["i-jasmine", 0.2], ["i-garlic", 0.02], ["i-egg", 1], ["i-bowl-cont", 1]]],
  ["m-mush", "b-bowl", "Black pepper mushroom bowl", "Bowls", 289, 10, [["i-mushroom", 0.16], ["i-jasmine", 0.15], ["i-soy", 0.02], ["i-bowl-cont", 1]]],
  ["m-margherita", "b-crust", "Margherita", "Pizza", 399, 9, [["i-flour", 0.2], ["i-mozzarella", 0.14], ["i-pizzasauce", 0.08], ["i-basil", 0.004], ["i-box-pizza", 1]]],
  ["m-pepperoni", "b-crust", "Chicken pepperoni", "Pizza", 499, 10, [["i-flour", 0.2], ["i-mozzarella", 0.14], ["i-chicken", 0.08], ["i-pizzasauce", 0.08], ["i-box-pizza", 1]]],
  ["m-tikkapizza", "b-crust", "Paneer tikka pizza", "Pizza", 459, 10, [["i-flour", 0.2], ["i-mozzarella", 0.12], ["i-paneer", 0.08], ["i-capsicum", 0.04], ["i-box-pizza", 1]]],
  ["m-funghi", "b-crust", "Funghi", "Pizza", 449, 10, [["i-flour", 0.2], ["i-mozzarella", 0.13], ["i-mushroom", 0.08], ["i-box-pizza", 1]]],
  ["m-garlicbread", "b-crust", "Garlic bread", "Sides", 179, 6, [["i-flour", 0.1], ["i-butter", 0.03], ["i-garlic", 0.01], ["i-bag", 1]]],
  ["m-veggie", "b-crust", "Garden veggie", "Pizza", 429, 10, [["i-flour", 0.2], ["i-mozzarella", 0.12], ["i-capsicum", 0.06], ["i-onion", 0.04], ["i-box-pizza", 1]]],
];

export function seedMenu(): MenuItem[] {
  return ITEMS.map(([id, brandId, name, category, price, prepMins, recipe]) => ({
    id,
    brandId,
    name,
    category,
    price,
    prepMins,
    available: true,
    recipe: recipe.map(([ingredientId, qty]) => ({ ingredientId, qty })),
  }));
}

const FIRST = ["Aarav", "Diya", "Kabir", "Meera", "Rohan", "Isha", "Arjun", "Sara", "Vikram", "Neha", "Kunal", "Anaya", "Dev", "Priya", "Rahul", "Tara", "Aditya", "Zoya", "Nikhil", "Riya", "Omar", "Leela", "Sameer", "Ira"];
const LAST = ["Mehta", "Kapoor", "Sharma", "Iyer", "Singh", "Rao", "Khan", "Das", "Menon", "Joshi", "Patel", "Verma", "Nair", "Bose", "Gill"];
const AREAS = ["Indiranagar", "Koramangala", "HSR Layout", "Whitefield", "Jayanagar", "MG Road", "Bellandur", "Malleshwaram"];

export function seedCustomers(now: Date): Customer[] {
  const r = rng(23);
  return Array.from({ length: 80 }, (_, i) => {
    const orders = 1 + Math.floor(r() ** 2 * 38);
    const tags: string[] = [];
    if (orders > 20) tags.push("Regular");
    if (orders <= 2) tags.push("New");
    if (r() > 0.85) tags.push("Corporate");
    return {
      id: `c-${i + 1}`,
      name: `${pick(r, FIRST)} ${pick(r, LAST)}`,
      phone: `+91 9${Math.floor(100000000 + r() * 899999999)}`,
      area: pick(r, AREAS),
      orders,
      ltv: round(orders * (280 + r() * 260)),
      lastOrderAt: addDays(now, -Math.floor(r() ** 2 * 60)).toISOString(),
      tags,
      notes: [],
    };
  });
}

/** Weekly and intra-day demand shape; weekends and dinner run hotter. */
const DOW = [1.25, 0.82, 0.86, 0.9, 0.97, 1.18, 1.35];
const HOUR_WEIGHT = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.3, 0.9, 1.3, 1.0, 0.45, 0.35, 0.5, 0.8, 1.35, 1.6, 1.45, 0.9, 0.35];
const BRAND_SHARE: Record<string, number> = { "b-tandoor": 0.44, "b-bowl": 0.3, "b-crust": 0.26 };
const CHANNEL_SHARE: Record<ChannelId, number> = { dashbite: 0.48, foodrun: 0.36, direct: 0.16 };
const AVG_TICKET: Record<string, number> = { "b-tandoor": 640, "b-bowl": 470, "b-crust": 760 };

/** 90 days of aggregate history (not persisted; regenerated deterministically). */
export function seedDailyStats(now: Date, days = 90): DailyStat[] {
  const r = rng(37);
  const out: DailyStat[] = [];
  for (let d = days; d >= 1; d--) {
    const date = addDays(now, -d);
    const trend = 1 + (days - d) * 0.0035;
    // A food-cost wobble last week gives the agent something real to explain.
    const costSpike = d <= 9 && d >= 3 ? 1.09 : 1;
    for (const b of BRANDS) {
      for (const c of CHANNELS) {
        const base = 128 * BRAND_SHARE[b.id] * CHANNEL_SHARE[c.id] * DOW[date.getDay()] * trend;
        const orders = Math.max(1, Math.round(base * (0.85 + r() * 0.3)));
        const revenue = round(orders * AVG_TICKET[b.id] * (0.92 + r() * 0.16));
        const foodCost = round(revenue * (b.id === "b-tandoor" && costSpike > 1 ? 0.33 * costSpike : 0.3 + r() * 0.02));
        out.push({ date: dayKey(date), brandId: b.id, channel: c.id, orders, revenue, foodCost });
      }
    }
  }
  return out;
}

export function hourlyWeights() {
  return HOUR_WEIGHT;
}

function makeOrder(
  r: () => number,
  menu: MenuItem[],
  customers: Customer[],
  createdAt: Date,
  seq: number,
  status: OrderStatus,
  taxPct: number,
): Order {
  const brandRoll = r();
  const brand = brandRoll < 0.44 ? BRANDS[0] : brandRoll < 0.74 ? BRANDS[1] : BRANDS[2];
  const chRoll = r();
  const channel: ChannelId = chRoll < 0.48 ? "dashbite" : chRoll < 0.84 ? "foodrun" : "direct";
  const items = menu.filter((m) => m.brandId === brand.id);
  const lineCount = 1 + Math.floor(r() * 3);
  const lines = Array.from({ length: lineCount }, () => {
    const it = pick(r, items);
    return { itemId: it.id, qty: 1 + Math.floor(r() * 2), price: it.price };
  }).filter((l, i, arr) => arr.findIndex((x) => x.itemId === l.itemId) === i);
  const subtotal = lines.reduce((s, l) => s + l.qty * l.price, 0);
  const discount = r() > 0.8 ? round(subtotal * 0.1) : 0;
  const tax = round((subtotal - discount) * (taxPct / 100));
  return {
    id: `o-${seq}`,
    number: `#${String(4100 + seq)}`,
    brandId: brand.id,
    channel,
    lines,
    subtotal,
    discount,
    tax,
    total: round(subtotal - discount + tax),
    status,
    createdAt: createdAt.toISOString(),
    customerId: pick(r, customers).id,
    couponCode: discount ? "WELCOME10" : undefined,
  };
}

/** Today's detailed orders up to `now`, plus a live queue in the KDS. */
export function seedOrders(now: Date, menu: MenuItem[], customers: Customer[], taxPct: number): Order[] {
  const r = rng(51);
  const start = new Date(now);
  start.setHours(11, 0, 0, 0);
  const orders: Order[] = [];
  let seq = 1;
  const elapsedMin = Math.max(0, (now.getTime() - start.getTime()) / 60000);
  // Spread a realistic count across the elapsed part of the day.
  for (let m = 0; m < elapsedMin; m += 1) {
    const hour = new Date(start.getTime() + m * 60000).getHours();
    if (r() < HOUR_WEIGHT[hour] * 0.13) {
      const at = new Date(start.getTime() + m * 60000);
      const age = (now.getTime() - at.getTime()) / 60000;
      const status: OrderStatus =
        age < 4 ? "new" : age < 16 ? "preparing" : age < 22 ? "ready" : age < 40 ? "dispatched" : r() > 0.02 ? "delivered" : "cancelled";
      orders.push(makeOrder(r, menu, customers, at, seq++, status, taxPct));
    }
  }
  // Guarantee a lively KDS regardless of the time the demo is opened.
  const live: [OrderStatus, number][] = [
    ["new", 1], ["new", 2], ["new", 3], ["preparing", 6], ["preparing", 9], ["preparing", 12], ["preparing", 14], ["ready", 18], ["ready", 20], ["dispatched", 26],
  ];
  for (const [status, ago] of live) {
    orders.push(makeOrder(r, menu, customers, new Date(now.getTime() - ago * 60000), seq++, status, taxPct));
  }
  return orders.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function seedPurchaseOrders(now: Date, ingredients: Ingredient[]): PurchaseOrder[] {
  const ing = (id: string) => ingredients.find((i) => i.id === id)!;
  const line = (id: string, qty: number) => ({ ingredientId: id, qty, unitCost: ing(id).costPerUnit });
  return [
    { id: "po-1", number: "PO-1021", supplierId: "s-prime", lines: [line("i-chicken", 30), line("i-egg", 180)], status: "sent", createdAt: addDays(now, -1).toISOString(), expectedAt: addDays(now, 0).toISOString(), createdBy: "user" },
    { id: "po-2", number: "PO-1020", supplierId: "s-greenleaf", lines: [line("i-onion", 25), line("i-tomato", 20), line("i-coriander", 2)], status: "received", createdAt: addDays(now, -3).toISOString(), expectedAt: addDays(now, -2).toISOString(), createdBy: "user" },
    { id: "po-3", number: "PO-1019", supplierId: "s-metro", lines: [line("i-rice", 50), line("i-oil", 30), line("i-soy", 8)], status: "received", createdAt: addDays(now, -6).toISOString(), expectedAt: addDays(now, -3).toISOString(), createdBy: "user" },
  ];
}

export function seedInvoices(now: Date): Invoice[] {
  return [
    { id: "inv-1", number: "INV-2041", client: "Northwind Labs", email: "accounts@northwind.example", lines: [{ description: "Team lunch, 40 covers", qty: 40, rate: 320 }], taxPct: 5, status: "sent", issuedAt: addDays(now, -6).toISOString(), dueAt: addDays(now, 9).toISOString() },
    { id: "inv-2", number: "INV-2040", client: "Brightside Studio", email: "finance@brightside.example", lines: [{ description: "Weekly catering, Friday", qty: 25, rate: 290 }], taxPct: 5, status: "overdue", issuedAt: addDays(now, -24).toISOString(), dueAt: addDays(now, -9).toISOString() },
    { id: "inv-3", number: "INV-2039", client: "Kestrel Fintech", email: "ap@kestrel.example", lines: [{ description: "Offsite dinner", qty: 60, rate: 450 }, { description: "Delivery and setup", qty: 1, rate: 1500 }], taxPct: 5, status: "paid", issuedAt: addDays(now, -30).toISOString(), dueAt: addDays(now, -15).toISOString() },
    { id: "inv-4", number: "INV-2038", client: "Harbor Co-working", email: "ops@harbor.example", lines: [{ description: "Monthly snack boxes", qty: 120, rate: 140 }], taxPct: 5, status: "paid", issuedAt: addDays(now, -38).toISOString(), dueAt: addDays(now, -23).toISOString() },
  ];
}

export function seedPayouts(now: Date, stats: DailyStat[]): Payout[] {
  const out: Payout[] = [];
  let n = 1;
  for (let w = 4; w >= 1; w--) {
    const end = addDays(now, -7 * (w - 1) - 1);
    const start = addDays(end, -6);
    for (const c of CHANNELS.filter((c) => c.id !== "direct")) {
      const rows = stats.filter((s) => s.channel === c.id && s.date >= dayKey(start) && s.date <= dayKey(end));
      const gross = round(rows.reduce((s, x) => s + x.revenue, 0));
      const orders = rows.reduce((s, x) => s + x.orders, 0);
      const commission = round(gross * c.commission);
      const adjustments = w === 2 && c.id === "dashbite" ? -4820 : w === 1 ? -round(gross * 0.004) : 0;
      out.push({
        id: `pay-${n++}`,
        channel: c.id as Payout["channel"],
        periodStart: start.toISOString(),
        periodEnd: end.toISOString(),
        orders,
        gross,
        commission,
        adjustments,
        net: round(gross - commission + adjustments),
        status: w >= 3 ? "reconciled" : "pending",
        note: w === 2 && c.id === "dashbite" ? "Unexplained deduction: 14 orders marked as customer refunds" : undefined,
      });
    }
  }
  return out;
}

export function seedExpenses(now: Date): Expense[] {
  const r = rng(71);
  const out: Expense[] = [];
  let n = 1;
  for (let m = 2; m >= 0; m--) {
    const first = new Date(now.getFullYear(), now.getMonth() - m, 1, 10);
    const add = (category: Expense["category"], amount: number, vendor: string, day: number, note?: string) => {
      const date = new Date(first.getFullYear(), first.getMonth(), day, 10);
      if (date <= now) out.push({ id: `e-${n++}`, category, amount: round(amount), vendor, date: date.toISOString(), note });
    };
    add("Rent", 185000, "Sunrise Properties", 1);
    add("Salaries", 412000 + r() * 12000, "Payroll", 28);
    add("Utilities", 48000 + r() * 9000, "BESCOM + gas", 8);
    add("Packaging", 26000 + r() * 6000, "PackIt Supplies", 12);
    add("Marketing", 38000 + r() * 12000, "Ads across channels", 15);
    add("Software", 14500, "POS and aggregator tools", 3);
    add("Maintenance", 6000 + r() * 9000, "CoolTech HVAC", 19, "Walk-in chiller service");
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

export const BUDGETS: Budget[] = [
  { category: "Rent", monthly: 185000 },
  { category: "Salaries", monthly: 430000 },
  { category: "Utilities", monthly: 55000 },
  { category: "Packaging", monthly: 30000 },
  { category: "Marketing", monthly: 45000 },
  { category: "Software", monthly: 15000 },
  { category: "Maintenance", monthly: 12000 },
  { category: "Other", monthly: 10000 },
];

export function seedCampaigns(now: Date): Campaign[] {
  return [
    { id: "cmp-1", name: "Biryani Sundays", channel: "dashbite", brandId: "b-tandoor", budget: 25000, spent: 17400, status: "live", startAt: addDays(now, -12).toISOString(), endAt: addDays(now, 16).toISOString(), impressions: 184000, orders: 412, couponCode: "BIRYANI15" },
    { id: "cmp-2", name: "Lunch bowls under 300", channel: "foodrun", brandId: "b-bowl", budget: 18000, spent: 9100, status: "live", startAt: addDays(now, -6).toISOString(), endAt: addDays(now, 8).toISOString(), impressions: 96000, orders: 188 },
    { id: "cmp-3", name: "Pizza night SMS blast", channel: "sms", brandId: "b-crust", budget: 6000, spent: 6000, status: "ended", startAt: addDays(now, -30).toISOString(), endAt: addDays(now, -23).toISOString(), impressions: 12000, orders: 143, couponCode: "PIZZANIGHT" },
    { id: "cmp-4", name: "Win-back lapsed regulars", channel: "instagram", brandId: "b-tandoor", budget: 12000, spent: 0, status: "scheduled", startAt: addDays(now, 3).toISOString(), endAt: addDays(now, 17).toISOString(), impressions: 0, orders: 0 },
  ];
}

export function seedCoupons(now: Date): Coupon[] {
  return [
    { id: "cp-1", code: "WELCOME10", discountPct: 10, minOrder: 299, brandId: "all", validTo: addDays(now, 60).toISOString(), uses: 642, active: true },
    { id: "cp-2", code: "BIRYANI15", discountPct: 15, minOrder: 499, brandId: "b-tandoor", validTo: addDays(now, 16).toISOString(), uses: 289, active: true },
    { id: "cp-3", code: "PIZZANIGHT", discountPct: 20, minOrder: 699, brandId: "b-crust", validTo: addDays(now, -23).toISOString(), uses: 143, active: false },
  ];
}

const REVIEW_TEXT: [number, string][] = [
  [5, "Butter chicken was rich and still hot on arrival. Packaging held up perfectly."],
  [2, "Waited 70 minutes and the naan was soggy by the time it came."],
  [4, "Great gochujang bowl, could use a little more sauce."],
  [1, "Order arrived without the garlic bread I paid for."],
  [5, "Best margherita in the area, crust is properly charred."],
  [3, "Biryani was good but portion felt smaller than last time."],
  [4, "Teriyaki tofu bowl is my go-to lunch now."],
  [2, "Pizza was cold and the box was crushed."],
  [5, "Paneer tikka had a lovely smoky char."],
  [3, "Ramen broth was a bit salty for me."],
];

export function seedReviews(now: Date): Review[] {
  const r = rng(91);
  return REVIEW_TEXT.map(([rating, text], i) => {
    const brandId = /pizza|margherita|garlic bread|crust/i.test(text) ? "b-crust" : /bowl|ramen|gochujang|teriyaki/i.test(text) ? "b-bowl" : "b-tandoor";
    return {
      id: `rv-${i + 1}`,
      channel: r() > 0.5 ? "dashbite" : "foodrun",
      brandId,
      rating,
      text,
      customerName: `${pick(r, FIRST)} ${pick(r, LAST)[0]}.`,
      createdAt: new Date(now.getTime() - (i * 7 + r() * 5) * 3600000).toISOString(),
      reply: i === 0 ? "Thank you! We will tell the tandoor team." : undefined,
    };
  });
}

export function seedStaff(): Staff[] {
  return [
    { id: "st-1", name: "Farhan Qureshi", role: "Head chef", hourlyRate: 520 },
    { id: "st-2", name: "Lakshmi Pillai", role: "Line cook", hourlyRate: 260 },
    { id: "st-3", name: "Joseph D'Souza", role: "Line cook", hourlyRate: 250 },
    { id: "st-4", name: "Pooja Rawat", role: "Prep cook", hourlyRate: 190 },
    { id: "st-5", name: "Manoj Kumar", role: "Prep cook", hourlyRate: 185 },
    { id: "st-6", name: "Asha Thomas", role: "Packer", hourlyRate: 160 },
    { id: "st-7", name: "Imran Sheikh", role: "Dispatcher", hourlyRate: 175 },
    { id: "st-8", name: "Nandini Rao", role: "Manager", hourlyRate: 450 },
  ];
}

export function seedShifts(now: Date, staff: Staff[]): Shift[] {
  const out: Shift[] = [];
  let n = 1;
  for (let d = 0; d < 7; d++) {
    const date = dayKey(addDays(now, d));
    staff.forEach((s, i) => {
      if ((i + d) % 6 === 5) return; // weekly off rotates
      const early = (i + d) % 2 === 0;
      out.push({ id: `sh-${n++}`, staffId: s.id, date, start: early ? "10:00" : "15:00", end: early ? "18:00" : "23:00" });
    });
  }
  return out;
}

export function seedWaste(now: Date): WasteEntry[] {
  return [
    { id: "w-1", ingredientId: "i-coriander", qty: 0.6, reason: "Spoiled", date: addDays(now, -1).toISOString() },
    { id: "w-2", ingredientId: "i-cream", qty: 1.5, reason: "Expired", date: addDays(now, -2).toISOString() },
    { id: "w-3", ingredientId: "i-chicken", qty: 2.2, reason: "Overproduced", date: addDays(now, -2).toISOString() },
    { id: "w-4", ingredientId: "i-mozzarella", qty: 1.1, reason: "Dropped", date: addDays(now, -4).toISOString() },
    { id: "w-5", ingredientId: "i-paneer", qty: 1.8, reason: "Spoiled", date: addDays(now, -5).toISOString() },
  ];
}
