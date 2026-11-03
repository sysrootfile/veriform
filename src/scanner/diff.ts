import type { StoredScan } from "../panel/types.js";

/**
 * Değişiklik uyarısı (spec: "yeni form/alan eklendi") — iki tarama arasındaki
 * farkı hesaplar. v0 eşleme anahtarı formRef'tir (form-<sıra>); sayfa yapısı
 * büyük ölçüde değişirse ref'ler kayar ve tüm formlar yeniden sayılır —
 * kibar davranış: aşırı uyarı, kaçırma yok (KVKK tarafı için güvenli yön).
 */

export interface ScanDiff {
  isFirstScan: boolean;
  newForms: Array<{ formRef: string; newFieldNames: string[] }>;
  removedFormRefs: string[];
  newCookieCategories: string[];
}

function formFingerprint(scan: StoredScan): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const f of scan.report.forms) {
    map.set(
      f.ref,
      f.fields.map((field) => field.name),
    );
  }
  return map;
}

export function diffScans(previous: StoredScan | null, current: StoredScan): ScanDiff {
  if (!previous) {
    return { isFirstScan: true, newForms: [], removedFormRefs: [], newCookieCategories: [] };
  }

  const prevForms = formFingerprint(previous);
  const currForms = formFingerprint(current);
  const newForms: Array<{ formRef: string; newFieldNames: string[] }> = [];

  for (const [ref, fieldNames] of currForms) {
    const prevFields = prevForms.get(ref);
    if (prevFields === undefined) {
      newForms.push({ formRef: ref, newFieldNames: [...fieldNames] });
    } else {
      const added = fieldNames.filter((name) => !prevFields.includes(name));
      if (added.length) newForms.push({ formRef: ref, newFieldNames: added });
    }
  }

  const removedFormRefs = [...prevForms.keys()].filter((ref) => !currForms.has(ref));

  const prevCookieCategories = new Set(previous.cookies.map((c) => c.category));
  const newCookieCategories = [
    ...new Set(
      current.cookies
        .map((c) => c.category)
        .filter((category) => !prevCookieCategories.has(category)),
    ),
  ];

  return { isFirstScan: false, newForms, removedFormRefs, newCookieCategories };
}
