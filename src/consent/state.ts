/**
 * Rıza durum makinesi — KVKK açık rıza ilkesine göre varsayılan reddet.
 * Zorunlu (necessary) kategori her zaman açıktır ve kapatılamaz.
 */

export type ConsentCategory = "necessary" | "analytics" | "marketing" | "personalization";

/** Zorunlu hariç kategoriler — rıza kararı yalnızca bunlar için alınır. */
export type OptionalCategory = Exclude<ConsentCategory, "necessary">;

export type ConsentDecisions = Record<OptionalCategory, boolean>;

const OPTIONAL_CATEGORIES: readonly OptionalCategory[] = [
  "analytics",
  "marketing",
  "personalization",
];

export interface ConsentState {
  isGranted(category: ConsentCategory): boolean;
  /** necessary yoksayılır — her zaman açıktır. */
  set(category: ConsentCategory, granted: boolean): void;
  grantAll(): void;
  denyAll(): void;
  getDecisions(): ConsentDecisions;
}

export interface ConsentStateConfig {
  /** grantAll ile açılacak kategoriler (varsayılan: tüm opsiyonel kategoriler). */
  enabledCategories?: OptionalCategory[];
}

export function createConsentState(config: ConsentStateConfig = {}): ConsentState {
  const enabled = new Set<OptionalCategory>(
    config.enabledCategories ?? OPTIONAL_CATEGORIES,
  );
  const decisions: ConsentDecisions = {
    analytics: false,
    marketing: false,
    personalization: false,
  };

  return {
    isGranted(category) {
      return category === "necessary" ? true : decisions[category];
    },
    set(category, granted) {
      if (category === "necessary") return;
      if (!enabled.has(category)) return;
      decisions[category] = granted;
    },
    grantAll() {
      for (const category of enabled) decisions[category] = true;
    },
    denyAll() {
      for (const category of OPTIONAL_CATEGORIES) decisions[category] = false;
    },
    getDecisions() {
      return { ...decisions };
    },
  };
}
