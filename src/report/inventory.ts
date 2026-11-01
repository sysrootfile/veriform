import type { FieldCategory } from "../classifier/types.js";
import type {
  CategoryCount,
  Destination,
  FormInventoryReport,
  ReviewItem,
  RiskFlag,
  ScanInput,
} from "./types.js";

/** URL'e query olarak taşınırsa sızıntı riski doğuran kategoriler. */
const SENSITIVE_CATEGORIES = new Set<FieldCategory>(["tckn", "iban", "card", "passport"]);

/** Bu eşiğin altındaki sınıflandırmalar insan onay kuyruğuna düşer. */
const REVIEW_CONFIDENCE_THRESHOLD = 0.5;

/**
 * Keşif + hedef verisinden müşteri raporu (PII haritası v1) üretir.
 * Saf fonksiyondur: girdi/çıktı JSON-serializable, DOM referansı taşımaz.
 */
export function buildFormInventory(input: ScanInput): FormInventoryReport {
  const siteOrigin = new URL(input.siteUrl).origin;

  const categoryForms = new Map<FieldCategory, number>();
  const destinationForms = new Map<string, number>();
  const riskFlags: RiskFlag[] = [];
  const review: ReviewItem[] = [];
  let fieldCount = 0;

  for (const form of input.forms) {
    fieldCount += form.fields.length;

    const categories = new Set<FieldCategory>();
    for (const f of form.fields) {
      categories.add(f.classification.category);
      if (f.classification.confidence < REVIEW_CONFIDENCE_THRESHOLD) {
        review.push({
          formRef: form.ref,
          fieldName: f.meta.name,
          category: f.classification.category,
          confidence: f.classification.confidence,
          reason: "Sınıflandırma güveni düşük — insan onayı gerekli.",
        });
      }
    }
    for (const category of categories) {
      categoryForms.set(category, (categoryForms.get(category) ?? 0) + 1);
    }

    if (form.target) {
      destinationForms.set(form.target.origin, (destinationForms.get(form.target.origin) ?? 0) + 1);
      if (form.target.origin !== siteOrigin) {
        riskFlags.push({
          formRef: form.ref,
          kind: "cross-origin-target",
          detail: `Form verisi farklı kaynakta bir hedefe gönderiliyor: ${form.target.origin}${form.target.path}`,
        });
      }
      const method = (form.target.method ?? "").toUpperCase();
      if (method === "GET" && [...categories].some((c) => SENSITIVE_CATEGORIES.has(c))) {
        riskFlags.push({
          formRef: form.ref,
          kind: "get-with-sensitive",
          detail:
            "GET metoduyla gönderilen form hassas kategori içeriyor — değerler URL sorgu parametresine yazılır ve sunucu/araç kayıtlarına düşer.",
        });
      }
    }
  }

  const categoryCounts: CategoryCount[] = [...categoryForms.entries()]
    .map(([category, forms]) => ({ category, forms }))
    .sort((a, b) => b.forms - a.forms || a.category.localeCompare(b.category));

  const destinations: Destination[] = [...destinationForms.entries()]
    .map(([origin, forms]) => ({ origin, forms, sameOrigin: origin === siteOrigin }))
    .sort((a, b) => Number(b.sameOrigin) - Number(a.sameOrigin) || b.forms - a.forms);

  return {
    siteOrigin,
    formCount: input.forms.length,
    fieldCount,
    categoryCounts,
    destinations,
    riskFlags,
    review,
  };
}
