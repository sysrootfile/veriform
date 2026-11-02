import type { ConsentDecisions } from "./state.js";

/**
 * TCF 2.2 (IAB Transparency & Consent Framework) amaç katmanı.
 *
 * Kapsam notu (dürüst sınır): bu katman banner kararlarını TCF amaç yapısına
 * eşler ve __tcfapi sinyal yüzeyini sağlar. Gerçek TC String kodlaması ve
 * kayıtlı CMP kimliği, IAB Europe kaydı sonrası eklenir; o zamana kadar
 * tcString boş döner ve consumers bunu "kayıtlı CMP değil" olarak görür.
 */

/** TCF 2.2 amaç 1–11 (kullanıcıya gösterilecek Türkçe adlar). */
export const TCF_PURPOSES: readonly string[] = [
  "Cihazda bilgi saklama ve/veya erişim", // 1 — her zaman gerekli
  "Sınırlı veri ile reklam seçimi", // 2
  "Kişiselleştirilmiş reklam için profil oluşturma", // 3
  "Kişiselleştirilmiş reklam seçimi için profil kullanımı", // 4
  "Kişiselleştirilmiş içerik için profil oluşturma", // 5
  "Kişiselleştirilmiş içerik seçimi için profil kullanımı", // 6
  "Reklam performansını ölçme", // 7
  "İçerik performansını ölçme", // 8
  "Araştırma ve anketlerle pazarı anlama", // 9
  "Hizmetleri geliştirme ve iyileştirme", // 10
  "Sınırlı veri ile içerik seçimi", // 11
];

export const TCF_PURPOSE_COUNT = TCF_PURPOSES.length;

/** Kategori → amaç indeksleri (0 tabanlı; indeks i = amaç i+1). */
const CATEGORY_PURPOSES: Record<keyof ConsentDecisions, number[]> = {
  analytics: [7, 8, 9], // amaçlar 8, 9, 10
  marketing: [1, 2, 3, 6], // amaçlar 2, 3, 4, 7
  personalization: [4, 5, 10], // amaçlar 5, 6, 11
};

export interface TcfPurposeState {
  /** consents[i] = amaç i+1 için açık rıza (amaç 1 her zaman true). */
  consents: boolean[];
  /** v0: meşru menfaat kullanılmıyor — hepsi false. */
  legitimateInterests: boolean[];
}

export function purposesFromDecisions(decisions: ConsentDecisions): TcfPurposeState {
  const consents = new Array<boolean>(TCF_PURPOSE_COUNT).fill(false);
  consents[0] = true; // amaç 1: cihazda saklama/erişim — zorunlu

  for (const category of ["analytics", "marketing", "personalization"] as const) {
    if (!decisions[category]) continue;
    for (const index of CATEGORY_PURPOSES[category]) {
      consents[index] = true;
    }
  }

  return {
    consents,
    legitimateInterests: new Array<boolean>(TCF_PURPOSE_COUNT).fill(false),
  };
}
