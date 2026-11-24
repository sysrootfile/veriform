import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { LANDING_SCRIPT_HASHES, renderLandingPage } from "./landing.js";

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

describe("landing — CSP hash sözleşmesi ve yasal bağlantılar", () => {
  it("gömülü script'lerin sha256 hash'leri LANDING_SCRIPT_HASHES ile birebir", () => {
    const html = renderLandingPage();
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]!);
    expect(scripts.length).toBe(2);
    const hashes = scripts.map((s) => createHash("sha256").update(s).digest("base64"));
    expect(hashes).toEqual(LANDING_SCRIPT_HASHES);
  });

  it("footer yasal sayfalara bağlanır", () => {
    const html = renderLandingPage();
    expect(html).toContain('href="/kullanim-sartlari"');
    expect(html).toContain('href="/gizlilik"');
    expect(html).toContain('href="/cerez-politikasi"');
  });
});
