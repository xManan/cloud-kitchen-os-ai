export type ChannelId = "dashbite" | "foodrun" | "direct";

export interface Brand {
  id: string;
  name: string;
  cuisine: string;
  /** Categorical chart slot (1..3), fixed per brand so color follows the entity. */
  slot: 1 | 2 | 3;
}

export interface RecipeLine {
  ingredientId: string;
  qty: number;
}

export interface MenuItem {
  id: string;
  brandId: string;
  name: string;
  category: string;
  price: number;
  recipe: RecipeLine[];
  available: boolean;
  prepMins: number;
}

export interface Ingredient {
  id: string;
  name: string;
  unit: "kg" | "L" | "pcs";
  category: "Produce" | "Dairy" | "Protein" | "Dry goods" | "Packaging" | "Sauces";
  stock: number;
  par: number;
  costPerUnit: number;
  supplierId: string;
}

export interface Supplier {
  id: string;
  name: string;
  leadDays: number;
  rating: number;
  /** Multiplier applied to an ingredient's base cost when ordering from this supplier. */
  priceFactor: number;
  categories: Ingredient["category"][];
  phone: string;
}

export interface POLine {
  ingredientId: string;
  qty: number;
  unitCost: number;
}

export type POStatus = "draft" | "sent" | "received" | "cancelled";

export interface PurchaseOrder {
  id: string;
  number: string;
  supplierId: string;
  lines: POLine[];
  status: POStatus;
  createdAt: string;
  expectedAt: string;
  notes?: string;
  createdBy: "user" | "agent";
}

export type OrderStatus = "new" | "preparing" | "ready" | "dispatched" | "delivered" | "cancelled";

export interface OrderLine {
  itemId: string;
  qty: number;
  price: number;
}

export interface Order {
  id: string;
  number: string;
  brandId: string;
  channel: ChannelId;
  lines: OrderLine[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  status: OrderStatus;
  createdAt: string;
  customerId: string;
  couponCode?: string;
  note?: string;
  refunded?: boolean;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  area: string;
  orders: number;
  ltv: number;
  lastOrderAt: string;
  tags: string[];
  notes: string[];
}

export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue";

export interface InvoiceLine {
  description: string;
  qty: number;
  rate: number;
}

export interface Invoice {
  id: string;
  number: string;
  client: string;
  email: string;
  lines: InvoiceLine[];
  taxPct: number;
  status: InvoiceStatus;
  issuedAt: string;
  dueAt: string;
}

export type PayoutStatus = "pending" | "reconciled" | "disputed";

export interface Payout {
  id: string;
  channel: Exclude<ChannelId, "direct">;
  periodStart: string;
  periodEnd: string;
  orders: number;
  gross: number;
  commission: number;
  adjustments: number;
  net: number;
  status: PayoutStatus;
  note?: string;
}

export type ExpenseCategory =
  | "Rent"
  | "Utilities"
  | "Salaries"
  | "Marketing"
  | "Packaging"
  | "Maintenance"
  | "Software"
  | "Other";

export interface Expense {
  id: string;
  category: ExpenseCategory;
  amount: number;
  vendor: string;
  date: string;
  note?: string;
}

export type CampaignStatus = "scheduled" | "live" | "paused" | "ended";

export interface Campaign {
  id: string;
  name: string;
  channel: ChannelId | "instagram" | "sms";
  brandId: string;
  budget: number;
  spent: number;
  status: CampaignStatus;
  startAt: string;
  endAt: string;
  impressions: number;
  orders: number;
  couponCode?: string;
}

export interface Coupon {
  id: string;
  code: string;
  discountPct: number;
  minOrder: number;
  brandId: string | "all";
  validTo: string;
  uses: number;
  active: boolean;
}

export interface Review {
  id: string;
  channel: Exclude<ChannelId, "direct">;
  brandId: string;
  rating: number;
  text: string;
  customerName: string;
  createdAt: string;
  reply?: string;
}

export interface Staff {
  id: string;
  name: string;
  role: "Head chef" | "Line cook" | "Prep cook" | "Packer" | "Dispatcher" | "Manager";
  hourlyRate: number;
}

export interface Shift {
  id: string;
  staffId: string;
  date: string;
  start: string;
  end: string;
}

export interface WasteEntry {
  id: string;
  ingredientId: string;
  qty: number;
  reason: "Expired" | "Spoiled" | "Overproduced" | "Dropped" | "Returned";
  date: string;
}

export interface Budget {
  category: ExpenseCategory;
  monthly: number;
}

export interface DailyStat {
  date: string;
  brandId: string;
  channel: ChannelId;
  orders: number;
  revenue: number;
  foodCost: number;
}

export interface Settings {
  kitchenName: string;
  currency: string;
  locale: string;
  taxPct: number;
  model: string;
  agentMode: "ui" | "background";
  agentSpeed: "normal" | "fast";
  openrouterKey: string;
}

export interface ActivityEntry {
  id: string;
  at: string;
  actor: "user" | "agent";
  text: string;
  href?: string;
}
