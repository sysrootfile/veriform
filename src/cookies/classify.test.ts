import { describe, expect, it } from "vitest";
import { classifyCookie } from "./classify.js";

describe("classifyCookie", () => {
  it("zorunlu çerezleri tanır (oturum, CSRF, bot koruması)", () => {
    for (const name of ["PHPSESSID", "JSESSIONID", "csrftoken", "__cf_bm", "session_id"]) {
      expect(classifyCookie(name)).toBe("necessary");
    }
  });

  it("analitik çerezleri tanır (GA4 ölçüm kimliği dahil)", () => {
    for (const name of ["_ga", "_ga_G-XYZ123456", "_gid", "_hjSessionUser", "_pk_id.1.443"]) {
      expect(classifyCookie(name)).toBe("analytics");
    }
  });

  it("pazarlama/reklam çerezlerini tanır", () => {
    for (const name of ["_fbp", "_gcl_au", "MUID", "IDE", "_ttp", "gclid", "test_cookie"]) {
      expect(classifyCookie(name)).toBe("marketing");
    }
  });

  it("işlevsel/tercih çerezlerini tanır", () => {
    for (const name of ["lang", "theme", "cookieconsent", "veriform-consent"]) {
      expect(classifyCookie(name)).toBe("functional");
    }
  });

  it("bilinmeyen adları unknown döndürür", () => {
    expect(classifyCookie("ab_test_2026")).toBe("unknown");
    expect(classifyCookie("shopcart")).toBe("unknown");
  });

  it("büyük/küçük harf duyarsız eşleşir (tarayıcı pratikleri için)", () => {
    expect(classifyCookie("PhpSessId")).toBe("necessary");
    expect(classifyCookie("_GA")).toBe("analytics");
  });
});
