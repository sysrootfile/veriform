import type { FieldMeta } from "../classifier/types.js";

/**
 * DOM elemanından değer içermeyen alan meta verisi çıkarımı.
 * MİMARİ İLKE: bu fonksiyon .value'ya asla dokunmaz — çıktı FieldMeta'dır
 * ve FieldMeta tipi değer alanı taşımaz (bkz. classifier/types.ts).
 */

/** Etiket çözüm önceliği: label[for] > sarmalayan label > aria-label > aria-labelledby. */
function resolveLabel(el: HTMLElement): string | undefined {
  const id = el.id;
  if (id) {
    const label = el.ownerDocument.querySelector<HTMLLabelElement>(
      `label[for="${CSS.escape(id)}"]`,
    );
    const text = label?.textContent?.trim();
    if (text) return text;
  }

  const wrapping = el.closest("label");
  const wrappingText = wrapping?.textContent?.trim();
  if (wrappingText) return wrappingText;

  const ariaLabel = el.getAttribute("aria-label");
  if (ariaLabel?.trim()) return ariaLabel.trim();

  const labelledby = el.getAttribute("aria-labelledby");
  if (labelledby) {
    for (const refId of labelledby.split(/\s+/)) {
      const ref = el.ownerDocument.getElementById(refId);
      const text = ref?.textContent?.trim();
      if (text) return text;
    }
  }
  return undefined;
}

export function extractFieldMeta(el: HTMLElement): FieldMeta {
  const meta: FieldMeta = {};

  const name = el.getAttribute("name");
  if (name) meta.name = name;
  const id = el.id || undefined;
  if (id) meta.id = id;
  const type = el.getAttribute("type") ?? undefined;
  if (type) meta.type = type;
  const autocomplete = el.getAttribute("autocomplete");
  if (autocomplete) meta.autocomplete = autocomplete;
  if (el.hasAttribute("required")) meta.required = true;

  const placeholder = el.getAttribute("placeholder");
  if (placeholder) meta.placeholder = placeholder;

  const label = resolveLabel(el);
  if (label) meta.label = label;

  return meta;
}
