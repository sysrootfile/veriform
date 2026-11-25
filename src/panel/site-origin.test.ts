import { describe, expect, it } from "vitest";
import { requestOriginAllowed, siteHostOf } from "./site-origin.js";

/**
 * Site anahtarı herkese açık bir kimliktir (sayfa kaynağında görünür);
 * sektör normu (Turnstile/hCaptcha sitekey, CMP domain kilidi) sunucunun
 * tarayıcının Origin/Referer adresini kayıtlı domainle karşılaştırmasıdır.
 */

describe("siteHostOf", () => {
  it("host'u küçük harfe indirger ve www'yi soyar", () => {
    expect(siteHostOf("https://WWW.Musteri1.com/yol")).toBe("musteri1.com");
  });

  it("geçersiz adreste null döner", () => {
    expect(siteHostOf("not-a-url")).toBeNull();
  });
});

describe("requestOriginAllowed", () => {
  const site = "https://musteri1.com";

  it("aynı host'a izin verir", () => {
    expect(requestOriginAllowed(site, "https://musteri1.com", undefined)).toBe(true);
  });

  it("www farkını ve alt domainleri aynı site sayar", () => {
    expect(requestOriginAllowed(site, "https://www.musteri1.com", undefined)).toBe(true);
    expect(requestOriginAllowed(site, "https://blog.musteri1.com", undefined)).toBe(true);
    expect(requestOriginAllowed("https://www.musteri1.com", "https://musteri1.com", undefined)).toBe(true);
  });

  it("başka domaini reddeder", () => {
    expect(requestOriginAllowed(site, "https://evil.com", undefined)).toBe(false);
    expect(requestOriginAllowed(site, "https://musteri1.com.evil.com", undefined)).toBe(false);
    expect(requestOriginAllowed(site, "https://evil-musteri1.com", undefined)).toBe(false);
  });

  it("Origin yoksa Referer'a bakar", () => {
    expect(requestOriginAllowed(site, undefined, "https://musteri1.com/sayfa")).toBe(true);
    expect(requestOriginAllowed(site, undefined, "https://evil.com/sayfa")).toBe(false);
  });

  it("ikisi de yoksa reddeder", () => {
    expect(requestOriginAllowed(site, undefined, undefined)).toBe(false);
  });

  it("bozuk başlık değerleri reddeder", () => {
    expect(requestOriginAllowed(site, "null", undefined)).toBe(false);
    expect(requestOriginAllowed(site, "https://", undefined)).toBe(false);
  });

  it("kayıtlı site adresi bozuksa reddeder", () => {
    expect(requestOriginAllowed("bozuk", "https://musteri1.com", undefined)).toBe(false);
  });
});