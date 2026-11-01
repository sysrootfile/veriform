import { describe, expect, it } from "vitest";
import { buildFormInventory } from "./inventory.js";
import type { FieldCategory } from "../classifier/types.js";
import type { ScanInput } from "./types.js";

function field(name: string, category: FieldCategory, confidence = 0.9) {
  return {
    meta: { name },
    classification: { category, confidence, signals: [] },
  };
}

describe("buildFormInventory", () => {
  it("form/alan sayımı, kategori ve hedef kırılımını üretir", () => {
    const input: ScanInput = {
      siteUrl: "https://site.com",
      forms: [
        {
          ref: "f1",
          fields: [field("email", "email"), field("tcno", "tckn")],
          target: { origin: "https://crm.example.net", path: "/lead", via: "form", method: "POST" },
        },
        {
          ref: "f2",
          fields: [field("email", "email")],
          target: { origin: "https://site.com", path: "/abone", via: "form", method: "POST" },
        },
      ],
    };

    const report = buildFormInventory(input);

    expect(report.siteOrigin).toBe("https://site.com");
    expect(report.formCount).toBe(2);
    expect(report.fieldCount).toBe(3);
    expect(report.categoryCounts).toEqual([
      { category: "email", forms: 2 },
      { category: "tckn", forms: 1 },
    ]);
    expect(report.destinations).toEqual([
      { origin: "https://site.com", forms: 1, sameOrigin: true },
      { origin: "https://crm.example.net", forms: 1, sameOrigin: false },
    ]);
  });

  it("GET formu hassas kategori taşıyorsa sızıntı riski işaretler", () => {
    const sensitive = ["tckn", "iban", "card", "passport"] as const;
    for (const category of sensitive) {
      const report = buildFormInventory({
        siteUrl: "https://site.com",
        forms: [
          {
            ref: "f",
            fields: [field("x", category)],
            target: { origin: "https://site.com", path: "/s", via: "form", method: "GET" },
          },
        ],
      });
      expect(report.riskFlags).toContainEqual(
        expect.objectContaining({ formRef: "f", kind: "get-with-sensitive" }),
      );
    }
  });

  it("GET + hassas olmayan (email/phone) kombinasyonu işaretlenmez", () => {
    const report = buildFormInventory({
      siteUrl: "https://site.com",
      forms: [
        {
          ref: "f",
          fields: [field("email", "email"), field("tel", "phone")],
          target: { origin: "https://site.com", path: "/s", via: "form", method: "GET" },
        },
      ],
    });
    expect(report.riskFlags).toEqual([]);
  });

  it("cross-origin hedefi işaretler ve detayda hedef origin'i taşır", () => {
    const report = buildFormInventory({
      siteUrl: "https://site.com",
      forms: [
        {
          ref: "f",
          fields: [field("email", "email")],
          target: { origin: "https://3p.example", path: "/c", via: "xhr" },
        },
      ],
    });
    const flag = report.riskFlags.find((r) => r.kind === "cross-origin-target");
    expect(flag?.formRef).toBe("f");
    expect(flag?.detail).toContain("https://3p.example");
  });

  it("düşük güvenli sınıflandırmaları inceleme kuyruğuna alır", () => {
    const report = buildFormInventory({
      siteUrl: "https://site.com",
      forms: [
        {
          ref: "f1",
          fields: [field("belirsiz", "address", 0.3), field("net", "email", 0.9)],
        },
      ],
    });
    expect(report.review).toHaveLength(1);
    expect(report.review[0]).toMatchObject({
      formRef: "f1",
      fieldName: "belirsiz",
      category: "address",
      confidence: 0.3,
    });
  });

  it("RAPOR SÖZLEŞMESİ: çıktı JSON-serializable (DOM referansı taşımaz)", () => {
    const input: ScanInput = {
      siteUrl: "https://site.com",
      forms: [
        {
          ref: "f1",
          fields: [field("tcno", "tckn", 0.4)],
          target: { origin: "https://3p.example", path: "/c", via: "xhr" },
        },
      ],
    };
    const report = buildFormInventory(input);
    expect(JSON.parse(JSON.stringify(report))).toEqual(report);
  });
});
