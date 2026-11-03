import { describe, expect, it } from "vitest";
import type { FormInventoryReport } from "../report/types.js";
import { applyCorrections, type Correction } from "./corrections.js";

function report(): FormInventoryReport {
  return {
    siteOrigin: "https://x.com",
    formCount: 1,
    fieldCount: 2,
    categoryCounts: [
      { category: "free_text", forms: 1 },
      { category: "email", forms: 1 },
    ],
    destinations: [],
    riskFlags: [],
    review: [
      {
        formRef: "form-0",
        fieldName: "aciklama",
        category: "free_text",
        confidence: 0.3,
        reason: "Sınıflandırma güveni düşük",
      },
    ],
    forms: [
      {
        ref: "form-0",
        fields: [
          { name: "aciklama", category: "free_text" },
          { name: "email", category: "email" },
        ],
      },
    ],
  };
}

describe("applyCorrections", () => {
  it("eşleşen alanın kategorisini düzeltir ve inceleme kuyruğundan çıkarır", () => {
    const corrections: Correction[] = [{ fieldName: "aciklama", category: "address" }];
    const result = applyCorrections(report(), corrections);
    expect(result.forms[0]!.fields[0]).toEqual({ name: "aciklama", category: "address" });
    expect(result.review).toHaveLength(0);
  });

  it("eşleşmeyen düzeltmeler raporu değiştirmez", () => {
    const corrections: Correction[] = [{ fieldName: "baska", category: "address" }];
    const result = applyCorrections(report(), corrections);
    expect(result.forms[0]!.fields[0]).toEqual({ name: "aciklama", category: "free_text" });
    expect(result.review).toHaveLength(1);
  });

  it("birden çok düzeltme uygulanır; kategori sayıları yeniden hesaplanmaz (anlık görüntü bütünlüğü)", () => {
    const corrections: Correction[] = [
      { fieldName: "aciklama", category: "address" },
      { fieldName: "yeni", category: "phone" },
    ];
    const result = applyCorrections(report(), corrections);
    expect(result.forms[0]!.fields[0]!.category).toBe("address");
    expect(result.categoryCounts[0]!.category).toBe("free_text"); // anlık görüntü dokunulmaz
  });
});
