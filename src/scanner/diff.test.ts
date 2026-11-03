import { describe, expect, it } from "vitest";
import type { FormInventoryReport, ReportForm } from "../report/types.js";
import type { StoredScan } from "../panel/types.js";
import { diffScans } from "./diff.js";

function form(ref: string, fieldNames: string[]): ReportForm {
  return {
    ref,
    fields: fieldNames.map((name) => ({ name, category: "email" as const })),
  };
}

function reportWith(forms: ReportForm[]): FormInventoryReport {
  return {
    siteOrigin: "https://x.com",
    formCount: forms.length,
    fieldCount: forms.reduce((n, f) => n + f.fields.length, 0),
    categoryCounts: [],
    destinations: [],
    riskFlags: [],
    review: [],
    forms,
  };
}

function scan(over: Partial<StoredScan> = {}): StoredScan {
  return {
    id: "s",
    siteId: "site-1",
    scannedAt: "2026-11-03T10:00:00.000Z",
    scripts: [],
    report: reportWith([]),
    cookies: [{ name: "_ga", domain: ".", category: "analytics" }],
    observedTargets: [],
    ...over,
  };
}

describe("diffScans (değişiklik uyarısı)", () => {
  it("ilk taramada (önceki yok) her şey yenidir", () => {
    const d = diffScans(null, scan({ report: reportWith([form("form-0", ["email"])]) }));
    expect(d.isFirstScan).toBe(true);
  });

  it("yeni form tespit edilir: 'yeni form/alan eklendi'", () => {
    const prev = scan({ report: reportWith([form("form-0", ["email"])]) });
    const curr = scan({
      report: reportWith([form("form-0", ["email"]), form("form-1", ["tcno", "adsoyad"])]),
    });
    const d = diffScans(prev, curr);
    expect(d.newForms).toEqual([{ formRef: "form-1", newFieldNames: ["tcno", "adsoyad"] }]);
  });

  it("kaldırılan form tespit edilir", () => {
    const prev = scan({
      report: reportWith([form("form-0", ["email"]), form("form-1", ["tcno"])]),
    });
    const curr = scan({ report: reportWith([form("form-0", ["email"])]) });
    expect(diffScans(prev, curr).removedFormRefs).toEqual(["form-1"]);
  });

  it("değişmeyen zincirde uyarı boştur", () => {
    const same = scan({ report: reportWith([form("form-0", ["email"])]) });
    const d = diffScans(same, scan({ id: "s2", report: reportWith([form("form-0", ["email"])]) }));
    expect(d.newForms).toEqual([]);
    expect(d.removedFormRefs).toEqual([]);
    expect(d.newCookieCategories).toEqual([]);
  });

  it("yeni çerez kategorisi tespit edilir", () => {
    const prev = scan({ cookies: [{ name: "_ga", domain: ".", category: "analytics" }] });
    const curr = scan({
      cookies: [
        { name: "_ga", domain: ".", category: "analytics" },
        { name: "_fbp", domain: ".", category: "marketing" },
      ],
    });
    expect(diffScans(prev, curr).newCookieCategories).toEqual(["marketing"]);
  });

  it("bilinen formda YENİ ALAN da newForms'a düşer", () => {
    const prev = scan({ report: reportWith([form("form-0", ["email"])]) });
    const curr = scan({ report: reportWith([form("form-0", ["email", "telefon"])]) });
    expect(diffScans(prev, curr).newForms).toEqual([
      { formRef: "form-0", newFieldNames: ["telefon"] },
    ]);
  });
});
