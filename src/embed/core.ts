import { discoverForms } from "../collector/discover.js";
import { observeNetwork, observeSubmissions, type NetworkWindow } from "../collector/observe.js";
import type { RequestTarget } from "../collector/targets.js";
import { buildFormInventory } from "../report/inventory.js";
import type { FormInventoryReport } from "../report/types.js";
import { snapshotForms } from "../report/snapshot.js";

/**
 * Embed scriptin test-edilebilir çekirdeği: doc/win enjekte edilir,
 * tarayıcı main.ts yalnızca gerçek global'lerle bunu çağırır.
 */

/** Canlı hedef kaydının bellek üst sınırı (deterministik budama). */
const MAX_OBSERVED_TARGETS = 200;

export interface EmbedHandle {
  /** İlk taramanın (ve güncel durumun) envanter raporu. */
  getReport(): FormInventoryReport;
  /** Gözlemlenen gönderim/ağ hedefleri — append-only, değer içermez. */
  getObservedTargets(): RequestTarget[];
  /** Tüm gözlemcileri söker. */
  detach(): void;
}

export interface EmbedOptions {
  siteUrl?: string | undefined;
}

export function initVeriform(doc: Document, win: NetworkWindow, options: EmbedOptions = {}): EmbedHandle {
  const siteUrl = options.siteUrl ?? win.location.href;
  const scanned = snapshotForms(discoverForms(doc), siteUrl);
  const observed: RequestTarget[] = [];

  const record = (target: RequestTarget): void => {
    if (observed.length >= MAX_OBSERVED_TARGETS) observed.shift();
    observed.push(target);
  };

  const detachSubmissions = observeSubmissions(doc, (n) => record(n.target));
  const detachNetwork = observeNetwork(win, record);

  return {
    getReport: () => buildFormInventory({ siteUrl, forms: scanned }),
    getObservedTargets: () => [...observed],
    detach: () => {
      detachSubmissions();
      detachNetwork();
    },
  };
}
