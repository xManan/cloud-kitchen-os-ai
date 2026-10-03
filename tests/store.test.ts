import { beforeEach, describe, expect, it } from "vitest";
import { getKitchen, useKitchen } from "@/lib/store";

beforeEach(() => getKitchen().reset());

describe("kitchen store actions", () => {
  it("drafts a purchase order with supplier pricing and logs it", () => {
    const po = getKitchen().createPurchaseOrder({ supplierId: "s-metro", lines: [{ ingredientId: "i-rice", qty: 10 }], expectedInDays: 2 }, "agent");
    expect(po.status).toBe("draft");
    expect(po.lines[0].unitCost).toBeCloseTo(110 * 0.86);
    expect(po.createdBy).toBe("agent");
    expect(getKitchen().activity[0].actor).toBe("agent");
  });

  it("receiving a PO adds stock exactly once", () => {
    const before = getKitchen().ingredients.find((i) => i.id === "i-paneer")!.stock;
    const po = getKitchen().createPurchaseOrder({ supplierId: "s-dairyco", lines: [{ ingredientId: "i-paneer", qty: 20 }], expectedInDays: 1 });
    getKitchen().sendPurchaseOrder(po.id);
    getKitchen().receivePurchaseOrder(po.number);
    expect(getKitchen().ingredients.find((i) => i.id === "i-paneer")!.stock).toBeCloseTo(before + 20);
    expect(() => getKitchen().receivePurchaseOrder(po.id)).toThrow(/already received/);
  });

  it("rejects invalid input through the shared schema", () => {
    expect(() => getKitchen().createPurchaseOrder({ supplierId: "s-metro", lines: [], expectedInDays: 1 })).toThrow();
    expect(() => getKitchen().createCoupon({ code: "lower", discountPct: 10, minOrder: 0, brandId: "all", validDays: 5 })).toThrow();
  });

  it("creates a manual order with coupon, tax and a new customer", () => {
    const o = getKitchen().createManualOrder({ brandId: "b-tandoor", channel: "direct", customerName: "Test Person", lines: [{ itemId: "m-bc", qty: 2 }], couponCode: "welcome10" });
    expect(o.subtotal).toBe(738);
    expect(o.discount).toBeCloseTo(73.8);
    expect(o.total).toBeCloseTo((738 - 73.8) * 1.05);
    expect(getKitchen().customers[0].name).toBe("Test Person");
  });

  it("refuses items from another brand and sold-out items", () => {
    expect(() => getKitchen().createManualOrder({ brandId: "b-crust", channel: "direct", customerName: "Al", lines: [{ itemId: "m-bc", qty: 1 }] })).toThrow(/not on this brand/);
    getKitchen().setAvailability("m-margherita", false);
    expect(() => getKitchen().createManualOrder({ brandId: "b-crust", channel: "direct", customerName: "Al", lines: [{ itemId: "m-margherita", qty: 1 }] })).toThrow(/sold out/);
  });

  it("waste deducts stock and never goes negative", () => {
    getKitchen().logWaste({ ingredientId: "i-gochujang", qty: 999, reason: "Spoiled" });
    expect(useKitchen.getState().ingredients.find((i) => i.id === "i-gochujang")!.stock).toBe(0);
  });

  it("shifts must end after they start", () => {
    expect(() => getKitchen().addShift({ staffId: "st-1", date: "2026-10-04", start: "18:00", end: "10:00" })).toThrow(/end after/);
  });
});
