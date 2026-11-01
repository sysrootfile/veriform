import type { FieldClassification, FieldCategory, FieldMeta } from "./types.js";

/**
 * Form alanı meta verisinden kişisel veri kategorisi tahmini.
 * Girdi asla alan değeri değildir — yalnızca name/label/type gibi meta veri.
 * Eşleşme TR büyük/küçük harf duyarsız (toLocaleLowerCase("tr")).
 */

interface TextRule {
  category: FieldCategory;
  re: RegExp;
  confidence: number;
}

// Öncelik sırası = dizi sırası; aynı metin birden çok kuralı yakalarsa
// önceki kural kazanır.
const TEXT_RULES: TextRule[] = [
  { category: "tckn", re: /t\.?c\.?\s?kimlik|tckn|kimlik no|tc\s?no/, confidence: 0.9 },
  { category: "iban", re: /iban/, confidence: 0.9 },
  { category: "email", re: /e-?posta|eposta|e-?mail/, confidence: 0.9 },
  { category: "phone", re: /telefon|cep\s?(no|tel)|gsm|phone|tel\s?no/, confidence: 0.9 },
  {
    category: "full_name",
    re: /ad\s?soyad|adiniz soyadiniz|isim soyisim|full\s?name/,
    confidence: 0.8,
  },
  {
    category: "birthdate",
    re: /dogum\s?tarihi|birth\s?(date|day)|date\s?of\s?birth/,
    confidence: 0.9,
  },
  { category: "address", re: /adres|address/, confidence: 0.9 },
  { category: "passport", re: /pasaport|passport/, confidence: 0.9 },
];

const TYPE_RULES: Array<{ category: FieldCategory; type: string; confidence: number }> = [
  { category: "email", type: "email", confidence: 0.9 },
  { category: "phone", type: "tel", confidence: 0.85 },
];

const AUTOCOMPLETE_RULES: Array<{
  category: FieldCategory;
  autocomplete: string;
  confidence: number;
}> = [{ category: "email", autocomplete: "email", confidence: 0.9 }];

/**
 * Türkçe büyük/küçük harf tuzağına karşı ASCII katlama: tr-locale küçültme
 * sonrası ı→i, ş→s vb. eşleme — "IBAN" → "iban", "DOĞUM" → "dogum" olur.
 * Kurallar bu yüzden yalnızca ASCII desenlidir.
 */
const norm = (s: string | undefined): string =>
  (s?.toLocaleLowerCase("tr") ?? "")
    .replace(/ı/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c");

export function classifyField(meta: FieldMeta): FieldClassification {
  const signals: string[] = [];
  let best: { category: FieldCategory; confidence: number } | undefined;

  const consider = (category: FieldCategory, confidence: number, signal: string) => {
    signals.push(signal);
    if (!best || confidence > best.confidence) {
      best = { category, confidence };
    }
  };

  if (meta.type) {
    for (const rule of TYPE_RULES) {
      if (meta.type === rule.type) consider(rule.category, rule.confidence, `type:${rule.type}`);
    }
  }
  if (meta.autocomplete) {
    for (const rule of AUTOCOMPLETE_RULES) {
      if (meta.autocomplete === rule.autocomplete) {
        consider(rule.category, rule.confidence, `autocomplete:${rule.autocomplete}`);
      }
    }
  }

  const text = [norm(meta.name), norm(meta.id), norm(meta.label), norm(meta.placeholder)]
    .filter(Boolean)
    .join(" ");
  for (const rule of TEXT_RULES) {
    const match = text.match(rule.re);
    if (match) consider(rule.category, rule.confidence, `text:${match[0]}`);
  }

  if (!best) return { category: "free_text", confidence: 0.1, signals };
  return { category: best.category, confidence: best.confidence, signals };
}
