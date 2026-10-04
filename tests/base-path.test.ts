import { describe, expect, it } from "vitest";
import { normaliseBasePath } from "@/lib/base-path";

describe("normaliseBasePath", () => {
  it("adds a leading slash and drops trailing ones", () => {
    expect(normaliseBasePath("cloud-kitchen-os/")).toBe("/cloud-kitchen-os");
    expect(normaliseBasePath(" /a/b// ")).toBe("/a/b");
  });
  it("treats empty and root as no prefix", () => {
    expect(normaliseBasePath(undefined)).toBe("");
    expect(normaliseBasePath("")).toBe("");
    expect(normaliseBasePath("/")).toBe("");
  });
});
