import { describe, expect, it } from "vitest";
import { detectValuePatterns } from "./patterns.js";

describe("detectValuePatterns", () => {
  it("değer içindeki e-postayı tespit eder", () => {
    expect(detectValuePatterns("İletişim: ayse@example.com.tr")).toContain("email");
  });

  it("11 haneli ve sağlaması geçen sayıyı tckn olarak bulur", () => {
    expect(detectValuePatterns("TC: 10000000146 kayıt")).toContain("tckn");
  });

  it("birden çok kategoriyi tek değerde ayırt eder", () => {
    const result = detectValuePatterns("ayse@example.com 10000000146");
    expect(result).toHaveLength(2);
    expect(result).toContain("email");
    expect(result).toContain("tckn");
  });

  it("sağlaması geçmeyen 11 haneli sayıyı tckn saymaz", () => {
    expect(detectValuePatterns("sipariş no 12345678901")).not.toContain("tckn");
  });

  it("TR telefon formatlarını (0 ve +90 önekli) phone olarak bulur", () => {
    expect(detectValuePatterns("tel: 0530 111 22 33")).toContain("phone");
    expect(detectValuePatterns("+90 530 111 22 33")).toContain("phone");
  });

  it("boşluklu kart numarasını yalnızca card olarak bulur (tckn/phone yanlış pozitif yok)", () => {
    expect(detectValuePatterns("4111 1111 1111 1111")).toEqual(["card"]);
  });

  it("Luhn sağlaması geçmeyen 16 haneli sayı kategori üretmez", () => {
    expect(detectValuePatterns("4111111111111112")).toEqual([]);
  });
});
