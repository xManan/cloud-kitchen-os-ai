import { z } from "zod";

/**
 * One schema per user-facing action. The same schema validates the on-screen form,
 * the store action, and the agent tool's JSON schema, so a human and the agent go
 * through exactly the same rules.
 */

export const id = (what: string) => z.string().min(1).describe(`${what} id`);

export const purchaseOrderSchema = z.object({
  supplierId: id("Supplier").describe("Supplier id, e.g. s-dairyco. Use list_suppliers to find one."),
  lines: z
    .array(
      z.object({
        ingredientId: id("Ingredient"),
        qty: z.coerce.number().positive().describe("Quantity in the ingredient's unit"),
      }),
    )
    .min(1)
    .describe("Ingredients to order"),
  expectedInDays: z.coerce.number().int().min(0).max(14).default(1).describe("Days until delivery"),
  notes: z.string().max(240).optional().describe("Note for the supplier"),
});
export type PurchaseOrderInput = z.infer<typeof purchaseOrderSchema>;

export const wasteSchema = z.object({
  ingredientId: id("Ingredient"),
  qty: z.coerce.number().positive(),
  reason: z.enum(["Expired", "Spoiled", "Overproduced", "Dropped", "Returned"]),
});
export type WasteInput = z.infer<typeof wasteSchema>;

export const stockAdjustSchema = z.object({
  ingredientId: id("Ingredient"),
  stock: z.coerce.number().min(0).describe("New counted stock level"),
  reason: z.string().max(120).optional(),
});
export type StockAdjustInput = z.infer<typeof stockAdjustSchema>;

export const menuItemSchema = z.object({
  brandId: id("Brand"),
  name: z.string().min(2).max(60),
  category: z.string().min(2).max(30),
  price: z.coerce.number().positive().describe("Menu price incl. nothing else, in the kitchen currency"),
  prepMins: z.coerce.number().int().min(1).max(60).default(10),
  available: z.boolean().default(true),
});
export type MenuItemInput = z.infer<typeof menuItemSchema>;

export const priceChangeSchema = z.object({
  itemId: id("Menu item"),
  price: z.coerce.number().positive(),
});
export type PriceChangeInput = z.infer<typeof priceChangeSchema>;

export const manualOrderSchema = z.object({
  brandId: id("Brand"),
  channel: z.enum(["dashbite", "foodrun", "direct"]).default("direct"),
  customerName: z.string().min(2).max(60),
  phone: z.string().max(20).optional(),
  lines: z
    .array(z.object({ itemId: id("Menu item"), qty: z.coerce.number().int().min(1).max(20) }))
    .min(1),
  couponCode: z.string().max(20).optional(),
  note: z.string().max(200).optional(),
});
export type ManualOrderInput = z.infer<typeof manualOrderSchema>;

export const invoiceSchema = z.object({
  client: z.string().min(2).max(80),
  email: z.string().email(),
  lines: z
    .array(
      z.object({
        description: z.string().min(2).max(120),
        qty: z.coerce.number().positive(),
        rate: z.coerce.number().positive(),
      }),
    )
    .min(1),
  taxPct: z.coerce.number().min(0).max(28).default(5),
  dueInDays: z.coerce.number().int().min(0).max(90).default(15),
});
export type InvoiceInput = z.infer<typeof invoiceSchema>;

export const expenseSchema = z.object({
  category: z.enum(["Rent", "Utilities", "Salaries", "Marketing", "Packaging", "Maintenance", "Software", "Other"]),
  amount: z.coerce.number().positive(),
  vendor: z.string().min(2).max(80),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("YYYY-MM-DD, defaults to today"),
  note: z.string().max(200).optional(),
});
export type ExpenseInput = z.infer<typeof expenseSchema>;

export const budgetSchema = z.object({
  category: expenseSchema.shape.category,
  monthly: z.coerce.number().min(0),
});
export type BudgetInput = z.infer<typeof budgetSchema>;

export const campaignSchema = z.object({
  name: z.string().min(3).max(60),
  brandId: id("Brand"),
  channel: z.enum(["dashbite", "foodrun", "direct", "instagram", "sms"]),
  budget: z.coerce.number().positive(),
  startInDays: z.coerce.number().int().min(0).max(60).default(0),
  durationDays: z.coerce.number().int().min(1).max(90).default(14),
  couponCode: z.string().max(20).optional().describe("Optional existing coupon to attach"),
});
export type CampaignInput = z.infer<typeof campaignSchema>;

export const couponSchema = z.object({
  code: z
    .string()
    .min(3)
    .max(20)
    .regex(/^[A-Z0-9]+$/, "Use capital letters and numbers only"),
  discountPct: z.coerce.number().min(1).max(60),
  minOrder: z.coerce.number().min(0).default(0),
  brandId: z.string().default("all").describe("Brand id or 'all'"),
  validDays: z.coerce.number().int().min(1).max(180).default(30),
});
export type CouponInput = z.infer<typeof couponSchema>;

export const reviewReplySchema = z.object({
  reviewId: id("Review"),
  reply: z.string().min(5).max(500),
});
export type ReviewReplyInput = z.infer<typeof reviewReplySchema>;

export const shiftSchema = z.object({
  staffId: id("Staff member"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("YYYY-MM-DD"),
  start: z.string().regex(/^\d{2}:\d{2}$/).describe("HH:MM 24h"),
  end: z.string().regex(/^\d{2}:\d{2}$/).describe("HH:MM 24h"),
});
export type ShiftInput = z.infer<typeof shiftSchema>;

export const customerNoteSchema = z.object({
  customerId: id("Customer"),
  note: z.string().min(2).max(200).optional(),
  tag: z.string().min(2).max(24).optional(),
});
export type CustomerNoteInput = z.infer<typeof customerNoteSchema>;
