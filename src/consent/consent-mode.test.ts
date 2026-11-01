import { describe, expect, it } from "vitest";
import { toConsentModeV2 } from "./consent-mode.js";
import { createConsentState } from "./state.js";

describe("toConsentModeV2", () => {
  it("tümü kapalıyken tüm sinyaller denied olur", () => {
    expect(toConsentModeV2({ analytics: false, marketing: false, personalization: false })).toEqual({
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      analytics_storage: "denied",
      personalization_storage: "denied",
    });
  });

  it("marketing kararı üç ad sinyalini birlikte taşır", () => {
    const mode = toConsentModeV2({ analytics: false, marketing: true, personalization: false });
    expect(mode.ad_storage).toBe("granted");
    expect(mode.ad_user_data).toBe("granted");
    expect(mode.ad_personalization).toBe("granted");
    expect(mode.analytics_storage).toBe("denied");
  });

  it("karışık kararlar kategori bazlı eşlenir", () => {
    const mode = toConsentModeV2({ analytics: true, marketing: false, personalization: true });
    expect(mode.analytics_storage).toBe("granted");
    expect(mode.ad_storage).toBe("denied");
    expect(mode.personalization_storage).toBe("granted");
  });

  it("durum makinesiyle bütünleşir: grantAll → granted, denyAll → denied", () => {
    const s = createConsentState();
    s.grantAll();
    expect(Object.values(toConsentModeV2(s.getDecisions()))).toEqual(
      Array(5).fill("granted"),
    );
    s.denyAll();
    expect(Object.values(toConsentModeV2(s.getDecisions()))).toEqual(
      Array(5).fill("denied"),
    );
  });
});
