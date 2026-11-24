import { describe, expect, it } from "vitest";
import {
  renderCookiePolicyPage,
  renderPrivacyPage,
  renderTermsPage,
} from "./legal.js";

describe("yasal sayfalar", () => {
  it("kullanım şartları: hizmet, yetkili tarama, sorumluluk, fesih bölümleri", () => {
    const html = renderTermsPage();
    expect(html).toContain('<html lang="tr">');
    expect(html).toContain("Kullanım Şartları");
    expect(html).toContain("yetkili olduğunuz");
    expect(html).toContain("olduğu gibi");
    expect(html).toContain("hesabınızı silerek");
    expect(html).toContain("[Ünvan]");
  });

  it("gizlilik: toplanan veri, ham içerik saklanmaz, KVKK m.11 hakları", () => {
    const html = renderPrivacyPage();
    expect(html).toContain("Gizlilik");
    expect(html).toContain("KVKK");
    expect(html).toContain("alan adlarını");
    expect(html).toContain("içeriklerini saklamaz");
    expect(html).toContain("11. madde");
    expect(html).toContain("/#iletisim");
  });

  it("çerez politikası: yalnız zorunlu oturum çerezi, embed çerez yazmaz", () => {
    const html = renderCookiePolicyPage();
    expect(html).toContain("Çerez Politikası");
    expect(html).toContain("vf_session");
    expect(html).toContain("HttpOnly");
    expect(html).toContain("çerez yazmaz");
    expect(html).toContain("analitik veya pazarlama çerezi kullanmaz");
  });

  it("üç sayfa birbirine ve ana sayfaya bağlanır", () => {
    for (const html of [renderTermsPage(), renderPrivacyPage(), renderCookiePolicyPage()]) {
      expect(html).toContain('href="/kullanim-sartlari"');
      expect(html).toContain('href="/gizlilik"');
      expect(html).toContain('href="/cerez-politikasi"');
      expect(html).toContain('href="/"');
    }
  });
});