import { describe, expect, it } from "vitest";
import {
  effectivePackage,
  isContactPackage,
  PLAN_LABELS,
  PLAN_LIMITS,
  TRIAL_DAYS,
  trialDaysLeft,
} from "./plans.js";

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

describe("deneme süresi ve etkin paket", () => {
  const now = new Date("2026-11-24T12:00:00.000Z");

  it("deneme 14 gündür", () => {
    expect(TRIAL_DAYS).toBe(14);
  });

  it("trialEndsAt yoksa seçilen paket aynen geçerli", () => {
    expect(effectivePackage({ package: "pro" }, now)).toBe("pro");
  });

  it("deneme sürerken seçilen paket geçerli", () => {
    expect(
      effectivePackage({ package: "ultimate", trialEndsAt: "2026-12-01T00:00:00.000Z" }, now),
    ).toBe("ultimate");
  });

  it("deneme bittiyse kota starter'a düşer", () => {
    expect(
      effectivePackage({ package: "ultimate", trialEndsAt: "2026-11-01T00:00:00.000Z" }, now),
    ).toBe("starter");
  });

  it("trialDaysLeft: deneme yoksa null, bittiyse 0, sürerken yukarı yuvarlanmış gün", () => {
    expect(trialDaysLeft(undefined, now)).toBeNull();
    expect(trialDaysLeft("2026-11-01T00:00:00.000Z", now)).toBe(0);
    expect(trialDaysLeft("2026-11-25T12:00:00.000Z", now)).toBe(1);
    expect(trialDaysLeft("2026-11-25T13:00:00.000Z", now)).toBe(2);
  });
});