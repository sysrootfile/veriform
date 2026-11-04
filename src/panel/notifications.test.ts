import { describe, expect, it } from "vitest";
import { buildChangeAlertEmail, shouldNotifyChange } from "./notifications.js";
import type { ScanDiff } from "../scanner/diff.js";

const emptyDiff: ScanDiff = {
  isFirstScan: false,
  newForms: [],
  removedFormRefs: [],
  newCookieCategories: [],
};

const changedDiff: ScanDiff = {
  isFirstScan: false,
  newForms: [{ formRef: "form-1", newFieldNames: ["tcno", "adsoyad"] }],
  removedFormRefs: ["form-9"],
  newCookieCategories: ["marketing"],
};

describe("buildChangeAlertEmail", () => {
  it("konu satırında site ve değişiklik özeti taşır", () => {
    const email = buildChangeAlertEmail({
      siteUrl: "https://musteri.com",
      diff: changedDiff,
      scannedAt: "2026-11-04T10:00:00.000Z",
    })!;
    expect(email.subject).toContain("https://musteri.com");
    expect(email.subject).toContain("değişiklik");
  });

  it("gövde yeni formları, kaldırılanları ve çerez kategorilerini sayar", () => {
    const email = buildChangeAlertEmail({
      siteUrl: "https://musteri.com",
      diff: changedDiff,
      scannedAt: "2026-11-04T10:00:00.000Z",
    })!;
    expect(email.text).toContain("form-1");
    expect(email.text).toContain("tcno");
    expect(email.text).toContain("form-9");
    expect(email.text).toContain("marketing");
    expect(email.html).toContain("tcno");
  });

  it("değişiklik yoksa null döner (boş mail gönderilmez)", () => {
    expect(
      buildChangeAlertEmail({
        siteUrl: "https://musteri.com",
        diff: emptyDiff,
        scannedAt: "2026-11-04T10:00:00.000Z",
      }),
    ).toBeNull();
  });
});

describe("shouldNotifyChange", () => {
  it("yeni form veya yeni çerez kategorisi varsa true", () => {
    expect(shouldNotifyChange(changedDiff)).toBe(true);
    expect(
      shouldNotifyChange({ ...emptyDiff, newCookieCategories: ["marketing"] }),
    ).toBe(true);
    expect(shouldNotifyChange({ ...emptyDiff, newForms: [{ formRef: "f", newFieldNames: ["a"] }] })).toBe(true);
  });

  it("yalnızca kaldırılan form için de bildirir (silinen veri toplama = olumlu sinyal ama bilinmeli)", () => {
    expect(
      shouldNotifyChange({ ...emptyDiff, removedFormRefs: ["form-0"] }),
    ).toBe(true);
  });

  it("değişiklik yoksa false", () => {
    expect(shouldNotifyChange(emptyDiff)).toBe(false);
  });
});
