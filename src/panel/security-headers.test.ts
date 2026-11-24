import { describe, expect, it } from "vitest";
import { buildSecurityHeaders } from "./security-headers.js";

describe("buildSecurityHeaders", () => {
  it("temel başlıklar her yanıtta: nosniff, DENY, referrer-policy", () => {
    const h = buildSecurityHeaders({ https: false, scriptHashes: [] });
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  });

  it("CSP script-src 'unsafe-inline' içermez; verilen hash'leri taşır", () => {
    const h = buildSecurityHeaders({ https: false, scriptHashes: ["abc123", "def456"] });
    const csp = h["content-security-policy"]!;
    const scriptSrc = csp.split(";").find((d) => d.trim().startsWith("script-src"))!;
    expect(scriptSrc).not.toContain("unsafe-inline");
    expect(scriptSrc).toContain("'self'");
    expect(scriptSrc).toContain("'sha256-abc123'");
    expect(scriptSrc).toContain("'sha256-def456'");
  });

  it("CSP çerçeveleme ve form hedefini kapatır; stil/img/font kaynakları sınırlı", () => {
    const csp = buildSecurityHeaders({ https: false, scriptHashes: [] })["content-security-policy"]!;
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp).toContain("img-src 'self' data: https:");
    expect(csp).toContain("font-src 'self'");
    expect(csp).toContain("connect-src 'self'");
  });

  it("HSTS yalnız https istekte gelir", () => {
    expect(
      buildSecurityHeaders({ https: true, scriptHashes: [] })["strict-transport-security"],
    ).toBe("max-age=15552000; includeSubDomains");
    expect(
      buildSecurityHeaders({ https: false, scriptHashes: [] })["strict-transport-security"],
    ).toBeUndefined();
  });
});