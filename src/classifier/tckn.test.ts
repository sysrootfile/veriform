import { describe, expect, it } from "vitest";
import { validateTCKN } from "./tckn.js";

describe("validateTCKN", () => {
  it("geçerli bir TCKN'yi onaylar (bilinen sağlama toplamı örnekleri)", () => {
    // d10 = (7*(d1+d3+d5+d7+d9) - (d2+d4+d6+d8)) mod 10; d11 = toplam mod 10
    expect(validateTCKN("10000000146")).toBe(true);
    expect(validateTCKN("12345678950")).toBe(true);
  });

  it("sağlama toplamı hatalı TCKN'yi reddeder", () => {
    // d10 için gereken değer 5; "12345678901" bunu sağlamıyor
    expect(validateTCKN("12345678901")).toBe(false);
  });

  it("ilk hanesi 0 olan TCKN'yi sağlama doğru olsa bile reddeder", () => {
    expect(validateTCKN("00000000000")).toBe(false);
  });

  it("11 haneden kısa/uzun ve rakam dışı girişleri reddeder", () => {
    expect(validateTCKN("123")).toBe(false);
    expect(validateTCKN("1234567890146")).toBe(false);
    expect(validateTCKN("1234567890a")).toBe(false);
    expect(validateTCKN("")).toBe(false);
  });
});
