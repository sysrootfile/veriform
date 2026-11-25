import { describe, expect, it } from "vitest";
import { resolveClientIp } from "./client-ip.js";

describe("resolveClientIp — proxy arkası limiter anahtarı", () => {
  it("güven kapalıyken soket adresi kullanılır, X-Forwarded-For yok sayılır", () => {
    expect(resolveClientIp("203.0.113.7", "198.51.100.9", false)).toBe("203.0.113.7");
    expect(resolveClientIp("172.18.0.3", "198.51.100.9", false)).toBe("172.18.0.3");
  });

  it("güven açıkken özel ağdaki soket adresi proxy sayılır ve ilk XFF alınır", () => {
    expect(resolveClientIp("172.18.0.3", "198.51.100.9", true)).toBe("198.51.100.9");
    expect(resolveClientIp("10.1.2.3", "198.51.100.9, 10.1.2.3", true)).toBe("198.51.100.9");
    expect(resolveClientIp("192.168.1.5", " 198.51.100.9 , 10.0.0.1 ", true)).toBe("198.51.100.9");
    expect(resolveClientIp("127.0.0.1", "198.51.100.9", true)).toBe("198.51.100.9");
    expect(resolveClientIp("::1", "198.51.100.9", true)).toBe("198.51.100.9");
    expect(resolveClientIp("::ffff:172.18.0.3", "198.51.100.9", true)).toBe("198.51.100.9");
    expect(resolveClientIp("fd00::3", "2001:db8::1", true)).toBe("2001:db8::1");
  });

  it("herkese açık soket adresinden gelen XFF spoofing kabul edilmez", () => {
    expect(resolveClientIp("203.0.113.7", "198.51.100.9", true)).toBe("203.0.113.7");
    expect(resolveClientIp("8.8.8.8", "1.2.3.4", true)).toBe("8.8.8.8");
  });

  it("XFF yoksa/boşsa/IP değilse soket adresine düşer", () => {
    expect(resolveClientIp("172.18.0.3", undefined, true)).toBe("172.18.0.3");
    expect(resolveClientIp("172.18.0.3", "", true)).toBe("172.18.0.3");
    expect(resolveClientIp("172.18.0.3", "   ", true)).toBe("172.18.0.3");
    expect(resolveClientIp("172.18.0.3", "bilinmeyen-kisi", true)).toBe("172.18.0.3");
    expect(resolveClientIp("172.18.0.3", "198.51.100.999", true)).toBe("172.18.0.3");
  });

  it("dizi başlıkta ilk değer okunur; soket adresi yoksa bilinmeyen", () => {
    expect(resolveClientIp("172.18.0.3", ["198.51.100.9", "10.0.0.1"], true)).toBe("198.51.100.9");
    expect(resolveClientIp(undefined, undefined, true)).toBe("bilinmeyen");
    expect(resolveClientIp(undefined, "198.51.100.9", false)).toBe("bilinmeyen");
  });
});