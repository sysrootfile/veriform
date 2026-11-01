/**
 * IBAN doğrulaması — v0 yalnızca TR (26 karakter). Kanonik form bekler:
 * büyük harf, ayraçsız (normalizasyon detectValuePatterns'in sorumluluğu).
 * Algoritma (ISO 13616 / mod-97): ilk 4 karakteri sona taşı, harfleri
 * A=10..Z=35'e çevir, 97'ye göre kalan 1 olmalı.
 */
export function validateIBAN(value: string): boolean {
  if (!/^TR\d{24}$/.test(value)) return false;

  const rearranged = value.slice(4) + value.slice(0, 4);
  let numeric = "";
  for (const ch of rearranged) {
    if (ch >= "0" && ch <= "9") numeric += ch;
    else numeric += String(ch.charCodeAt(0) - 55); // A=10 ... Z=35
  }
  return BigInt(numeric) % 97n === 1n;
}
