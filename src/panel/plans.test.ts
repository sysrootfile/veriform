import { describe, expect, it } from "vitest";
import { isContactPackage, PLAN_LABELS, PLAN_LIMITS } from "./plans.js";

describe("paket planları", () => {
  it("site kotaları starter 3, pro 15, ultimate sınırsız", () => {
    expect(PLAN_LIMITS.starter).toBe(3);
    expect(PLAN_LIMITS.pro).toBe(15);
    expect(PLAN_LIMITS.ultimate).toBeNull();
  });

  it("etiketler landing tarifesiyle aynı adlar", () => {
    expect(PLAN_LABELS).toEqual({ starter: "Starter", pro: "Pro", ultimate: "Ultimate" });
  });

  it("isContactPackage yalnızca üç değeri kabul eder", () => {
    expect(isContactPackage("starter")).toBe(true);
    expect(isContactPackage("pro")).toBe(true);
    expect(isContactPackage("ultimate")).toBe(true);
    expect(isContactPackage("enterprise")).toBe(false);
    expect(isContactPackage("")).toBe(false);
    expect(isContactPackage(undefined)).toBe(false);
    expect(isContactPackage(null)).toBe(false);
    expect(isContactPackage(3)).toBe(false);
  });
});