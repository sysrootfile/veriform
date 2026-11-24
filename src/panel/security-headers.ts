/** Tüm yanıtlara uygulanan güvenlik başlıkları — saf, test edilir; server yalnızca basar. */
export function buildSecurityHeaders(input: {
  https: boolean;
  scriptHashes: string[];
}): Record<string, string> {
  const scriptSrc = ["'self'", ...input.scriptHashes.map((h) => `'sha256-${h}'`)].join(" ");
  const headers: Record<string, string> = {
    "content-security-policy": [
      "default-src 'self'",
      `script-src ${scriptSrc}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self'",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
    "x-frame-options": "DENY",
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
  };
  // HSTS yalnız TLS üzerinden gelen istekte anlamlı; http'de tarayıcılar yok sayar.
  if (input.https) headers["strict-transport-security"] = "max-age=15552000; includeSubDomains";
  return headers;
}