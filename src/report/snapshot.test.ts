// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { discoverForms } from "../collector/discover.js";
import { buildFormInventory } from "./inventory.js";
import { snapshotForms } from "./snapshot.js";

describe("snapshotForms (DOM → rapor zinciri)", () => {
  it("uçtan uca: DOM → keşif → sınıflandırma → PII haritası raporu", () => {
    document.body.innerHTML = `
      <form action="/uye" method="post">
        <label for="ad">Ad Soyad</label><input id="ad" name="adsoyad">
        <label for="mail">E-Posta</label><input id="mail" name="email" type="email">
        <label for="tc">T.C. Kimlik No</label><input id="tc" name="tcno">
      </form>
      <form action="/ara" method="get">
        <label for="q">Kimlik ile ara</label><input id="q" name="tcno">
      </form>
    `;
    const siteUrl = "http://localhost:3000/";
    const forms = snapshotForms(discoverForms(document), siteUrl);
    const report = buildFormInventory({ siteUrl, forms });

    expect(report.formCount).toBe(2);
    expect(report.fieldCount).toBe(4);
    expect(report.categoryCounts).toEqual([
      { category: "tckn", forms: 2 },
      { category: "email", forms: 1 },
      { category: "full_name", forms: 1 },
    ]);
    expect(report.destinations).toEqual([
      { origin: "http://localhost:3000", forms: 2, sameOrigin: true },
    ]);
    expect(report.riskFlags).toEqual([
      expect.objectContaining({ formRef: "form-1", kind: "get-with-sensitive" }),
    ]);
  });

  it("alan meta verisi element referansı taşımaz — snapshot JSON-güvenli", () => {
    document.body.innerHTML = `<form action="/x"><input name="email" type="email"></form>`;
    const forms = snapshotForms(discoverForms(document), "http://localhost:3000/");
    expect(JSON.parse(JSON.stringify(forms))).toEqual(forms);
  });
});
