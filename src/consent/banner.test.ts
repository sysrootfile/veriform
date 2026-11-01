// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
import { renderBanner, type BannerConfig } from "./banner.js";
import { canonicalJson, sha256Hex } from "./receipt.js";

const config: BannerConfig = {
  site: "https://site.com",
  bannerVersion: "banner-2026-11",
  texts: {
    title: "Çerez Tercihleriniz",
    description: "Deneyiminizi iyileştirmek için çerezler kullanılır.",
    acceptAll: "Tümünü Kabul Et",
    rejectAll: "Sadece Zorunlu",
  },
};

beforeEach(() => {
  vi.stubGlobal("crypto", webcrypto);
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("renderBanner", () => {
  it("karar verilmemişse bannerı çizer (başlık + iki karar butonu)", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    renderBanner(container, config);

    expect(container.querySelector('[data-vf="accept"]')?.textContent).toBe("Tümünü Kabul Et");
    expect(container.querySelector('[data-vf="reject"]')?.textContent).toBe("Sadece Zorunlu");
    expect(container.textContent).toContain("Çerez Tercihleriniz");
  });

  it("kabul: rıza verilir, kanıt üretilir, Consent Mode granted olur, banner kalkar", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const onDecision = vi.fn();
    renderBanner(container, config, { onDecision });

    container.querySelector('[data-vf="accept"]')!.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    await vi.waitFor(() => expect(onDecision).toHaveBeenCalledOnce());

    const [receipt, mode] = onDecision.mock.calls[0]!;
    expect(receipt.decisions).toEqual({ analytics: true, marketing: true, personalization: true });
    expect(receipt.site).toBe("https://site.com");
    expect(receipt.bannerVersion).toBe("banner-2026-11");
    expect(receipt.textsHash).toBe(await sha256Hex(canonicalJson(config.texts)));
    expect(mode.analytics_storage).toBe("granted");
    expect(container.querySelector('[data-vf="accept"]')).toBeNull();
  });

  it("reddet: tüm opsiyonel kategoriler kapalı kalır ve kanıt buna göre üretilir", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const onDecision = vi.fn();
    renderBanner(container, config, { onDecision });

    container.querySelector('[data-vf="reject"]')!.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    await vi.waitFor(() => expect(onDecision).toHaveBeenCalledOnce());

    const [receipt, mode] = onDecision.mock.calls[0]!;
    expect(receipt.decisions).toEqual({ analytics: false, marketing: false, personalization: false });
    expect(Object.values(mode)).toEqual(["denied", "denied", "denied", "denied", "denied"]);
  });

  it("kalıcılık: karar localStorage'a yazılır, yeniden render'da banner gösterilmez", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    renderBanner(container, config);
    container.querySelector('[data-vf="accept"]')!.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    await vi.waitFor(() => expect(localStorage.getItem("veriform-consent")).not.toBeNull());

    const second = renderBanner(document.createElement("div"), config);
    expect(second.getDecisions()).toEqual({
      analytics: true,
      marketing: true,
      personalization: true,
    });
    expect(second.rootIsEmpty()).toBe(true);
  });

  it("banner metni değişirse (yeni bannerVersion) yeniden rıza istenir", () => {
    localStorage.setItem(
      "veriform-consent",
      JSON.stringify({
        bannerVersion: "banner-2026-10",
        ts: "2026-10-01T00:00:00.000Z",
        decisions: { analytics: true, marketing: true, personalization: true },
      }),
    );
    const container = document.createElement("div");
    document.body.appendChild(container);
    renderBanner(container, { ...config, bannerVersion: "banner-2026-11" });

    expect(container.querySelector('[data-vf="accept"]')).not.toBeNull();
  });

  it("destroy bannerı DOM'dan kaldırır", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const controller = renderBanner(container, config);
    expect(container.children.length).toBeGreaterThan(0);
    controller.destroy();
    expect(container.children.length).toBe(0);
  });
});
