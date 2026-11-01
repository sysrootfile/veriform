import { describe, expect, it } from "vitest";
import { parseRequestTarget } from "./targets.js";

describe("parseRequestTarget", () => {
  it("mutlak URL'den origin+path çıkarır; query ve hash'i atar", () => {
    const t = parseRequestTarget("https://api.example.com/v1/collect?a=1&b=2#frag");
    expect(t).toEqual({ origin: "https://api.example.com", path: "/v1/collect" });
  });

  it("göreli URL'yi base'e göre çözümler", () => {
    const t = parseRequestTarget("/api/save?x=1", "https://site.com");
    expect(t).toEqual({ origin: "https://site.com", path: "/api/save" });
  });

  it("GIZLİLİK: query parametresindeki değer asla çıktıya sızmaz", () => {
    // GET form gönderimi değerleri URL'e yazar — hedef kaydı bunu taşımamalı
    const t = parseRequestTarget("https://site.com/kayit?tcno=10000000146");
    expect(t).toEqual({ origin: "https://site.com", path: "/kayit" });
    expect(JSON.stringify(t)).not.toContain("10000000146");
    expect(JSON.stringify(t)).not.toContain("tcno");
  });

  it("çözümlenemeyen giriş için undefined döner", () => {
    expect(parseRequestTarget("bu bir url değil")).toBeUndefined();
  });
});
