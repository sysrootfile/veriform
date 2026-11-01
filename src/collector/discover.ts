import type { FieldMeta } from "../classifier/types.js";
import { extractFieldMeta } from "./field-meta.js";

/**
 * Verilen kökteki tüm <form> elemanlarını ve kullanıcı veri alanlarını keşfeder.
 * MİMARİ İLKE: keşif yalnızca meta veri üretir; alan değerleri okunmaz.
 * v0 kapsam notu: yalnızca <form> altındaki alanlar; SPA'da sonradan eklenen
 * formlar MutationObserver ile Faz 1'de eklenir.
 */

/** Değer taşımayan, kullanıcı girdisi olmayan input tipleri. */
const EXCLUDED_INPUT_TYPES = new Set(["submit", "button", "reset", "image", "hidden"]);

export interface DiscoveredField {
  el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
  meta: FieldMeta;
}

export interface DiscoveredForm {
  form: HTMLFormElement;
  fields: DiscoveredField[];
  action?: string | undefined;
  method?: string | undefined;
}

export function discoverForms(root: Document | HTMLElement): DiscoveredForm[] {
  const result: DiscoveredForm[] = [];

  for (const form of root.querySelectorAll("form")) {
    const fields: DiscoveredField[] = [];

    for (const el of form.querySelectorAll("input, select, textarea")) {
      if (!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement)) {
        continue;
      }
      if (el instanceof HTMLInputElement && EXCLUDED_INPUT_TYPES.has(el.type)) continue;
      fields.push({ el, meta: extractFieldMeta(el) });
    }

    const action = form.getAttribute("action");
    const method = form.getAttribute("method");
    result.push({
      form,
      fields,
      action: action ?? undefined,
      method: method ? method.toLocaleLowerCase("tr") : undefined,
    });
  }

  return result;
}
