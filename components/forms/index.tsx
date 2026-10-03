"use client";

import { Lightning, Plus, Trash } from "@phosphor-icons/react";
import { Button, Field, IconButton, Input, Select, Textarea } from "@/components/ui";
import { useExpenseCategorySuggestion } from "@/lib/agent/jev-features";
import { fmtMoney } from "@/lib/analytics";
import { BRANDS } from "@/lib/data/seed";
import * as S from "@/lib/schemas";
import { getKitchen, useKitchen } from "@/lib/store";
import type { Coupon, Invoice, MenuItem, Order, PurchaseOrder } from "@/lib/types";
import { useUI } from "@/lib/ui-store";
import { FormSheet, type FormApi } from "./FormSheet";

const today = () => new Date().toISOString().slice(0, 10);
const tomorrow = () => new Date(Date.now() + 86400000).toISOString().slice(0, 10);

function BrandSelect({ api, name = "brandId", allowAll = false }: { api: FormApi; name?: string; allowAll?: boolean }) {
  return (
    <Field label="Brand" htmlFor={name} error={api.err(name)}>
      <Select id={name} data-label="brand" {...api.form.register(name)}>
        {allowAll && <option value="all">All brands</option>}
        {BRANDS.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </Select>
    </Field>
  );
}

// ---------------- Inventory ----------------

export function PurchaseOrderForm() {
  const suppliers = useKitchen((s) => s.suppliers);
  const ingredients = useKitchen((s) => s.ingredients);
  return (
    <FormSheet
      id="purchase-order"
      title="New purchase order"
      description="Saved as a draft. Send it to the supplier from the list when ready."
      schema={S.purchaseOrderSchema}
      defaults={{ supplierId: suppliers[0].id, lines: [{ ingredientId: ingredients[0].id, qty: 10 }], expectedInDays: 1, notes: "" }}
      arrayName="lines"
      blankRow={{ ingredientId: "", qty: "" }}
      submitLabel="Save draft"
      action={(v, actor) => getKitchen().createPurchaseOrder(v as S.PurchaseOrderInput, actor)}
      success={(r) => `Drafted ${(r as PurchaseOrder).number}`}
      width={560}
    >
      {(api) => {
        const supplierId = api.form.watch("supplierId") as string;
        const supplier = suppliers.find((s) => s.id === supplierId);
        const lines = (api.form.watch("lines") as { ingredientId: string; qty: number }[]) ?? [];
        const total = lines.reduce((s, l) => {
          const ing = ingredients.find((i) => i.id === l.ingredientId);
          return s + (ing ? ing.costPerUnit * (supplier?.priceFactor ?? 1) * Number(l.qty || 0) : 0);
        }, 0);
        return (
          <>
            <Field label="Supplier" htmlFor="supplierId" error={api.err("supplierId")} hint={supplier ? `Supplies ${supplier.categories.join(", ").toLowerCase()}. ${supplier.leadDays}-day lead time, price factor ${supplier.priceFactor}.` : undefined}>
              <Select id="supplierId" data-label="supplier" {...api.form.register("supplierId")}>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1.5 text-[13px] font-medium text-ink">Items</legend>
              {api.array?.fields.map((f, i) => (
                <div key={f.key} className="grid grid-cols-[1fr_96px_32px] items-start gap-2">
                  <div>
                    <label className="sr-only" htmlFor={`lines.${i}.ingredientId`}>
                      Ingredient {i + 1}
                    </label>
                    <Select id={`lines.${i}.ingredientId`} data-label="ingredient" {...api.form.register(`lines.${i}.ingredientId`)}>
                      <option value="">Choose ingredient</option>
                      {ingredients.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name} ({g.stock}/{g.par} {g.unit})
                        </option>
                      ))}
                    </Select>
                    {api.err(`lines.${i}.ingredientId`) && <p className="mt-1 text-xs text-bad">Choose an ingredient</p>}
                  </div>
                  <div>
                    <label className="sr-only" htmlFor={`lines.${i}.qty`}>
                      Quantity {i + 1}
                    </label>
                    <Input id={`lines.${i}.qty`} data-label="quantity" inputMode="decimal" placeholder="Qty" {...api.form.register(`lines.${i}.qty`)} aria-invalid={!!api.err(`lines.${i}.qty`)} />
                  </div>
                  <IconButton label={`Remove line ${i + 1}`} onClick={() => api.array?.remove(i)} disabled={(api.array?.fields.length ?? 0) <= 1}>
                    <Trash size={16} />
                  </IconButton>
                </div>
              ))}
              <div>
                <Button size="sm" variant="ghost" onClick={() => api.array?.append({ ingredientId: "", qty: "" })}>
                  <Plus size={14} /> Add item
                </Button>
              </div>
            </fieldset>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Delivery in (days)" htmlFor="expectedInDays" error={api.err("expectedInDays")}>
                <Input id="expectedInDays" data-label="delivery days" inputMode="numeric" {...api.form.register("expectedInDays")} />
              </Field>
              <div className="flex flex-col justify-end pb-2 text-right">
                <span className="text-xs text-ink-3">Estimated total</span>
                <span className="num font-display text-lg font-semibold text-ink">{fmtMoney(total)}</span>
              </div>
            </div>
            <Field label="Note to supplier" htmlFor="notes" error={api.err("notes")}>
              <Textarea id="notes" data-label="note" {...api.form.register("notes")} />
            </Field>
          </>
        );
      }}
    </FormSheet>
  );
}

