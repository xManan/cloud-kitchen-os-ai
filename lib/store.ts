"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import * as seed from "@/lib/data/seed";
import type {
  ActivityEntry,
  Budget,
  Campaign,
  Coupon,
  Customer,
  Expense,
  Ingredient,
  Invoice,
  MenuItem,
  Order,
  OrderStatus,
  Payout,
  PurchaseOrder,
  Review,
  Settings,
  Shift,
  Staff,
  Supplier,
  WasteEntry,
} from "@/lib/types";
import * as S from "@/lib/schemas";

export interface KitchenData {
  seededAt: string;
  menu: MenuItem[];
  ingredients: Ingredient[];
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  orders: Order[];
  customers: Customer[];
  invoices: Invoice[];
  payouts: Payout[];
  expenses: Expense[];
  budgets: Budget[];
  campaigns: Campaign[];
  coupons: Coupon[];
  reviews: Review[];
  staff: Staff[];
  shifts: Shift[];
  waste: WasteEntry[];
  activity: ActivityEntry[];
  settings: Settings;
}

export type Actor = "user" | "agent";

export const DEFAULT_MODEL = "anthropic/claude-sonnet-5.5";

const DEFAULT_SETTINGS: Settings = {
  kitchenName: "Koramangala Hub",
  currency: "INR",
  locale: "en-IN",
  taxPct: 5,
  // Empty means "use the server default" (OPENROUTER_MODEL, else DEFAULT_MODEL).
  model: "",
  agentMode: "ui",
  agentSpeed: "normal",
  openrouterKey: "",
  jevEnabled: true,
  jevModel: "",
  jevThreshold: 0.8,
};

export function buildSeed(now = new Date()): KitchenData {
  const menu = seed.seedMenu();
  const ingredients = seed.seedIngredients();
  const customers = seed.seedCustomers(now);
  const staff = seed.seedStaff();
  const stats = seed.seedDailyStats(now);
  return {
    seededAt: now.toISOString(),
    menu,
    ingredients,
    suppliers: seed.SUPPLIERS,
    purchaseOrders: seed.seedPurchaseOrders(now, ingredients),
    orders: seed.seedOrders(now, menu, customers, DEFAULT_SETTINGS.taxPct),
    customers,
    invoices: seed.seedInvoices(now),
    payouts: seed.seedPayouts(now, stats),
    expenses: seed.seedExpenses(now),
    budgets: seed.BUDGETS,
    campaigns: seed.seedCampaigns(now),
    coupons: seed.seedCoupons(now),
    reviews: seed.seedReviews(now),
    staff,
    shifts: seed.seedShifts(now, staff),
    waste: seed.seedWaste(now),
    activity: [],
    settings: DEFAULT_SETTINGS,
  };
}

