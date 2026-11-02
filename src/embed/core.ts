import { discoverForms } from "../collector/discover.js";
import { observeNetwork, observeSubmissions, type NetworkWindow } from "../collector/observe.js";
import type { RequestTarget } from "../collector/targets.js";
import { renderBanner, type BannerTexts } from "../consent/banner.js";
import type { ConsentReceipt } from "../consent/receipt.js";
import type { ConsentDecisions, OptionalCategory } from "../consent/state.js";
import { installTcfApi, type TcfApiWindow } from "../consent/tcfapi.js";
import { buildFormInventory } from "../report/inventory.js";
import type { FormInventoryReport } from "../report/types.js";
import { snapshotForms } from "../report/snapshot.js";

/**
 * Embed scriptin test-edilebilir çekirdeği: doc/win enjekte edilir,
 * tarayıcı main.ts yalnızca gerçek global'lerle bunu çağırır.
 * Tek script iki kolu taşır: form izleyici + (konfigüre edilirse) rıza bannerı.
 */

/** Canlı hedef ve kanıt kayıtlarının bellek üst sınırı (deterministik budama). */
const MAX_OBSERVED_TARGETS = 200;
const MAX_CONSENT_RECEIPTS = 50;

export interface EmbedHandle {
  /** İlk taramanın (ve güncel durumun) envanter raporu. */
  getReport(): FormInventoryReport;
  /** Gözlemlenen gönderim/ağ hedefleri — append-only, değer içermez. */
  getObservedTargets(): RequestTarget[];
  /** Bu sayfa oturumunda üretilen rıza kanıtları. */
  getConsentReceipts(): ConsentReceipt[];
  /** Tüm gözlemcileri söker. */
  detach(): void;
}

export interface EmbedBannerOptions {
  bannerVersion: string;
  texts: BannerTexts;
  enabledCategories?: OptionalCategory[];
  storageKey?: string;
}

export interface EmbedOptions {
  siteUrl?: string | undefined;
  banner?: EmbedBannerOptions | undefined;
}

export function initVeriform(doc: Document, win: NetworkWindow, options: EmbedOptions = {}): EmbedHandle {
  const siteUrl = options.siteUrl ?? win.location.href;
  // addInitScript document_start anında koşar — DOM henüz boş olabilir.
  // Gözlemciler hemen bağlanır; keşif ve banner DOM hazır olunca yapılır.
  let scanned: ReturnType<typeof snapshotForms> = [];
  if (doc.readyState === "loading") {
    doc.addEventListener(
      "DOMContentLoaded",
      () => {
        scanned = snapshotForms(discoverForms(doc), siteUrl);
      },
      { once: true },
    );
  } else {
    scanned = snapshotForms(discoverForms(doc), siteUrl);
  }
  const observed: RequestTarget[] = [];
  const consentReceipts: ConsentReceipt[] = [];

  const record = (target: RequestTarget): void => {
    if (observed.length >= MAX_OBSERVED_TARGETS) observed.shift();
    observed.push(target);
  };

  const detachSubmissions = observeSubmissions(doc, (n) => record(n.target));
  const detachNetwork = observeNetwork(win, record);
  let detachTcf: (() => void) | undefined;

  const bannerOptions = options.banner;
  if (bannerOptions) {
    // Banner kararları TCF 2.2 __tcfapi yüzeyine akar (amaç 1–11 eşlemesi tcf.ts'te)
    let lastDecisions: ConsentDecisions = {
      analytics: false,
      marketing: false,
      personalization: false,
    };
    const tcf = installTcfApi(win as unknown as TcfApiWindow, () => lastDecisions);
    const mount = () => {
      const host = doc.createElement("div");
      host.setAttribute("data-vf", "banner-host");
      doc.body?.appendChild(host);
      renderBanner(
        host,
        {
          site: siteUrl,
          bannerVersion: bannerOptions.bannerVersion,
          texts: bannerOptions.texts,
          ...(bannerOptions.enabledCategories
            ? { enabledCategories: bannerOptions.enabledCategories }
            : {}),
          ...(bannerOptions.storageKey ? { storageKey: bannerOptions.storageKey } : {}),
        },
        {
          onDecision: (receipt) => {
            lastDecisions = receipt.decisions;
            tcf.notifyChange();
            if (consentReceipts.length >= MAX_CONSENT_RECEIPTS) consentReceipts.shift();
            consentReceipts.push(receipt);
          },
        },
      );
    };
    if (doc.body) mount();
    else doc.addEventListener("DOMContentLoaded", mount, { once: true });
    detachTcf = tcf.detach;
  }

  return {
    getReport: () => buildFormInventory({ siteUrl, forms: scanned }),
    getObservedTargets: () => [...observed],
    getConsentReceipts: () => [...consentReceipts],
    detach: () => {
      detachSubmissions();
      detachNetwork();
      detachTcf?.();
    },
  };
}
