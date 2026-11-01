import { describe, expect, it } from "vitest";
import type { StoredScan } from "./types.js";
import { renderClientsPage, renderSitePage } from "./render.js";

function scan(over: Partial<StoredScan> = {}): StoredScan {
  return {
    id: "scan-1",
    siteId: "site-1",
    scannedAt: "2026-11-01T10:00:00.000Z",
    report: {
      siteOrigin: "https://musteri1.com",
      formCount: 2,
      fieldCount: 5,
      categoryCounts: [],
      destinations: [],
      riskFlags: [{ formRef: "f", kind: "get-with-sensitive", detail: "x" }],
      review: [],
    },
    cookies: [
      { name: "_fbp", domain: ".", category: "marketing" },
      { name: "PHPSESSID", domain: ".", category: "necessary" },
    ],
    observedTargets: [],
    ...over,
  };
}

describe("renderClientsPage", () => {
  it("tenant adını ve client listesini çizer", () => {
    const html = renderClientsPage({
      tenantName: "Ajans A",
      clients: [
        { id: "c1", name: "Müşteri 1" },
        { id: "c2", name: "Müşteri 2" },
      ],
    });
    expect(html).toContain("Ajans A");
    expect(html).toContain("Müşteri 1");
    expect(html).toContain("Müşteri 2");
    expect(html).toContain("/clients/c1");
  });

  it("client adları HTML'e kaçırılır", () => {
    const html = renderClientsPage({
      tenantName: "Ajans",
      clients: [{ id: "c1", name: '"><script>alert(1)</script>' }],
    });
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });

  it("boş listede boş durum metni görünür", () => {
    const html = renderClientsPage({ tenantName: "Ajans A", clients: [] });
    expect(html).toContain("Henüz müşteri eklenmedi");
  });
});

describe("renderSitePage", () => {
  it("zincir geçerliyken yeşil rozet basar", () => {
    const html = renderSitePage({
      siteUrl: "https://musteri1.com",
      chainValid: true,
      scans: [scan()],
    });
    expect(html).toContain("Kanıt zinciri geçerli");
    expect(html).toContain("https://musteri1.com");
    expect(html).toContain("2");
  });

  it("zincir bozulmuşsa uyarı basar", () => {
    const html = renderSitePage({
      siteUrl: "https://musteri1.com",
      chainValid: false,
      scans: [],
    });
    expect(html).toContain("Zincir doğrulaması başarısız");
  });

  it("tarama satırlarında risk ve çerez ihlali sayıları görünür", () => {
    const html = renderSitePage({
      siteUrl: "https://musteri1.com",
      chainValid: true,
      scans: [scan()],
    });
    // 1 risk işareti + 1 çerez ihlali (_fbp; PHPSESSID hariç)
    expect(html).toContain("2026-11-01");
  });

  it("hiç tarama yoksa boş durum görünür", () => {
    const html = renderSitePage({
      siteUrl: "https://musteri1.com",
      chainValid: true,
      scans: [],
    });
    expect(html).toContain("Henüz tarama yok");
  });

  it("site URL'i HTML'e kaçırılır", () => {
    const html = renderSitePage({
      siteUrl: 'https://x.com/?"><script>alert(1)</script>',
      chainValid: true,
      scans: [],
    });
    expect(html).not.toContain("<script>alert");
  });
});
