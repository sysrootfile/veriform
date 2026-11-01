/**
 * TC Kimlik No (TCKN) doğrulaması — yalnızca kanonik form (11 rakam, ayraçsız).
 * Normalizasyon (boşluk/nokta temizliği) detectValuePatterns'in sorumluluğudur.
 * Algoritma: d10 = (7*(d1+d3+d5+d7+d9) - (d2+d4+d6+d8)) mod 10;
 *            d11 = (d1+...+d10) mod 10; ilk hane 0 olamaz.
 */
export function validateTCKN(value: string): boolean {
  if (!/^\d{11}$/.test(value)) return false;
  if (value[0] === "0") return false;

  const digits = [...value].map(Number);
  const odd = digits[0]! + digits[2]! + digits[4]! + digits[6]! + digits[8]!;
  const even = digits[1]! + digits[3]! + digits[5]! + digits[7]!;
  const d10 = (7 * odd - even) % 10;
  if (d10 !== digits[9]) return false;

  const total = digits.slice(0, 10).reduce((sum, d) => sum + d, 0);
  return total % 10 === digits[10];
}
