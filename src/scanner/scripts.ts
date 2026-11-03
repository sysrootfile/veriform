/**
 * Script envanteri sınıflandırması — deterministik kural tablosu.
 * Dürüst çıktı ilkesi (bkz. classifyCookie): bilinmeyenler "third-party-unknown"
 * döner, tahmin yapılmaz; panelde insan onayına düşer.
 */

export type ScriptCategory =
  | "first-party"
  | "analytics"
  | "marketing"
  | "social"
  | "third-party-unknown";

const ANALYTICS = /googletagmanager\.com|google-analytics\.com|\/gtag\.js|hotjar\.com|clarity\.ms|matomo|plausible\.io|segment\.(io|com)\/analytics\.js/i;

const MARKETING = /facebook\.net|doubleclick\.net|googleadservices\.com|tiktok\.com|ads-twitter\.com|bat\.bing\.com|hubspot\.com|adform\.net|criteo\.(com|net)/i;

const SOCIAL = /platform\.(twitter|x)\.com|connect\.facebook\.net\/.*sdk\.js|widget\.(clarity|tawk)\.|disqus\.com|instagram\.com\/embed/i;

export function classifyScript(url: string, siteOrigin: string): ScriptCategory {
  let scriptOrigin: string;
  try {
    scriptOrigin = new URL(url, siteOrigin).origin;
  } catch {
    return "third-party-unknown";
  }
  if (scriptOrigin === new URL(siteOrigin).origin) return "first-party";

  if (MARKETING.test(url)) return "marketing";
  if (ANALYTICS.test(url)) return "analytics";
  if (SOCIAL.test(url)) return "social";
  return "third-party-unknown";
}