const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 8)}`;
const round = (n: number) => Math.round(n * 100) / 100;
const days = (n: number) => new Date(Date.now() + n * 86400000).toISOString();

export class ActionError extends Error {}

function nextNumber(prefix: string, existing: string[], start: number) {
  const nums = existing.map((n) => parseInt(n.replace(/\D/g, ""), 10)).filter(Number.isFinite);
  return `${prefix}${Math.max(start, ...nums) + 1}`;
}

export interface KitchenActions {
  reset: () => void;
  log: (actor: Actor, text: string, href?: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;

  createPurchaseOrder: (input: S.PurchaseOrderInput, actor?: Actor) => PurchaseOrder;
  sendPurchaseOrder: (poId: string, actor?: Actor) => PurchaseOrder;
  receivePurchaseOrder: (poId: string, actor?: Actor) => PurchaseOrder;
  logWaste: (input: S.WasteInput, actor?: Actor) => WasteEntry;
  adjustStock: (input: S.StockAdjustInput, actor?: Actor) => Ingredient;

  addMenuItem: (input: S.MenuItemInput, actor?: Actor) => MenuItem;
  setPrice: (input: S.PriceChangeInput, actor?: Actor) => MenuItem;
  setAvailability: (itemId: string, available: boolean, actor?: Actor) => MenuItem;

  createManualOrder: (input: S.ManualOrderInput, actor?: Actor) => Order;
  setOrderStatus: (orderId: string, status: OrderStatus, actor?: Actor) => Order;
  refundOrder: (orderId: string, actor?: Actor) => Order;

  createInvoice: (input: S.InvoiceInput, actor?: Actor) => Invoice;
  markInvoicePaid: (invoiceId: string, actor?: Actor) => Invoice;
  setPayoutStatus: (payoutId: string, status: Payout["status"], note?: string, actor?: Actor) => Payout;

  addExpense: (input: S.ExpenseInput, actor?: Actor) => Expense;
  setBudget: (input: S.BudgetInput, actor?: Actor) => Budget;

  createCampaign: (input: S.CampaignInput, actor?: Actor) => Campaign;
  setCampaignStatus: (campaignId: string, status: Campaign["status"], actor?: Actor) => Campaign;
  createCoupon: (input: S.CouponInput, actor?: Actor) => Coupon;
  toggleCoupon: (couponId: string, active: boolean, actor?: Actor) => Coupon;
  replyToReview: (input: S.ReviewReplyInput, actor?: Actor) => Review;
  /** System action: Jev's topic and urgency tags for a review (not logged as activity). */
  tagReview: (reviewId: string, topic: Review["topic"], urgency: number) => void;

  addShift: (input: S.ShiftInput, actor?: Actor) => Shift;
  removeShift: (shiftId: string, actor?: Actor) => void;
  annotateCustomer: (input: S.CustomerNoteInput, actor?: Actor) => Customer;
}

export type KitchenStore = KitchenData & KitchenActions & { hydrated: boolean };

function must<T>(v: T | undefined, what: string): T {
  if (!v) throw new ActionError(`${what} not found`);
  return v;
}

export const useKitchen = create<KitchenStore>()(
  persist(
    (set, get) => {
      const log: KitchenActions["log"] = (actor, text, href) =>
        set((s) => ({ activity: [{ id: uid("a"), at: new Date().toISOString(), actor, text, href }, ...s.activity].slice(0, 80) }));

      return {
        ...buildSeed(),
        hydrated: false,

        reset: () => set({ ...buildSeed(), settings: { ...DEFAULT_SETTINGS, openrouterKey: get().settings.openrouterKey } }),
        log,
        updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

        createPurchaseOrder: (raw, actor = "user") => {
          const input = S.purchaseOrderSchema.parse(raw);
          const { suppliers, ingredients, purchaseOrders } = get();
          const supplier = must(suppliers.find((s) => s.id === input.supplierId), `Supplier ${input.supplierId}`);
          const lines = input.lines.map((l) => {
            const ing = must(ingredients.find((i) => i.id === l.ingredientId), `Ingredient ${l.ingredientId}`);
            return { ingredientId: ing.id, qty: l.qty, unitCost: round(ing.costPerUnit * supplier.priceFactor) };
          });
          const po: PurchaseOrder = {
            id: uid("po"),
            number: nextNumber("PO-", purchaseOrders.map((p) => p.number), 1000),
            supplierId: supplier.id,
            lines,
            status: "draft",
            createdAt: new Date().toISOString(),
            expectedAt: days(input.expectedInDays ?? supplier.leadDays),
            notes: input.notes,
            createdBy: actor,
          };
          set({ purchaseOrders: [po, ...purchaseOrders] });
          log(actor, `Drafted ${po.number} for ${supplier.name}`, "/inventory");
          return po;
        },
        sendPurchaseOrder: (poId, actor = "user") => {
          const po = must(get().purchaseOrders.find((p) => p.id === poId || p.number === poId), "Purchase order");
          if (po.status !== "draft") throw new ActionError(`${po.number} is already ${po.status}`);
          const updated = { ...po, status: "sent" as const };
          set((s) => ({ purchaseOrders: s.purchaseOrders.map((p) => (p.id === po.id ? updated : p)) }));
          log(actor, `Sent ${po.number} to supplier`, "/inventory");
          return updated;
        },
        receivePurchaseOrder: (poId, actor = "user") => {
          const po = must(get().purchaseOrders.find((p) => p.id === poId || p.number === poId), "Purchase order");
          if (po.status === "received") throw new ActionError(`${po.number} was already received`);
          const updated = { ...po, status: "received" as const };
          set((s) => ({
            purchaseOrders: s.purchaseOrders.map((p) => (p.id === po.id ? updated : p)),
            ingredients: s.ingredients.map((i) => {
              const line = po.lines.find((l) => l.ingredientId === i.id);
              return line ? { ...i, stock: round(i.stock + line.qty) } : i;
            }),
          }));
          log(actor, `Received ${po.number}, stock updated`, "/inventory");
          return updated;
        },
        logWaste: (raw, actor = "user") => {
          const input = S.wasteSchema.parse(raw);
          const ing = must(get().ingredients.find((i) => i.id === input.ingredientId), "Ingredient");
          const entry: WasteEntry = { id: uid("w"), ...input, date: new Date().toISOString() };
          set((s) => ({
            waste: [entry, ...s.waste],
            ingredients: s.ingredients.map((i) => (i.id === ing.id ? { ...i, stock: Math.max(0, round(i.stock - input.qty)) } : i)),
          }));
          log(actor, `Logged ${input.qty} ${ing.unit} ${ing.name} as ${input.reason.toLowerCase()}`, "/inventory");
          return entry;
        },
        adjustStock: (raw, actor = "user") => {
          const input = S.stockAdjustSchema.parse(raw);
          const ing = must(get().ingredients.find((i) => i.id === input.ingredientId), "Ingredient");
          const updated = { ...ing, stock: input.stock };
          set((s) => ({ ingredients: s.ingredients.map((i) => (i.id === ing.id ? updated : i)) }));
          log(actor, `Counted ${ing.name}: ${input.stock} ${ing.unit}`, "/inventory");
          return updated;
        },

        addMenuItem: (raw, actor = "user") => {
          const input = S.menuItemSchema.parse(raw);
          must(seed.BRANDS.find((b) => b.id === input.brandId), "Brand");
          const item: MenuItem = { id: uid("m"), recipe: [], ...input };
          set((s) => ({ menu: [...s.menu, item] }));
          log(actor, `Added ${item.name} to the menu`, "/menu");
          return item;
        },
        setPrice: (raw, actor = "user") => {
          const input = S.priceChangeSchema.parse(raw);
          const item = must(get().menu.find((m) => m.id === input.itemId), "Menu item");
          const updated = { ...item, price: input.price };
          set((s) => ({ menu: s.menu.map((m) => (m.id === item.id ? updated : m)) }));
          log(actor, `Changed ${item.name} price from ${item.price} to ${input.price}`, "/menu");
          return updated;
        },
        setAvailability: (itemId, available, actor = "user") => {
          const item = must(get().menu.find((m) => m.id === itemId), "Menu item");
          const updated = { ...item, available };
          set((s) => ({ menu: s.menu.map((m) => (m.id === item.id ? updated : m)) }));
          log(actor, `${available ? "Restored" : "Marked sold out"}: ${item.name}`, "/menu");
          return updated;
        },

        createManualOrder: (raw, actor = "user") => {
          const input = S.manualOrderSchema.parse(raw);
          const { menu, orders, customers, coupons, settings } = get();
          const lines = input.lines.map((l) => {
            const it = must(menu.find((m) => m.id === l.itemId), `Menu item ${l.itemId}`);
            if (it.brandId !== input.brandId) throw new ActionError(`${it.name} is not on this brand's menu`);
            if (!it.available) throw new ActionError(`${it.name} is sold out`);
            return { itemId: it.id, qty: l.qty, price: it.price };
          });
          const subtotal = lines.reduce((s, l) => s + l.qty * l.price, 0);
          let discount = 0;
          if (input.couponCode) {
            const cp = coupons.find((c) => c.code === input.couponCode!.toUpperCase());
            if (!cp || !cp.active) throw new ActionError(`Coupon ${input.couponCode} is not active`);
            if (subtotal < cp.minOrder) throw new ActionError(`Coupon needs a minimum order of ${cp.minOrder}`);
            discount = round((subtotal * cp.discountPct) / 100);
          }
          const tax = round(((subtotal - discount) * settings.taxPct) / 100);
          let customer = customers.find((c) => c.name.toLowerCase() === input.customerName.toLowerCase());
          if (!customer) {
            customer = { id: uid("c"), name: input.customerName, phone: input.phone ?? "", area: "Walk-in", orders: 0, ltv: 0, lastOrderAt: new Date().toISOString(), tags: ["New"], notes: [] };
          }
          const total = round(subtotal - discount + tax);
          const order: Order = {
            id: uid("o"),
            number: nextNumber("#", orders.map((o) => o.number), 4100),
            brandId: input.brandId,
            channel: input.channel ?? "direct",
            lines,
            subtotal,
            discount,
            tax,
            total,
            status: "new",
            createdAt: new Date().toISOString(),
            customerId: customer.id,
            couponCode: input.couponCode?.toUpperCase(),
            note: input.note,
          };
          const c2 = { ...customer, orders: customer.orders + 1, ltv: round(customer.ltv + total), lastOrderAt: order.createdAt };
          set((s) => ({
            orders: [...s.orders, order],
            customers: s.customers.some((c) => c.id === c2.id) ? s.customers.map((c) => (c.id === c2.id ? c2 : c)) : [c2, ...s.customers],
          }));
          log(actor, `Created order ${order.number} for ${customer.name}`, "/orders");
          return order;
        },
        setOrderStatus: (orderId, status, actor = "user") => {
          const o = must(get().orders.find((x) => x.id === orderId || x.number === orderId || x.number === `#${orderId}`), "Order");
          const updated = { ...o, status };
          set((s) => ({ orders: s.orders.map((x) => (x.id === o.id ? updated : x)) }));
          log(actor, `Order ${o.number} moved to ${status}`, "/orders");
          return updated;
        },
        refundOrder: (orderId, actor = "user") => {
          const o = must(get().orders.find((x) => x.id === orderId || x.number === orderId || x.number === `#${orderId}`), "Order");
          if (o.refunded) throw new ActionError(`${o.number} was already refunded`);
          const updated = { ...o, refunded: true, status: "cancelled" as const };
          set((s) => ({ orders: s.orders.map((x) => (x.id === o.id ? updated : x)) }));
          log(actor, `Refunded order ${o.number} (${o.total})`, "/orders");
          return updated;
        },

        createInvoice: (raw, actor = "user") => {
          const input = S.invoiceSchema.parse(raw);
          const inv: Invoice = {
            id: uid("inv"),
            number: nextNumber("INV-", get().invoices.map((i) => i.number), 2000),
            client: input.client,
            email: input.email,
            lines: input.lines,
            taxPct: input.taxPct,
            status: "sent",
            issuedAt: new Date().toISOString(),
            dueAt: days(input.dueInDays),
          };
          set((s) => ({ invoices: [inv, ...s.invoices] }));
          log(actor, `Issued ${inv.number} to ${inv.client}`, "/billing");
          return inv;
        },
        markInvoicePaid: (invoiceId, actor = "user") => {
          const inv = must(get().invoices.find((i) => i.id === invoiceId || i.number === invoiceId), "Invoice");
          const updated = { ...inv, status: "paid" as const };
          set((s) => ({ invoices: s.invoices.map((i) => (i.id === inv.id ? updated : i)) }));
          log(actor, `Marked ${inv.number} as paid`, "/billing");
          return updated;
        },
        setPayoutStatus: (payoutId, status, note, actor = "user") => {
          const p = must(get().payouts.find((x) => x.id === payoutId), "Payout");
          const updated = { ...p, status, note: note ?? p.note };
          set((s) => ({ payouts: s.payouts.map((x) => (x.id === p.id ? updated : x)) }));
          log(actor, `Payout ${p.channel} ${p.periodEnd.slice(5, 10)} marked ${status}`, "/billing");
          return updated;
        },

        addExpense: (raw, actor = "user") => {
          const input = S.expenseSchema.parse(raw);
          const e: Expense = {
            id: uid("e"),
            category: input.category,
            amount: input.amount,
            vendor: input.vendor,
            note: input.note,
            date: input.date ? new Date(`${input.date}T10:00:00`).toISOString() : new Date().toISOString(),
          };
          set((s) => ({ expenses: [e, ...s.expenses].sort((a, b) => b.date.localeCompare(a.date)) }));
          log(actor, `Recorded ${e.category.toLowerCase()} expense of ${e.amount} (${e.vendor})`, "/finance");
          return e;
        },
        setBudget: (raw, actor = "user") => {
          const input = S.budgetSchema.parse(raw);
          set((s) => ({ budgets: s.budgets.map((b) => (b.category === input.category ? input : b)) }));
          log(actor, `Set ${input.category} budget to ${input.monthly}/month`, "/finance");
          return input;
        },

        createCampaign: (raw, actor = "user") => {
          const input = S.campaignSchema.parse(raw);
          must(seed.BRANDS.find((b) => b.id === input.brandId), "Brand");
          const c: Campaign = {
            id: uid("cmp"),
            name: input.name,
            brandId: input.brandId,
            channel: input.channel,
            budget: input.budget,
            spent: 0,
            status: input.startInDays === 0 ? "live" : "scheduled",
            startAt: days(input.startInDays),
            endAt: days(input.startInDays + input.durationDays),
            impressions: 0,
            orders: 0,
            couponCode: input.couponCode?.toUpperCase(),
          };
          set((s) => ({ campaigns: [c, ...s.campaigns] }));
          log(actor, `${c.status === "live" ? "Launched" : "Scheduled"} campaign "${c.name}"`, "/marketing");
          return c;
        },
        setCampaignStatus: (campaignId, status, actor = "user") => {
          const c = must(get().campaigns.find((x) => x.id === campaignId), "Campaign");
          const updated = { ...c, status };
          set((s) => ({ campaigns: s.campaigns.map((x) => (x.id === c.id ? updated : x)) }));
          log(actor, `Campaign "${c.name}" is now ${status}`, "/marketing");
          return updated;
        },
        createCoupon: (raw, actor = "user") => {
          const input = S.couponSchema.parse(raw);
          if (get().coupons.some((c) => c.code === input.code)) throw new ActionError(`Coupon ${input.code} already exists`);
          const c: Coupon = { id: uid("cp"), code: input.code, discountPct: input.discountPct, minOrder: input.minOrder, brandId: input.brandId, validTo: days(input.validDays), uses: 0, active: true };
          set((s) => ({ coupons: [c, ...s.coupons] }));
          log(actor, `Created coupon ${c.code} (${c.discountPct}% off)`, "/marketing");
          return c;
        },
        toggleCoupon: (couponId, active, actor = "user") => {
          const c = must(get().coupons.find((x) => x.id === couponId || x.code === couponId), "Coupon");
          const updated = { ...c, active };
          set((s) => ({ coupons: s.coupons.map((x) => (x.id === c.id ? updated : x)) }));
          log(actor, `Coupon ${c.code} ${active ? "activated" : "paused"}`, "/marketing");
          return updated;
        },
        replyToReview: (raw, actor = "user") => {
          const input = S.reviewReplySchema.parse(raw);
          const r = must(get().reviews.find((x) => x.id === input.reviewId), "Review");
          const updated = { ...r, reply: input.reply };
          set((s) => ({ reviews: s.reviews.map((x) => (x.id === r.id ? updated : x)) }));
          log(actor, `Replied to ${r.customerName}'s ${r.rating}-star review`, "/marketing");
          return updated;
        },

        tagReview: (reviewId, topic, urgency) =>
          set((s) => ({ reviews: s.reviews.map((r) => (r.id === reviewId ? { ...r, topic, urgency } : r)) })),

        addShift: (raw, actor = "user") => {
          const input = S.shiftSchema.parse(raw);
          const st = must(get().staff.find((x) => x.id === input.staffId), "Staff member");
          if (input.end <= input.start) throw new ActionError("Shift must end after it starts");
          const sh: Shift = { id: uid("sh"), ...input };
          set((s) => ({ shifts: [...s.shifts, sh] }));
          log(actor, `Scheduled ${st.name} on ${input.date}, ${input.start} to ${input.end}`, "/staff");
          return sh;
        },
        removeShift: (shiftId, actor = "user") => {
          must(get().shifts.find((x) => x.id === shiftId), "Shift");
          set((s) => ({ shifts: s.shifts.filter((x) => x.id !== shiftId) }));
          log(actor, `Removed a shift`, "/staff");
        },
        annotateCustomer: (raw, actor = "user") => {
          const input = S.customerNoteSchema.parse(raw);
          const c = must(get().customers.find((x) => x.id === input.customerId), "Customer");
          const updated = {
            ...c,
            notes: input.note ? [input.note, ...c.notes] : c.notes,
            tags: input.tag && !c.tags.includes(input.tag) ? [...c.tags, input.tag] : c.tags,
          };
          set((s) => ({ customers: s.customers.map((x) => (x.id === c.id ? updated : x)) }));
          log(actor, `Updated customer ${c.name}`, "/customers");
          return updated;
        },
      };
    },
    {
      name: "kitchen-os-v1",
      // Saved settings from older versions lack newer fields; fill them from the defaults.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<KitchenData>;
        return { ...current, ...p, settings: { ...DEFAULT_SETTINGS, ...(p.settings ?? {}) } };
      },
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { hydrated, ...rest } = s;
        return Object.fromEntries(Object.entries(rest).filter(([, v]) => typeof v !== "function")) as unknown as KitchenData;
      },
    },
  ),
);

export const getKitchen = () => useKitchen.getState();

/** Mark hydrated once localStorage has been read (sync storage hydrates during create). */
if (typeof window !== "undefined") {
  const done = () => useKitchen.setState({ hydrated: true });
  if (useKitchen.persist.hasHydrated()) queueMicrotask(done);
  else useKitchen.persist.onFinishHydration(done);
}
