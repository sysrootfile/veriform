import { buildConsentReceipt, canonicalJson, sha256Hex, type ConsentReceipt } from "./receipt.js";
import { toConsentModeV2, type ConsentModeV2 } from "./consent-mode.js";
import {
  createConsentState,
  type ConsentDecisions,
  type OptionalCategory,
} from "./state.js";

/**
 * Rıza bannerı — durum makinesi + kanıt + Consent Mode v2'yi birleştiren
 * görünür katman. Kalıcılık localStorage'da; banner metni değişirse
 * (bannerVersion uyuşmazlığı) yeniden rıza istenir.
 */

export interface BannerTexts {
  title: string;
  description: string;
  acceptAll: string;
  rejectAll: string;
}

export interface BannerConfig {
  site: string;
  /** Banner metinlerinin sürümü — değişirse önceki kararlar geçersizleşir. */
  bannerVersion: string;
  texts: BannerTexts;
  enabledCategories?: OptionalCategory[];
  storageKey?: string;
}

export interface BannerCallbacks {
  onDecision?: (receipt: ConsentReceipt, mode: ConsentModeV2) => void;
}

export interface BannerController {
  destroy(): void;
  /** Karar verilmişse kararlar, banner hâlâ açıksa null. */
  getDecisions(): ConsentDecisions | null;
  /** Yeniden render'da bannerın gösterilmediğini test etmek için. */
  rootIsEmpty(): boolean;
}

interface StoredDecision {
  bannerVersion: string;
  ts: string;
  decisions: ConsentDecisions;
}

function readStored(storageKey: string): StoredDecision | undefined {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return undefined;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return undefined;
    const candidate = parsed as { bannerVersion?: unknown; ts?: unknown; decisions?: unknown };
    const d = candidate.decisions as Record<string, unknown> | undefined;
    if (
      typeof candidate.bannerVersion !== "string" ||
      typeof d !== "object" ||
      d === null ||
      typeof d.analytics !== "boolean" ||
      typeof d.marketing !== "boolean" ||
      typeof d.personalization !== "boolean"
    ) {
      return undefined; // bozuk/uyumsuz kayıt: karar yokmuş gibi davran → banner yeniden sorar
    }
    return {
      bannerVersion: candidate.bannerVersion,
      ts: typeof candidate.ts === "string" ? candidate.ts : "",
      decisions: {
        analytics: d.analytics,
        marketing: d.marketing,
        personalization: d.personalization,
      },
    };
  } catch {
    return undefined;
  }
}

function writeStored(storageKey: string, value: StoredDecision): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(value));
  } catch {
    /* saklama başarısız olsa da karar geçerli kalır */
  }
}

export function renderBanner(
  container: HTMLElement,
  config: BannerConfig,
  callbacks: BannerCallbacks = {},
): BannerController {
  const storageKey = config.storageKey ?? "veriform-consent";
  const doc = container.ownerDocument;
  const state = createConsentState(
    config.enabledCategories ? { enabledCategories: config.enabledCategories } : {},
  );

  const stored = readStored(storageKey);
  if (stored && stored.bannerVersion === config.bannerVersion) {
    for (const [category, granted] of Object.entries(stored.decisions)) {
      state.set(category as OptionalCategory, granted);
    }
    return { destroy: () => {}, getDecisions: () => state.getDecisions(), rootIsEmpty: () => true };
  }

  let decided = false;
  const root = doc.createElement("div");
  root.setAttribute("data-vf", "banner-root");
  const title = doc.createElement("strong");
  title.textContent = config.texts.title;
  const description = doc.createElement("p");
  description.textContent = config.texts.description;
  const accept = doc.createElement("button");
  accept.setAttribute("data-vf", "accept");
  accept.textContent = config.texts.acceptAll;
  const reject = doc.createElement("button");
  reject.setAttribute("data-vf", "reject");
  reject.textContent = config.texts.rejectAll;
  root.append(title, description, accept, reject);
  container.appendChild(root);

  const textsHashPromise = sha256Hex(canonicalJson(config.texts));

  async function decide(grantAll: boolean): Promise<void> {
    if (grantAll) state.grantAll();
    else state.denyAll();
    const decisions = state.getDecisions();
    const receipt = await buildConsentReceipt({
      site: config.site,
      bannerVersion: config.bannerVersion,
      textsHash: await textsHashPromise,
      decisions,
    });
    writeStored(storageKey, {
      bannerVersion: config.bannerVersion,
      ts: receipt.ts,
      decisions,
    });
    decided = true;
    root.remove();
    callbacks.onDecision?.(receipt, toConsentModeV2(decisions));
  }

  accept.addEventListener("click", () => void decide(true));
  reject.addEventListener("click", () => void decide(false));

  return {
    destroy: () => root.remove(),
    getDecisions: () => (decided ? state.getDecisions() : null),
    rootIsEmpty: () => !root.isConnected,
  };
}
