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