export function WasteForm() {
  const ingredients = useKitchen((s) => s.ingredients);
  return (
    <FormSheet
      id="waste"
      title="Log waste"
      description="Wasted quantity is deducted from stock."
      schema={S.wasteSchema}
      defaults={{ ingredientId: ingredients[0].id, qty: "", reason: "Spoiled" }}
      submitLabel="Log waste"
      action={(v, actor) => getKitchen().logWaste(v as S.WasteInput, actor)}
      success={() => "Waste logged"}
    >
      {(api) => (
        <>
          <Field label="Ingredient" htmlFor="ingredientId" error={api.err("ingredientId")}>
            <Select id="ingredientId" data-label="ingredient" {...api.form.register("ingredientId")}>
              {ingredients.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.unit})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Quantity" htmlFor="qty" error={api.err("qty")}>
            <Input id="qty" data-label="quantity" inputMode="decimal" {...api.form.register("qty")} aria-invalid={!!api.err("qty")} />
          </Field>
          <Field label="Reason" htmlFor="reason" error={api.err("reason")}>
            <Select id="reason" data-label="reason" {...api.form.register("reason")}>
              {["Expired", "Spoiled", "Overproduced", "Dropped", "Returned"].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </Select>
          </Field>
        </>
      )}
    </FormSheet>
  );
}

// ---------------- Menu ----------------

export function MenuItemForm() {
  return (
    <FormSheet
      id="menu-item"
      title="Add menu item"
      description="It goes live on all channels for the brand. Add the recipe later to track food cost."
      schema={S.menuItemSchema}
      defaults={{ brandId: BRANDS[0].id, name: "", category: "", price: "", prepMins: 10, available: true }}
      submitLabel="Add item"
      action={(v, actor) => getKitchen().addMenuItem(v as S.MenuItemInput, actor)}
      success={(r) => `Added ${(r as MenuItem).name}`}
    >
      {(api) => (
        <>
          <BrandSelect api={api} />
          <Field label="Item name" htmlFor="name" error={api.err("name")}>
            <Input id="name" data-label="name" {...api.form.register("name")} aria-invalid={!!api.err("name")} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category" htmlFor="category" error={api.err("category")}>
              <Input id="category" data-label="category" placeholder="e.g. Curries" {...api.form.register("category")} />
            </Field>
            <Field label="Price" htmlFor="price" error={api.err("price")}>
              <Input id="price" data-label="price" inputMode="decimal" {...api.form.register("price")} aria-invalid={!!api.err("price")} />
            </Field>
          </div>
          <Field label="Prep time (minutes)" htmlFor="prepMins" error={api.err("prepMins")}>
            <Input id="prepMins" data-label="prep time" inputMode="numeric" {...api.form.register("prepMins")} />
          </Field>
        </>
      )}
    </FormSheet>
  );
}

