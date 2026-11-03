import type { FieldCategory } from "../classifier/types.js";
import type { FormInventoryReport } from "../report/types.js";

/**
 * İnsan onaylı düzeltme döngüsünün saf çekirdeği:
 * tenant/site düzeyindeki düzeltme haritası, GELECEK taramaların raporlarına
 * uygulanır. Saklanan eski taramalar dokunulmaz — "taranmış gibi" bütünlüğü
 * korunur; categoryCounts da anlık görüntü olarak kalır (yeniden hesaplanmaz).
 */

export interface Correction {
  fieldName: string;
  category: FieldCategory;
}

export function applyCorrections(
  report: FormInventoryReport,
  corrections: readonly Correction[],
): FormInventoryReport {
  if (corrections.length === 0) return report;

  const map = new Map(corrections.map((c) => [c.fieldName, c.category]));

  const forms = report.forms.map((f) => ({
    ...f,
    fields: f.fields.map((field) => {
      const category = map.get(field.name);
      return category ? { ...field, category } : field;
    }),
  }));

  const correctedNames = new Set(map.keys());
  const review = report.review.filter((r) => r.fieldName === undefined || !correctedNames.has(r.fieldName));

  return { ...report, forms, review };
}
