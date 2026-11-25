import { describe, expect, it } from "vitest";
import { mailBaseUrl, resolvePanelUrl } from "./runtime-config.js";

describe("mailBaseUrl (hesap maillerindeki bağlantıların kökü)", () => {
  it("istek Host başlığı yerine yapılandırılan PANEL_URL kullanılır", () => {
    const panelUrl = resolvePanelUrl({ DATABASE_URL: "postgres://x", PANEL_URL: "https://panel.test" });
    expect(mailBaseUrl(panelUrl, 4620)).toBe("https://panel.test");
  });

  it("geliştirme modunda yerel makine adresi kullanılır", () => {
    expect(mailBaseUrl(null, 4620)).toBe("http://127.0.0.1:4620");
  });
});

describe("resolvePanelUrl (mail bağlantılarının kök adresi)", () => {
  it("Postgres modunda PANEL_URL zorunludur", () => {
    expect(() => resolvePanelUrl({ DATABASE_URL: "postgres://x" })).toThrow(/PANEL_URL/);
  });

  it("yapılandırılmış adres sondaki eğik çizgiden arındırılır", () => {
    expect(resolvePanelUrl({ DATABASE_URL: "postgres://x", PANEL_URL: " https://panel.test/ " })).toBe(
      "https://panel.test",
    );
  });

  it.each(["not a url", "ftp://panel.test", "https://kullanici:sifre@panel.test", "https://panel.test?x=1"])(
    "geçersiz adres açılışı durdurur: %s",
    (panelUrl) => {
      expect(() => resolvePanelUrl({ DATABASE_URL: "postgres://x", PANEL_URL: panelUrl })).toThrow(/PANEL_URL/);
    },
  );

  it("geliştirme (in-memory) modunda PANEL_URL isteğe bağlıdır", () => {
    expect(resolvePanelUrl({})).toBeNull();
  });
});
