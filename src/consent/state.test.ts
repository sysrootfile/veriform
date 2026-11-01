import { describe, expect, it } from "vitest";
import { createConsentState } from "./state.js";

describe("createConsentState", () => {
  it("varsayılan: zorunlu her zaman açık, diğerleri kapalı (KVKK açık rıza ilkesi)", () => {
    const s = createConsentState();
    expect(s.isGranted("necessary")).toBe(true);
    expect(s.isGranted("analytics")).toBe(false);
    expect(s.isGranted("marketing")).toBe(false);
    expect(s.isGranted("personalization")).toBe(false);
  });

  it("grantAll yalnızca etkin kategorileri açar; disable edilmiş kategori kapalı kalır", () => {
    const s = createConsentState({ enabledCategories: ["analytics"] });
    s.grantAll();
    expect(s.isGranted("analytics")).toBe(true);
    expect(s.isGranted("marketing")).toBe(false);
  });

  it("denyAll tüm opsiyonel kategorileri kapatır", () => {
    const s = createConsentState();
    s.grantAll();
    s.denyAll();
    expect(s.getDecisions()).toEqual({
      analytics: false,
      marketing: false,
      personalization: false,
    });
    expect(s.isGranted("necessary")).toBe(true);
  });

  it("set kategori bazlı karar verir; necessary kapatılamaz", () => {
    const s = createConsentState();
    s.set("analytics", true);
    expect(s.isGranted("analytics")).toBe(true);
    s.set("necessary", false);
    expect(s.isGranted("necessary")).toBe(true);
  });

  it("GERİ ÇEKME: verilmiş rıza sonradan geri alınabilir", () => {
    const s = createConsentState();
    s.set("marketing", true);
    s.set("marketing", false);
    expect(s.isGranted("marketing")).toBe(false);
  });
});
