import { validateIBAN } from "./iban.js";
import { validateTCKN } from "./tckn.js";
import type { ValueCategory } from "./types.js";

/** Luhn sağlama toplamı (kart doğrulaması). */
function luhn(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

/**
 * Değer içindeki kişisel veri desenlerini tespit eder.
 * MİMARİ İLKE: yalnızca kategori listesi döner; değer veya türevi asla
 * saklanmaz/iletmez — bu fonksiyon tarayıcıda çalışır ve çıktısı meta veridir.
 */
export function detectValuePatterns(value: string): ValueCategory[] {
  const found: ValueCategory[] = [];

  // TCKN: 11 haneli koşu, iki yanında başka rakam olmayan (16 haneli kart
  // numarası ortasından 11 hane "TCKN" çıkmaz), sağlama toplamı geçen.
  for (const run of value.matchAll(/(?<!\d)\d{11}(?!\d)/g)) {
    if (validateTCKN(run[0])) {
      found.push("tckn");
      break;
    }
  }

  // IBAN: boşluklar temizlenip TR+24 rakam aranır, mod-97 ile doğrulanır.
  const compact = value.replace(/[\s-]/g, "").toUpperCase();
  for (const run of compact.matchAll(/TR\d{24}/g)) {
    if (validateIBAN(run[0])) {
      found.push("iban");
      break;
    }
  }

  // Kart: ayraçlı 13–19 haneli koşu + Luhn. "4111 1111 1111 1111" tek koşu
  // olarak yakalanır; 16 haneli koşu TCKN/telefon kurallarına düşmez.
  for (const run of value.matchAll(/(?<!\d)\d[\d\s-]{11,25}\d(?!\d)/g)) {
    const digits = run[0].replace(/\D/g, "");
    if (digits.length >= 13 && digits.length <= 19 && luhn(digits)) {
      found.push("card");
      break;
    }
  }

  // TR telefonu: 05xx… / +90 5xx… biçimleri, ayraçlı 5xx xxx xx xx.
  if (
    /(?<!\d)(?:\+?90|0)?[\s.()-]*5\d{2}[\s.()-]*\d{3}[\s.()-]*\d{2}[\s.()-]*\d{2}(?!\d)/.test(
      value,
    )
  ) {
    found.push("phone");
  }

  // E-posta
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(value)) {
    found.push("email");
  }

  return found;
}
