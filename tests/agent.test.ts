import { describe, expect, it } from "vitest";
import { mockPlanner } from "@/lib/agent/mock";
import { toJsonSchema, toOpenAITools } from "@/lib/agent/registry";
import { TOOLS } from "@/lib/agent/tools";

describe("tool registry", () => {
  it("has unique names and valid JSON schemas", () => {
    const names = TOOLS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    for (const t of toOpenAITools(TOOLS)) {
      expect(t.function.name).toMatch(/^[a-z_]+$/);
      expect(t.function.parameters.type).toBe("object");
    }
  });

  it("adds visible/submit only where they make sense", () => {
    const po = toJsonSchema(TOOLS.find((t) => t.name === "create_purchase_order")!, { withVisible: true });
    const props = po.properties as Record<string, unknown>;
    expect(props.visible).toBeDefined();
    expect(props.submit).toBeDefined();
    const read = toJsonSchema(TOOLS.find((t) => t.name === "list_inventory")!, { withVisible: true });
    expect((read.properties as Record<string, unknown>).visible).toBeUndefined();
  });

  it("every write tool that fills a form has an on-screen implementation", () => {
    for (const t of TOOLS.filter((x) => x.form)) expect(t.ui, t.name).toBeTypeOf("function");
  });
});

describe("mock planner", () => {
  it("plans a restock as read, read, then one PO per supplier", () => {
    const m1 = mockPlanner([{ role: "user", content: "Restock what's low" }]);
    expect(m1.tool_calls?.[0].function.name).toBe("list_inventory");
    const low = [
      { id: "i-paneer", name: "Paneer", category: "Dairy", suggestedOrderQty: 23 },
      { id: "i-gochujang", name: "Gochujang", category: "Sauces", suggestedOrderQty: 5 },
    ];
    const sups = [
      { id: "s-dairyco", name: "Pure Dairy Co.", categories: ["Dairy"], priceFactor: 1.04 },
      { id: "s-metro", name: "Metro Wholesale", categories: ["Sauces", "Dairy"], priceFactor: 0.86 },
    ];
    const msgs = [
      { role: "user" as const, content: "Restock what's low" },
      { role: "tool" as const, tool_call_id: "a", content: JSON.stringify(low) },
      { role: "tool" as const, tool_call_id: "b", content: JSON.stringify(sups) },
    ];
    const m3 = mockPlanner(msgs);
    const args = JSON.parse(m3.tool_calls![0].function.arguments);
    expect(m3.tool_calls![0].function.name).toBe("create_purchase_order");
    expect(args.supplierId).toBe("s-metro");
    expect(args.lines).toHaveLength(2);
  });
});