export function PriceForm() {
  const initial = useUI((s) => (s.form?.id === "price" ? s.form.initial : undefined));
  const item = useKitchen((s) => s.menu.find((m) => m.id === initial?.itemId));
  return (
    <FormSheet
      id="price"
      title={item ? `Change price: ${item.name}` : "Change price"}
      description={item ? `Currently ${fmtMoney(item.price)}. Applies to every channel.` : undefined}
      schema={S.priceChangeSchema}
      defaults={{ itemId: "", price: item?.price ?? "" }}
      submitLabel="Update price"
      action={(v, actor) => getKitchen().setPrice(v as S.PriceChangeInput, actor)}
      success={(r) => `${(r as MenuItem).name} is now ${fmtMoney((r as MenuItem).price)}`}
      width={420}
    >
      {(api) => (
        <>
          <input type="hidden" {...api.form.register("itemId")} />
          <Field label="New price" htmlFor="price" error={api.err("price")}>
            <Input id="price" data-label="price" inputMode="decimal" {...api.form.register("price")} aria-invalid={!!api.err("price")} />
          </Field>
        </>
      )}
    </FormSheet>
  );
}

// ---------------- Orders ----------------

export function ManualOrderForm() {
  const menu = useKitchen((s) => s.menu);
  return (
    <FormSheet
      id="manual-order"
      title="New phone order"
      description="Goes straight to the kitchen display as a new ticket."
      schema={S.manualOrderSchema}
      defaults={{ brandId: BRANDS[0].id, channel: "direct", customerName: "", phone: "", lines: [{ itemId: "", qty: 1 }], couponCode: "", note: "" }}
      arrayName="lines"
      blankRow={{ itemId: "", qty: 1 }}
      submitLabel="Send to kitchen"
      action={(v, actor) => {
        const input = { ...v, couponCode: (v.couponCode as string) || undefined } as S.ManualOrderInput;
        return getKitchen().createManualOrder(input, actor);
      }}
      success={(r) => `Order ${(r as Order).number} sent to the kitchen`}
      width={560}
    >
      {(api) => {
        const brandId = api.form.watch("brandId") as string;
        const items = menu.filter((m) => m.brandId === brandId);
        return (
          <>
            <div className="grid grid-cols-2 gap-3">
              <BrandSelect api={api} />
              <Field label="Channel" htmlFor="channel" error={api.err("channel")}>
                <Select id="channel" data-label="channel" {...api.form.register("channel")}>
                  <option value="direct">Direct</option>
                  <option value="dashbite">DashBite</option>
                  <option value="foodrun">FoodRun</option>
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Customer name" htmlFor="customerName" error={api.err("customerName")}>
                <Input id="customerName" data-label="customer" {...api.form.register("customerName")} aria-invalid={!!api.err("customerName")} />
              </Field>
              <Field label="Phone" htmlFor="phone" error={api.err("phone")}>
                <Input id="phone" data-label="phone" inputMode="tel" {...api.form.register("phone")} />
              </Field>
            </div>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1.5 text-[13px] font-medium text-ink">Items</legend>
              {api.array?.fields.map((f, i) => (
                <div key={f.key} className="grid grid-cols-[1fr_80px_32px] gap-2">
                  <Select aria-label={`Item ${i + 1}`} data-label="item" {...api.form.register(`lines.${i}.itemId`)}>
                    <option value="">Choose item</option>
                    {items.map((m) => (
                      <option key={m.id} value={m.id} disabled={!m.available}>
                        {m.name} ({fmtMoney(m.price)})
                        {m.available ? "" : " (sold out)"}
                      </option>
                    ))}
                  </Select>
                  <Input aria-label={`Quantity ${i + 1}`} data-label="quantity" inputMode="numeric" {...api.form.register(`lines.${i}.qty`)} />
                  <IconButton label={`Remove item ${i + 1}`} onClick={() => api.array?.remove(i)} disabled={(api.array?.fields.length ?? 0) <= 1}>
                    <Trash size={16} />
                  </IconButton>
                </div>
              ))}
              {api.err("lines") && <p className="text-xs text-bad">{api.err("lines")}</p>}
              <div>
                <Button size="sm" variant="ghost" onClick={() => api.array?.append({ itemId: "", qty: 1 })}>
                  <Plus size={14} /> Add item
                </Button>
              </div>
            </fieldset>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Coupon" htmlFor="couponCode" error={api.err("couponCode")}>
                <Input id="couponCode" data-label="coupon" className="font-mono uppercase" {...api.form.register("couponCode")} />
              </Field>
              <Field label="Kitchen note" htmlFor="note" error={api.err("note")}>
                <Input id="note" data-label="note" placeholder="Less spicy" {...api.form.register("note")} />
              </Field>
            </div>
          </>
        );
      }}
    </FormSheet>
  );
}

