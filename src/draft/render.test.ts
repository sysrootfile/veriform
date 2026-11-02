import { describe, expect, it } from "vitest";
import { markdownToHtml, renderDraftPageHtml } from "./render.js";

describe("markdownToHtml (minimal)", () => {
  it("başlık, liste, kalın ve alıntıyı çevirir", () => {
    const html = markdownToHtml("## Başlık\n- bir\n- **iki**\n\n> UYARI");
    expect(html).toContain("<h2>Başlık</h2>");
    expect(html).toContain("<ul><li>bir</li><li><strong>iki</strong></li></ul>");
    expect(html).toContain("<blockquote>UYARI</blockquote>");
  });

  it("HTML karakterleri kaçırılır", () => {
    const html = markdownToHtml("# <script>x()</script>");
    expect(html).not.toContain("<script>x()");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("renderDraftPageHtml", () => {
  it("yazdırılabilir sayfa: başlık, sürüm damgası, gövde", () => {
    const html = renderDraftPageHtml({
      title: "Aydınlatma Metni — https://x.com",
      markdown: "## Bölüm\n- madde",
      version: "tpl-2026-11",
    });
    expect(html).toContain("Aydınlatma Metni — https://x.com");
    expect(html).toContain("tpl-2026-11");
    expect(html).toContain("<h2>Bölüm</h2>");
  });
});
