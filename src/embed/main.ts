import { initVeriform, type EmbedHandle } from "./core.js";
import { createReceiptPusher } from "./push.js";
import type { SiteBannerConfig } from "../panel/types.js";

declare global {
  interface Window {
    __veriform?: EmbedHandle;
  }
}

/**
 * Tarayıcı giriş noktası (IIFE bundle) — test edilebilir tüm mantık core.ts'te.
 * Banner konfigürasyonu varsa panelin /api/embed/config ucundan çekilir
 * (script etiketindeki data-site-token ile kimliklenir), yoksa yalnızca
 * form izleyici kurulur.
 */
const w = window as (Window & typeof globalThis) & { __veriform?: EmbedHandle };

const script = document.currentScript as HTMLScriptElement | null;
const siteToken = script?.getAttribute("data-site-token") ?? "";
const scriptOrigin = script?.src ? new URL(script.src).origin : null;

async function loadBannerConfig(): Promise<
  { bannerVersion: string; texts: { title: string; description: string; acceptAll: string; rejectAll: string } } | null
> {
  if (!scriptOrigin || !siteToken) return null;
  try {
    const res = await fetch(
      `${scriptOrigin}/api/embed/config?token=${encodeURIComponent(siteToken)}`,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { bannerConfig: SiteBannerConfig | null };
    return data.bannerConfig
      ? { bannerVersion: data.bannerConfig.bannerVersion, texts: data.bannerConfig.texts }
      : null;
  } catch {
    return null;
  }
}

(async () => {
  const bannerConfig = await loadBannerConfig();
  const pusher =
    scriptOrigin && siteToken
      ? createReceiptPusher({ panelOrigin: scriptOrigin, token: siteToken })
      : null;
  if (pusher) {
    // Sayfa kapanırken bekleyen kanıtlar beacon'la son şansını kullanır.
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") pusher.flushBeacon();
    });
  }
  const handle = initVeriform(
    document,
    w,
    bannerConfig
      ? {
          banner: { bannerVersion: bannerConfig.bannerVersion, texts: bannerConfig.texts },
          ...(pusher ? { onReceipt: (receipt) => void pusher.push(receipt) } : {}),
        }
      : {},
  );
  w.__veriform = handle;

  console.info("[Veriform] Form envanteri hazır:", handle.getReport());
  if (bannerConfig) console.info("[Veriform] Rıza bannerı etkin.");
  console.info("[Veriform] Canlı hedefler: window.__veriform.getObservedTargets()");
})();
