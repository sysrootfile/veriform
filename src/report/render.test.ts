import { describe, expect, it } from "vitest";
import { renderReportHtml } from "./render.js";
import type { FormInventoryReport } from "./types.js";

const sample: FormInventoryReport = {
  siteOrigin: "https://site.com",
  formCount: 2,
  fieldCount: 3,
  categoryCounts: [
    { category: "email", forms: 2 },
    { category: "tckn", forms: 1 },
  ],
  destinations: [
    { origin: "https://site.com", forms: 1, sameOrigin: true },
    { origin: "https://3p.example", forms: 1, sameOrigin: false },
  ],
  riskFlags: [
    {
      formRef: "f1",
      kind: "get-with-sensitive",
      detail: "GET metoduyla gönderilen form hassas kategori içeriyor.",
    },
  ],
  review: [
    { formRef: "f2", fieldName: "belirsiz", category: "address", confidence: 0.3, reason: "Düşük güven." },
  ],
  forms: [],
};

describe("renderReportHtml", () => {
  it("anahtar sayıları, kategorileri ve hedefleri içerir", () => {
    const html = renderReportHtml(sample, { scannedAt: "2026-11-01T10:00:00Z" });
    expect(html).toContain("https://site.com");
    expect(html).toContain("2");
    expect(html).toContain("TC Kimlik No");
    expect(html).toContain("https://3p.example");
    expect(html).toContain("2026-11-01");
    expect(html).toContain("<!doctype html>");
  });

  it("XSS: rapor metinleri HTML'e kaçırılır — ham <script> çıktıya girmez", () => {
    const hostile: FormInventoryReport = {
      ...sample,
      riskFlags: [
        { formRef: 'f"><script>alert(1)</script>', kind: "cross-origin-target", detail: '"><script>alert(1)</script>' },
      ],
      review: [{ formRef: "f", fieldName: "<b>alan</b>", category: "address", confidence: 0.3, reason: "<script>x</script>" }],
    };
    const html = renderReportHtml(hostile);
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });

  it("boş raporu çökmeden render eder", () => {
    const empty: FormInventoryReport = {
      siteOrigin: "https://bos.com",
      formCount: 0,
      fieldCount: 0,
      categoryCounts: [],
      destinations: [],
      riskFlags: [],
      review: [],
      forms: [],
    };
    const html = renderReportHtml(empty);
    expect(html).toContain("https://bos.com");
    expect(html).toContain("0");
  });

  it("rıza öncesi çerezler: yalnızca zorunlu olmayanlar listelenir ve sayılır", () => {
    const cookies = [
      { name: "_fbp", domain: ".site.com", category: "marketing" },
      { name: "PHPSESSID", domain: ".site.com", category: "necessary" },
      { name: "ab_test", domain: ".", category: "unknown" },
    ];
    const html = renderReportHtml(sample, { cookies });
    expect(html).toContain("Rıza Öncesi Çerezler");
    expect(html).toContain("_fbp");
    expect(html).toContain("ab_test");
    expect(html).toContain("Pazarlama");
    expect(html).toContain("Sınıflandırılamadı");
    // zorunlu çerez ihlal değildir — listede yer almaz
    expect(html).not.toContain("PHPSESSID");
  });

  it("çerez verilmezse çerez bölümü hiç render edilmez", () => {
    expect(renderReportHtml(sample)).not.toContain("Rıza Öncesi Çerezler");
  });

  it("XSS: çerez adları HTML'e kaçırılır", () => {
    const html = renderReportHtml(sample, {
      cookies: [{ name: '"><script>x()</script>', domain: ".", category: "marketing" }],
    });
    expect(html).not.toContain("<script>x()");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("Zincir Defter dünyası", () => {
  it("rapor scoped dünya stilleri + self-host font taşır", () => {
    const html = renderReportHtml(sample);
    expect(html).toContain('<body class="vf-report">');
    expect(html).toContain(".vf-report h1");
    expect(html).toContain('@font-face{font-family:"Archivo"');
    expect(html).toContain("--paper:#f6f7f4");
  });
});
