import { chromium, type Browser } from "playwright";

/**
 * Paylaşımlı headless tarayıcı — tek süreçte tek örnek (Faz 1'de worker
 * havuzuna genişler). Kurulu Playwright chromium yoksa Windows'ta var olan
 * Edge kanalına düşer (tarayıcı indirme gereksinimini kaldırır).
 */
let browserPromise: Promise<Browser> | undefined;

async function launchOnce(): Promise<Browser> {
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
