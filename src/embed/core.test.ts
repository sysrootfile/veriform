// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { initVeriform, type EmbedHandle } from "./core.js";
import type { NetworkWindow } from "../collector/observe.js";
import type { RequestTarget } from "../collector/targets.js";
import type { BannerTexts } from "../consent/banner.js";
import type { TcfApiFunction } from "../consent/tcfapi.js";

const win = () => window as unknown as NetworkWindow;

beforeEach(() => {
  localStorage.clear();
});

const bannerTexts: BannerTexts = {
  title: "Çerez Tercihleriniz",
  description: "Çerezleri kullanıyoruz.",
  acceptAll: "Tümünü Kabul Et",
  rejectAll: "Sadece Zorunlu",
};

function setupPage(): void {
  document.body.innerHTML = `
    <form action="/uye" method="post">
      <label for="ad">Ad Soyad</label><input id="ad" name="adsoyad">
      <label for="mail">E-Posta</label><input id="mail" name="email" type="email">
      <label for="tc">T.C. Kimlik No</label><input id="tc" name="tcno">
    </form>
    <form action="/bulten" method="post">
      <label for="e2">E-Posta</label><input id="e2" name="email" type="email">
    </form>
  `;
}

describe("initVeriform", () => {
  it("sayfa yüklendiğinde form envanter raporu üretir", () => {
    setupPage();
    const handle: EmbedHandle = initVeriform(document, win());
    const report = handle.getReport();
    expect(report.formCount).toBe(2);
    expect(report.fieldCount).toBe(4);
    expect(report.categoryCounts).toEqual([
      { category: "email", forms: 2 },
      { category: "full_name", forms: 1 },
      { category: "tckn", forms: 1 },
    ]);
    handle.detach();
  });

  it("form submit'i canlı hedef olarak kaydeder", () => {
    setupPage();
    const handle = initVeriform(document, win());
    document.querySelector("form")!.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
    const targets = handle.getObservedTargets();
    expect(targets).toHaveLength(1);
    expect(targets[0]).toMatchObject({ path: "/uye", via: "form", method: "POST" });
    handle.detach();
  });

  it("fetch hedeflerini canlı kaydeder ve detach gözlemi durdurur", async () => {
    setupPage();
    const w = win();
    w.fetch = vi.fn(async () => ({})) as NonNullable<typeof w.fetch>;
    const handle = initVeriform(document, w);

    await w.fetch!("https://api.example.com/v1/lead");

    expect(handle.getObservedTargets()).toContainEqual(
      expect.objectContaining({ path: "/v1/lead", via: "fetch" }),
    );

    handle.detach();
    const before = handle.getObservedTargets().length;
    await w.fetch!("https://api.example.com/v1/other");
    expect(handle.getObservedTargets()).toHaveLength(before);
  });

  it("RAPOR SÖZLEŞMESİ: handle çıktıları değer taşımaz", () => {
    setupPage();
    const handle = initVeriform(document, win());
    const dump = JSON.stringify([handle.getReport(), handle.getObservedTargets()]);
    expect(dump).not.toContain('"value"');
    handle.detach();
  });

  it("document_start anında (readyState=loading) DOMContentLoaded sonrası tarar", () => {
    setupPage();
    Object.defineProperty(document, "readyState", {
      value: "loading",
      configurable: true,
    });
    const handle = initVeriform(document, win());
    expect(handle.getReport().formCount).toBe(0); // henüz taranmadı

    document.dispatchEvent(new Event("DOMContentLoaded"));
    Object.defineProperty(document, "readyState", {
      value: "complete",
      configurable: true,
    });
    expect(handle.getReport().formCount).toBe(2); // DOM hazır olunca tarandı
    handle.detach();
  });

  it("banner verilmezse davranış değişmez ve kanıt listesi boş kalır", () => {
    setupPage();
    const handle = initVeriform(document, win());
    expect(document.querySelector('[data-vf="accept"]')).toBeNull();
    expect(handle.getConsentReceipts()).toEqual([]);
    handle.detach();
  });

  it("banner konfigürasyonu verilirse bannerı çizer ve kararı kanıt olarak toplar", async () => {
    setupPage();
    const handle = initVeriform(document, win(), {
      banner: { bannerVersion: "banner-2026-11", texts: bannerTexts },
    });

    const accept = document.querySelector('[data-vf="accept"]')!;
    expect(accept).not.toBeNull();
    accept.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    await vi.waitFor(() => expect(handle.getConsentReceipts()).toHaveLength(1));
    const receipt = handle.getConsentReceipts()[0]!;
    expect(receipt.decisions).toEqual({
      analytics: true,
      marketing: true,
      personalization: true,
    });
    expect(receipt.site).toBe("http://localhost:3000/");
    expect(document.querySelector('[data-vf="accept"]')).toBeNull(); // banner kalktı
    handle.detach();
  });

  it("document_start anında banner da ertelenir (body henüz yokken mount hatası vermez)", async () => {
    setupPage();
    Object.defineProperty(document, "readyState", {
      value: "loading",
      configurable: true,
    });
    const handle = initVeriform(document, win(), {
      banner: { bannerVersion: "banner-2026-11", texts: bannerTexts },
    });
    document.dispatchEvent(new Event("DOMContentLoaded"));
    Object.defineProperty(document, "readyState", {
      value: "complete",
      configurable: true,
    });

    expect(document.querySelector('[data-vf="accept"]')).not.toBeNull();
    document.querySelector('[data-vf="accept"]')!.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    await vi.waitFor(() => expect(handle.getConsentReceipts()).toHaveLength(1));
    handle.detach();
  });

  it("banner kararı __tcfapi'ye akar: kabul sonrası 11 amaç da granted", async () => {
    setupPage();
    const handle = initVeriform(document, win(), {
      banner: { bannerVersion: "banner-2026-11", texts: bannerTexts },
    });
    document.querySelector('[data-vf="accept"]')!.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    await vi.waitFor(() => expect(handle.getConsentReceipts()).toHaveLength(1));

    const cb = vi.fn();
    (win() as unknown as { __tcfapi: TcfApiFunction }).__tcfapi("getTCData", 2, cb as never);
    const data = cb.mock.calls[0]![0] as { purpose: { consents: boolean[] } };
    expect(data.purpose.consents).toHaveLength(11);
    expect(data.purpose.consents.every((c) => c)).toBe(true);
    handle.detach();
  });
});

describe("onReceipt köprüsü", () => {
  it("her banner kararı callback'e akar (panel gönderimi buna bağlanır)", async () => {
    setupPage();
    const seen: import("../consent/receipt.js").ConsentReceipt[] = [];
    const handle = initVeriform(document, win(), {
      banner: { bannerVersion: "banner-2026-11", texts: bannerTexts },
      onReceipt: (r) => seen.push(r),
    });
    document.querySelector('[data-vf="accept"]')!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await vi.waitFor(() => expect(seen).toHaveLength(1));
    expect(seen[0]!.selfHash).toBe(handle.getConsentReceipts()[0]!.selfHash);
    handle.detach();
  });
});
