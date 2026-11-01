import { classifyField } from "../classifier/field.js";
import type { DiscoveredForm } from "../collector/discover.js";
import { parseRequestTarget } from "../collector/targets.js";
import type { ScannedForm } from "./types.js";

/**
 * Tarayıcı keşif çıktısını (element referanslı) rapor girdisine çevirir:
 * element referansları düşürülür, sınıflandırma uygulanır, form hedefi
 * action'dan çözümlenir. Çıktı JSON-serializable ve değer içermeyendir.
 */
export function snapshotForms(forms: DiscoveredForm[], siteUrl: string): ScannedForm[] {
  return forms.map((form, index) => {
    const target = parseRequestTarget(form.action ?? "", siteUrl);
    if (target) {
      target.via = "form";
      target.method = (form.method ?? "get").toUpperCase();
    }

    return {
      ref: `form-${index}`,
      fields: form.fields.map((f) => ({
        meta: f.meta,
        classification: classifyField(f.meta),
      })),
      target: target ?? undefined,
    };
  });
}
