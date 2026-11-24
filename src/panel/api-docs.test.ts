import { describe, expect, it } from "vitest";
import { renderApiDocsPage } from "./api-docs.js";

describe("renderApiDocsPage", () => {
  it("uçları ve curl örneklerini listeler", () => {
    const html = renderApiDocsPage();
    expect(html).toContain("X-API-Key");
    expect(html).toContain("/api/v1/me");
    expect(html).toContain("/api/v1/clients");
    expect(html).toContain("curl");
    expect(html).toContain("/api/v1/clients/:clientId/sites");
  });

  it("taintsiz: env/istek verisi bu sayfaya parametre olarak geçmez", () => {
    // renderApiDocsPage parametre almaz — çağrı imzası taaint yüzeyini sıfırlar
    const html = renderApiDocsPage();
    expect(typeof html).toBe("string");
  });
});

describe("Zincir Defter dünyası", () => {
  it("API docs kağıt yaprağı + antet + self-host font taşır", () => {
    const html = renderApiDocsPage();
    expect(html).toContain('class="sheet"');
    expect(html).toContain('class="antet"');
    expect(html).toContain("SAYFA ·");
    expect(html).toContain('@font-face{font-family:"Archivo"');
    expect(html).toContain("--paper:#f6f7f4");
  });
});
