// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { renderScanRequestPage } from "./public.js";

describe("renderScanRequestPage", () => {
  it("kamu formu url alanıyla çizilir", () => {
    const html = renderScanRequestPage({ formAction: "/tarama" });
    expect(html).toContain('action="/tarama"');
    expect(html).toContain('name="url"');
    expect(html).toContain("Ücretsiz Form Taraması");
  });

  it("hata mesajı kaçırılarak gösterilir (kullanıcı girdisi HTML'e girmez)", () => {
    const html = renderScanRequestPage({
      formAction: "/tarama",
      error: '"><script>x()</script>',
    });
    expect(html).not.toContain("<script>x()");
    expect(html).toContain("&lt;script&gt;");
  });

  it("sonuç modunda rapor HTML'i gömülür", () => {
    const html = renderScanRequestPage({
      formAction: "/tarama",
      resultHtml: "<h1>Rapor</h1>",
    });
    expect(html).toContain("<h1>Rapor</h1>");
  });
});
