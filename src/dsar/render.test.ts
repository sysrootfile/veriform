// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import type { DsarRequest } from "./types.js";
import { renderDsarFormPage, renderDsarPanelPage } from "./render.js";

function dsar(over: Partial<DsarRequest> = {}): DsarRequest {
  return {
    id: "d1",
    siteId: "s1",
    type: "silme",
    subjectName: "Ayşe Yılmaz",
    subjectEmail: "ayse@example.com",
    receivedAt: "2026-11-02T10:00:00.000Z",
    deadlineAt: "2026-12-02T10:00:00.000Z",
    status: "new",
    ...over,
  };
}

describe("renderDsarFormPage (gömülebilir kamu formu)", () => {
  it("talep türü seçenekleri ve kimlik alanlarıyla formu çizer", () => {
    const html = renderDsarFormPage({
      siteUrl: "https://musteri1.com",
      formAction: "/dsar/tok123",
    });
    expect(html).toContain('action="/dsar/tok123"');
    expect(html).toContain('name="type"');
    expect(html).toContain("silme");
    expect(html).toContain('name="subjectName"');
    expect(html).toContain('name="subjectEmail"');
    expect(html).toContain("https://musteri1.com");
  });

  it("başarı sayfası yanıt süresini (30 gün sonucu) gösterir", () => {
    const html = renderDsarFormPage({
      siteUrl: "https://musteri1.com",
      formAction: "/dsar/tok123",
      success: { deadlineAt: "2026-12-02T10:00:00.000Z" },
    });
    expect(html).toContain("Başvurunuz alındı");
    expect(html).toContain("2026-12-02");
  });
});

describe("renderDsarPanelPage", () => {
  const now = "2026-11-27T10:00:00.000Z"; // 5 gün kaldı

  it("başvuru satırlarını tür ve durum etiketleriyle listeler", () => {
    const html = renderDsarPanelPage({
      siteUrl: "https://musteri1.com",
      siteId: "s1",
      requests: [dsar()],
      now,
    });
    expect(html).toContain("Ayşe Yılmaz");
    expect(html).toContain("m.11/6");
    expect(html).toContain("5 gün");
    expect(html).toContain("Yeni");
  });

  it("süresi geçmiş ve yanıtlanmamış başvuruda uyarı basar", () => {
    const html = renderDsarPanelPage({
      siteUrl: "https://musteri1.com",
      siteId: "s1",
      requests: [
        dsar({
          receivedAt: "2026-10-01T10:00:00.000Z",
          deadlineAt: "2026-10-31T10:00:00.000Z",
        }),
      ],
      now,
    });
    expect(html).toContain("SÜRE GEÇTİ");
  });

  it("durum güncelleme formu doğru adrese gider; uzatma seçeneği sunar", () => {
    const html = renderDsarPanelPage({
      siteUrl: "https://musteri1.com",
      siteId: "s1",
      requests: [dsar()],
      now,
    });
    expect(html).toContain('action="/sites/s1/dsar/d1"');
    expect(html).toContain('name="extend"');
  });

  it("veri sahibi adı HTML'e kaçırılır", () => {
    const html = renderDsarPanelPage({
      siteUrl: "https://musteri1.com",
      siteId: "s1",
      requests: [dsar({ subjectName: '"><script>x()</script>' })],
      now,
    });
    expect(html).not.toContain("<script>x()");
  });
});

describe("anlaşılırlık — DSAR panel dili", () => {
  it("boş durum başvuruların nereden geldiğini söyler", () => {
    const html = renderDsarPanelPage({
      siteUrl: "https://musteri1.com",
      siteId: "s1",
      requests: [],
      now: "2026-10-01T10:00:00.000Z",
    });
    expect(html).toContain("ziyaretçiler sitenin başvuru formundan gönderir");
    expect(html).toContain("yanıt süresini burada izlersiniz");
  });
});
