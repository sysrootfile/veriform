import type { Browser } from "playwright";

/**
 * Paylaşımlı headless tarayıcı — tek süreçte tek örnek (Faz 1'de worker
 * havuzuna genişler). Kurulu Playwright chromium yoksa Windows'ta var olan
 * Edge kanalına düşer (tarayıcı indirme gereksinimini kaldırır).
 * playwright DİNAMİK yüklenir: panel konteynerinde paket yoksa modül
 * yüklemesi kırılmaz, yalnızca tarama rotası nazik 500 döner.
 */
let browserPromise: Promise<Browser> | undefined;

async function launchOnce(): Promise<Browser> {
  const { chromium } = await import("playwright");
  try {
    return await chromium.launch({ headless: true });
  } catch {
    return chromium.launch({ headless: true, channel: "msedge" });
  }
}

export function getSharedBrowser(): Promise<Browser> {
  browserPromise ??= launchOnce();
  return browserPromise;
}

/** Paylaşımlı tarayıcıyı kapatır — süreçli kullanımda (CLI) çıkışı mümkün kılar. */
export async function closeSharedBrowser(): Promise<void> {
  if (!browserPromise) return;
  const browser = await browserPromise;
  browserPromise = undefined;
  await browser.close();
}
