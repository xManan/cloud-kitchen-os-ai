import { describe, expect, it } from "vitest";
import { mockJev } from "@/lib/agent/jev-mock";
import { normalise } from "@/lib/agent/jev-types";

describe("Jev answer normalisation", () => {
  it("reads the documented noul shape", () => {
    expect(normalise({ type: "noul", noul: 0.98 })).toEqual({ type: "noul", p: 0.98 });
  });
  it("accepts the plausible choice encodings", () => {
    expect(normalise({ type: "choice", choice: "billing", confidence: 0.9 })).toEqual({ type: "choice", pick: "billing", p: 0.9 });
    expect(normalise({ type: "choice", choice: { billing: 0.2, technical: 0.8 } })).toEqual({ type: "choice", pick: "technical", p: 0.8 });
    expect(normalise({ selected: "x" })).toEqual({ type: "choice", pick: "x", p: 1 });
    expect(normalise(null)).toBeNull();
  });
});

describe("Jev demo heuristic", () => {
  const intents = {
    navigate: "open, go to, show or take me to a page or screen of the app",
    item_availability: "mark a menu item or dish sold out, 86 it, out of stock, or available again",
    complex: "anything else: questions needing analysis, creating orders, purchase orders",
  };
  it("is confident on clear requests", () => {
    const a = mockJev("Current page: Menu\nUser request: Mark garlic bread sold out", {
      intent: { type: "choice", instructions: "", criteria: intents },
      available: { type: "noul", instructions: "Should the menu item end up available to order (not sold out)?" },
    });
    expect(a.intent).toMatchObject({ type: "choice", pick: "item_availability" });
    expect((a.intent as { p: number }).p).toBeGreaterThanOrEqual(0.8);
    expect((a.available as { p: number }).p).toBeLessThan(0.2);
  });
  it("is unsure when nothing matches, so the big model takes over", () => {
    const a = mockJev("User request: How are sales this week?", { intent: { type: "choice", instructions: "", criteria: intents } });
    expect((a.intent as { p: number }).p).toBeLessThan(0.8);
  });
});
