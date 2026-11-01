/**
 * Çerez kategorilendirme — deterministik kural tablosu.
 * Eşleme büyük/küçük harf duyarsızdır (gerçek dünya çerez adı pratikleri için).
 * Bilinmeyen adlar "unknown" döner — yanlış kategori tahmini yapılmaz;
 * bilinmeyenler dashboard'da insan onayına düşer.
 */

export type CookieCategory = "necessary" | "functional" | "analytics" | "marketing" | "unknown";

const RULES: ReadonlyArray<readonly [CookieCategory, RegExp]> = [
  // Oturum, CSRF, CDN/bot koruması, yük dengeleyici
  [
    "necessary",
    /^(phpsessid|jsessionid|asp\.net_sessionid|session_?id|csrftoken|xsrf-token|csrf_token|__cf_bm|cf_clearance|cf_chl[a-z_]*|awsalb(cors)?|incap_ses|visid_incap)$/i,
  ],
  // Dil, tema, onay durumu gibi tercihler
  [
    "functional",
    /^(lang(uage)?|theme|ui-?theme|timezone|tz|wp-settings-\d+|wp-settings-time-\d+|(gdpr|cookie|cc)[_-]?consent|cookieconsent|veriform-consent|eucookie)$/i,
  ],
  // Web analizi
  [
    "analytics",
    /^(_ga|_ga_[a-z0-9-]+|_gid|_gat[a-z0-9_-]*|_hj[a-z0-9_-]*|_pk_[a-z0-9.]+|plausible[a-z0-9_-]*|umami|matomo[a-z0-9_.-]*|_clck|_clsk|ajs_[a-z0-9_]+)$/i,
  ],
  // Reklam/izleme pikselleri
  [
    "marketing",
    /^(_fbp|_fbc|fr|_gcl[a-z0-9_]*|gclid|wbraid|gbraid|_ttp|ttclid|tt_webid[a-z0-9_]*|li_[a-z0-9]+|muid|ide|test_cookie|_scid|__hstc|hubspotutk|_pin_unauth)$/i,
  ],
];

export function classifyCookie(name: string): CookieCategory {
  for (const [category, pattern] of RULES) {
    if (pattern.test(name)) return category;
  }
  return "unknown";
}