// ---------------- Billing ----------------

export function InvoiceForm() {
  return (
    <FormSheet
      id="invoice"
      title="New invoice"
      description="Sent to the client's email right away."
      schema={S.invoiceSchema}
      defaults={{ client: "", email: "", lines: [{ description: "", qty: 1, rate: "" }], taxPct: 5, dueInDays: 15 }}
      arrayName="lines"
      blankRow={{ description: "", qty: 1, rate: "" }}
      submitLabel="Send invoice"
      action={(v, actor) => getKitchen().createInvoice(v as S.InvoiceInput, actor)}
      success={(r) => `Sent ${(r as Invoice).number} to ${(r as Invoice).client}`}
      width={600}
    >
      {(api) => {
        const lines = (api.form.watch("lines") as { qty: number; rate: number }[]) ?? [];
        const sub = lines.reduce((s, l) => s + Number(l.qty || 0) * Number(l.rate || 0), 0);
        const tax = (sub * Number(api.form.watch("taxPct") || 0)) / 100;
        return (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Client" htmlFor="client" error={api.err("client")}>
                <Input id="client" data-label="client" {...api.form.register("client")} aria-invalid={!!api.err("client")} />
              </Field>
              <Field label="Billing email" htmlFor="email" error={api.err("email")}>
                <Input id="email" data-label="email" type="email" {...api.form.register("email")} aria-invalid={!!api.err("email")} />
              </Field>
            </div>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1.5 text-[13px] font-medium text-ink">Line items</legend>
              {api.array?.fields.map((f, i) => (
                <div key={f.key} className="grid grid-cols-[1fr_64px_96px_32px] gap-2">
                  <Input aria-label={`Description ${i + 1}`} data-label="description" placeholder="Description" {...api.form.register(`lines.${i}.description`)} />
                  <Input aria-label={`Quantity ${i + 1}`} data-label="quantity" inputMode="decimal" {...api.form.register(`lines.${i}.qty`)} />
                  <Input aria-label={`Rate ${i + 1}`} data-label="rate" inputMode="decimal" placeholder="Rate" {...api.form.register(`lines.${i}.rate`)} />
                  <IconButton label={`Remove line ${i + 1}`} onClick={() => api.array?.remove(i)} disabled={(api.array?.fields.length ?? 0) <= 1}>
                    <Trash size={16} />
                  </IconButton>
                </div>
              ))}
              <div>
                <Button size="sm" variant="ghost" onClick={() => api.array?.append({ description: "", qty: 1, rate: "" })}>
                  <Plus size={14} /> Add line
                </Button>
              </div>
            </fieldset>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Tax %" htmlFor="taxPct" error={api.err("taxPct")}>
                <Input id="taxPct" data-label="tax" inputMode="decimal" {...api.form.register("taxPct")} />
              </Field>
              <Field label="Due in (days)" htmlFor="dueInDays" error={api.err("dueInDays")}>
                <Input id="dueInDays" data-label="due days" inputMode="numeric" {...api.form.register("dueInDays")} />
              </Field>
              <div className="flex flex-col justify-end pb-2 text-right">
                <span className="text-xs text-ink-3">Total</span>
                <span className="num font-display text-lg font-semibold text-ink">{fmtMoney(sub + tax)}</span>
              </div>
            </div>
          </>
        );
      }}
    </FormSheet>
  );
}

// ---------------- Finance ----------------

/** Jev reads the vendor and note as you type and suggests a category. */
function CategorySuggestion({ api }: { api: FormApi }) {
  const vendor = (api.form.watch("vendor") as string) ?? "";
  const note = (api.form.watch("note") as string) ?? "";
  const current = api.form.watch("category") as string;
  const s = useExpenseCategorySuggestion(vendor, note);
  if (!s || s.category === current) return null;
  return (
    <button
      type="button"
      onClick={() => api.form.setValue("category", s.category, { shouldDirty: true })}
      className="inline-flex w-fit cursor-pointer items-center gap-1 text-xs text-heat hover:underline"
    >
      <Lightning size={11} weight="fill" />
      Jev suggests {s.category}. Use it
    </button>
  );
}

