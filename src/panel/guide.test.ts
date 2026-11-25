import { describe, expect, it } from "vitest";
import { renderGuidePage } from "./guide.js";

describe("renderGuidePage", () => {
  it("ürünün ne yaptığını ve kurulum akışını anlatır", () => {
    const html = renderGuidePage();
    expect(html).toContain("Rehber");
    expect(html).toContain("Form veri envanteri");
    expect(html).toContain("Rıza kanıt zinciri");
    expect(html).toContain("DSAR");
    expect(html).toContain("yalnızca kayıtlı domainde");
    expect(html).toContain("seçim yapınca kanıt anında");
    expect(html).toContain("Değişiklik uyarıları");
    expect(html).toContain("Müşteri ekle");
    expect(html).toContain("Site ekle");
    expect(html).toContain("İzleme kodu");
    expect(html).toContain("Sürekli İzleme");
  });

  it("kurulum akışı şeritle aynı altı adımı aynı sırayla anlatır", () => {
    const html = renderGuidePage();
    const steps = [
      "Müşteri ekle",
      "Site ekle",
      "İlk tarama",
      "E-postanı onayla",
      "İzleme kodunu kur",
      "Banner'ı yayınla",
    ];
    let last = -1;
    for (const step of steps) {
      const i = html.indexOf(step);
      expect(i).toBeGreaterThan(last);
      last = i;
    }
    expect(html).toContain("Şimdi tara");
    expect(html).toContain("site anahtarı");
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
describe("anlaşılırlık — rehber müşteri dili", () => {
  it("önce ihtiyacı ve kazanımı anlatır, mekanizma sonra gelir", () => {
    const html = renderGuidePage();
    expect(html).toContain("Ne işe yarar?");
    expect(html).toContain("Hangi ihtiyaçları karşılar?");
    expect(html).toContain("Elimde ne olacak?");
    const need = html.indexOf("Hangi ihtiyaçları karşılar?");
    const steps = html.indexOf("Sırayla ne yapacaksınız");
    expect(need).toBeGreaterThan(-1);
    expect(steps).toBeGreaterThan(need);
  });
});
