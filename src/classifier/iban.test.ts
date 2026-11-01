import { describe, expect, it } from "vitest";
import { validateIBAN } from "./iban.js";

describe("validateIBAN", () => {
  it("geçerli bir TR IBAN'ı onaylar (ISO 13616 standart örnek vektörü)", () => {
    expect(validateIBAN("TR330006100519786457841326")).toBe(true);
  });

  it("kontrol haneleri bozuk IBAN'ı reddeder (hane dizimi değiştirilmiş)", () => {
    expect(validateIBAN("TR330006100519786457841362")).toBe(false);
  });

  it("TR dışı IBAN'ı v0 kapsamı gereği reddeder", () => {
    // DE89370400440532013000 — Almanya için geçerli IBAN, ama v0 yalnız TR
    expect(validateIBAN("DE89370400440532013000")).toBe(false);
  });

  it("26 karakter olmayan TR girişini reddeder", () => {
    expect(validateIBAN("TR33000610051978645784132")).toBe(false);
    expect(validateIBAN("TR3300061005197864578413266")).toBe(false);
  });

  it("kanonik olmayan formu (küçük harf/boşluk) v0'da reddeder — normalizasyon detectValuePatterns'in işi", () => {
    expect(validateIBAN("tr330006100519786457841326")).toBe(false);
    expect(validateIBAN("TR33 0006 1005 1978 6457 8413 26")).toBe(false);
  });
});
