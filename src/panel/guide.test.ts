import { describe, expect, it } from "vitest";
import { renderGuidePage } from "./guide.js";

describe("renderGuidePage", () => {
  it("ürünün ne yaptığını ve kurulum akışını anlatır", () => {
    const html = renderGuidePage();
    expect(html).toContain("Rehber");
    expect(html).toContain("Form veri envanteri");
    expect(html).toContain("Rıza kanıt zinciri");
    expect(html).toContain("DSAR");
    expect(html).toContain("Değişiklik uyarıları");
    expect(html).toContain("Müşteri ekle");
    expect(html).toContain("Site ekle");
    expect(html).toContain("embed");
    expect(html).toContain("Sürekli İzleme");
  });

  it("ham veri saklanmadığı ilkesini belirtir", () => {
    const html = renderGuidePage();
    expect(html).toContain("ham veri");
  });

  it("panel sayfalarına link verir ve nav'da aktif sayfa işaretlenir", () => {
    const html = renderGuidePage();
    expect(html).toContain('href="/clients"');
    expect(html).toContain('href="/audit"');
    expect(html).toContain('href="/settings/api-keys"');
    expect(html).toContain('href="/api/docs"');
    expect(html).toContain('href="/rehber" aria-current="page"');
    expect(html).toContain('lang="tr"');
  });
});