export function ExpenseForm() {
  return (
    <FormSheet
      id="expense"
      title="Record expense"
      schema={S.expenseSchema}
      defaults={{ category: "Other", amount: "", vendor: "", date: today(), note: "" }}
      submitLabel="Record expense"
      action={(v, actor) => getKitchen().addExpense(v as S.ExpenseInput, actor)}
      success={() => "Expense recorded"}
    >
      {(api) => (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category" htmlFor="category" error={api.err("category")}>
              <Select id="category" data-label="category" {...api.form.register("category")}>
                {["Rent", "Utilities", "Salaries", "Marketing", "Packaging", "Maintenance", "Software", "Other"].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
              <CategorySuggestion api={api} />
            </Field>
            <Field label="Amount" htmlFor="amount" error={api.err("amount")}>
              <Input id="amount" data-label="amount" inputMode="decimal" {...api.form.register("amount")} aria-invalid={!!api.err("amount")} />
            </Field>
          </div>
          <Field label="Paid to" htmlFor="vendor" error={api.err("vendor")}>
            <Input id="vendor" data-label="vendor" {...api.form.register("vendor")} aria-invalid={!!api.err("vendor")} />
          </Field>
          <Field label="Date" htmlFor="date" error={api.err("date")}>
            <Input id="date" data-label="date" type="date" {...api.form.register("date")} />
          </Field>
          <Field label="Note" htmlFor="note" error={api.err("note")}>
            <Textarea id="note" data-label="note" {...api.form.register("note")} />
          </Field>
        </>
      )}
    </FormSheet>
  );
}

// ---------------- Marketing ----------------

export function CampaignForm() {
  const allCoupons = useKitchen((s) => s.coupons);
  const coupons = allCoupons.filter((c) => c.active);
  return (
    <FormSheet
      id="campaign"
      title="New campaign"
      description="Starts today when the start is 0 days away; otherwise it's scheduled."
      schema={S.campaignSchema}
      defaults={{ name: "", brandId: BRANDS[0].id, channel: "dashbite", budget: "", startInDays: 0, durationDays: 14, couponCode: "" }}
      submitLabel="Create campaign"
      action={(v, actor) => getKitchen().createCampaign({ ...v, couponCode: (v.couponCode as string) || undefined } as S.CampaignInput, actor)}
      success={(r) => `Campaign "${(r as { name: string }).name}" created`}
    >
      {(api) => (
        <>
          <Field label="Campaign name" htmlFor="name" error={api.err("name")}>
            <Input id="name" data-label="name" {...api.form.register("name")} aria-invalid={!!api.err("name")} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <BrandSelect api={api} />
            <Field label="Channel" htmlFor="channel" error={api.err("channel")}>
              <Select id="channel" data-label="channel" {...api.form.register("channel")}>
                <option value="dashbite">DashBite ads</option>
                <option value="foodrun">FoodRun ads</option>
                <option value="instagram">Instagram</option>
                <option value="sms">SMS</option>
                <option value="direct">Direct (website)</option>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Budget" htmlFor="budget" error={api.err("budget")}>
              <Input id="budget" data-label="budget" inputMode="decimal" {...api.form.register("budget")} aria-invalid={!!api.err("budget")} />
            </Field>
            <Field label="Starts in (days)" htmlFor="startInDays" error={api.err("startInDays")}>
              <Input id="startInDays" data-label="start" inputMode="numeric" {...api.form.register("startInDays")} />
            </Field>
            <Field label="Runs for (days)" htmlFor="durationDays" error={api.err("durationDays")}>
              <Input id="durationDays" data-label="duration" inputMode="numeric" {...api.form.register("durationDays")} />
            </Field>
          </div>
          <Field label="Attach coupon" htmlFor="couponCode" error={api.err("couponCode")}>
            <Select id="couponCode" data-label="coupon" {...api.form.register("couponCode")}>
              <option value="">None</option>
              {coupons.map((c) => (
                <option key={c.id} value={c.code}>
                  {c.code} ({c.discountPct}% off)
                </option>
              ))}
            </Select>
          </Field>
        </>
      )}
    </FormSheet>
  );
}

export function CouponForm() {
  return (
    <FormSheet
      id="coupon"
      title="New coupon"
      schema={S.couponSchema}
      defaults={{ code: "", discountPct: "", minOrder: 0, brandId: "all", validDays: 30 }}
      submitLabel="Create coupon"
      action={(v, actor) => getKitchen().createCoupon(v as S.CouponInput, actor)}
      success={(r) => `Coupon ${(r as Coupon).code} is live`}
    >
      {(api) => (
        <>
          <Field label="Code" htmlFor="code" error={api.err("code")} hint="Capital letters and numbers">
            <Input id="code" data-label="code" className="font-mono uppercase" {...api.form.register("code", { setValueAs: (v: string) => v?.toUpperCase?.() ?? v })} aria-invalid={!!api.err("code")} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Discount %" htmlFor="discountPct" error={api.err("discountPct")}>
              <Input id="discountPct" data-label="discount" inputMode="decimal" {...api.form.register("discountPct")} aria-invalid={!!api.err("discountPct")} />
            </Field>
            <Field label="Minimum order" htmlFor="minOrder" error={api.err("minOrder")}>
              <Input id="minOrder" data-label="minimum order" inputMode="decimal" {...api.form.register("minOrder")} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <BrandSelect api={api} allowAll />
            <Field label="Valid for (days)" htmlFor="validDays" error={api.err("validDays")}>
              <Input id="validDays" data-label="validity" inputMode="numeric" {...api.form.register("validDays")} />
            </Field>
          </div>
        </>
      )}
    </FormSheet>
  );
}

export function ReviewReplyForm() {
  const initial = useUI((s) => (s.form?.id === "review-reply" ? s.form.initial : undefined));
  const review = useKitchen((s) => s.reviews.find((r) => r.id === initial?.reviewId));
  return (
    <FormSheet
      id="review-reply"
      title="Reply to review"
      description="Replies are public on the channel."
      schema={S.reviewReplySchema}
      defaults={{ reviewId: "", reply: review?.reply ?? "" }}
      submitLabel="Post reply"
      action={(v, actor) => getKitchen().replyToReview(v as S.ReviewReplyInput, actor)}
      success={() => "Reply posted"}
    >
      {(api) => (
        <>
          {review && (
            <blockquote className="rounded-[10px] bg-paper-2 p-3 text-sm text-ink-2 ring-1 ring-inset ring-rule">
              <div className="mb-1 text-xs text-ink-3">
                {review.customerName}, {review.rating} of 5
              </div>
              {review.text}
            </blockquote>
          )}
          <input type="hidden" {...api.form.register("reviewId")} />
          <Field label="Your reply" htmlFor="reply" error={api.err("reply")}>
            <Textarea id="reply" data-label="reply" rows={5} {...api.form.register("reply")} aria-invalid={!!api.err("reply")} />
          </Field>
        </>
      )}
    </FormSheet>
  );
}

// ---------------- Staff ----------------

export function ShiftForm() {
  const staff = useKitchen((s) => s.staff);
  return (
    <FormSheet
      id="shift"
      title="Add shift"
      schema={S.shiftSchema}
      defaults={{ staffId: staff[0].id, date: tomorrow(), start: "10:00", end: "18:00" }}
      submitLabel="Add shift"
      action={(v, actor) => getKitchen().addShift(v as S.ShiftInput, actor)}
      success={() => "Shift added"}
      width={440}
    >
      {(api) => (
        <>
          <Field label="Team member" htmlFor="staffId" error={api.err("staffId")}>
            <Select id="staffId" data-label="team member" {...api.form.register("staffId")}>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.role})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Date" htmlFor="date" error={api.err("date")}>
            <Input id="date" data-label="date" type="date" {...api.form.register("date")} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start" htmlFor="start" error={api.err("start")}>
              <Input id="start" data-label="start" type="time" {...api.form.register("start")} />
            </Field>
            <Field label="End" htmlFor="end" error={api.err("end")}>
              <Input id="end" data-label="end" type="time" {...api.form.register("end")} />
            </Field>
          </div>
        </>
      )}
    </FormSheet>
  );
}
