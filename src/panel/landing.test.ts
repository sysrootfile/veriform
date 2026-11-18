import { describe, expect, it } from "vitest";
import { renderLandingPage } from "./landing.js";

describe("renderLandingPage — içerik sözleşmesi", () => {
  it("üç paket de ad ve fiyatıyla görünür", () => {
    const html = renderLandingPage();
    expect(html).toContain("Starter");
    expect(html).toContain("Pro");
    expect(html).toContain("Ultimate");
    expect(html).toContain("990");
    expect(html).toContain("2.990");
    expect(html).toContain("7.990");
  });

  it("iletişim formu POST /contact'a gider ve gerekli alanları taşır", () => {
    const html = renderLandingPage();
    expect(html).toContain('action="/contact"');
    expect(html).toContain('name="name"');
    expect(html).toContain('name="email"');
    expect(html).toContain('name="company"');
    expect(html).toContain('name="package"');
    expect(html).toContain('name="message"');
    expect(html).toContain('value="starter"');
    expect(html).toContain('value="pro"');
    expect(html).toContain('value="ultimate"');
    expect(html).toContain('id="iletisim"');
  });

  it("kayıt, giriş ve demo tarama bağlantıları var", () => {
    const html = renderLandingPage();
    expect(html).toContain('href="/register"');
    expect(html).toContain('href="/login"');
    expect(html).toContain('href="/tarama"');
  });

  it("ürünün ne yaptığı ilk ekranda anlaşılır: form izleme + kanıt zinciri", () => {
    const html = renderLandingPage();
    expect(html).toContain("KVKK");
    expect(html).toContain("kanıt");
    expect(html).toContain("ham veri");
  });

  it("contact=ok teşekkürü, contact=invalid düzeltme uyarısı basar; varsayılanda ikisi de yok", () => {
    const ok = renderLandingPage({ contactStatus: "ok" });
    expect(ok).toContain("Talebiniz alındı");
    const bad = renderLandingPage({ contactStatus: "invalid" });
    expect(bad).toContain("Formu kontrol edin");
    const plain = renderLandingPage();
    expect(plain).not.toContain("Talebiniz alındı");
    expect(plain).not.toContain("Formu kontrol edin");
  });

  it("Türkçe sayfa, mobil viewport, olmayan CDN'e atıf yok", () => {
    const html = renderLandingPage();
    expect(html).toContain('lang="tr"');
    expect(html).toContain('name="viewport"');
    expect(html).not.toContain("cdn.veriform.io");
  });
});