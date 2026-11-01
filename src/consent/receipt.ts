import type { ConsentDecisions } from "./state.js";

/**
 * Hash zincirli rıza kanıtı (mur) — ürünün surları.
 * Her rıza kararı, önceki kanıtın hash'ine bağlanan, kendini kapsayan
 * (selfHash) bir kayıttır: tek karar değişikliği, kopukluk veya sıra
 * değişikliği verifyChain'i bozar. Denetimde "kanıtın var mı" sorusunun
 * matematiksel cevabıdır.
 */

export const GENESIS_HASH = "0".repeat(64);

/** Anahtarları özyinelemeli sıralı, boşluksuz JSON — hash girdisi için kanonik form. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
}

export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface ConsentReceipt {
  v: 1;
  ts: string;
  site: string;
  bannerVersion: string;
  /** Gösterilen banner/çerez metinlerinin hash'i — kararın hangi metne verildiğini sabitler. */
  textsHash: string;
  decisions: ConsentDecisions;
  prevHash: string;
  selfHash: string;
}

export interface ConsentReceiptInput {
  site: string;
  bannerVersion: string;
  textsHash: string;
  decisions: ConsentDecisions;
  timestamp?: string;
  prevHash?: string;
}

export async function buildConsentReceipt(input: ConsentReceiptInput): Promise<ConsentReceipt> {
  const prevHash = input.prevHash ?? GENESIS_HASH;
  const base = {
    v: 1 as const,
    ts: input.timestamp ?? new Date().toISOString(),
    site: input.site,
    bannerVersion: input.bannerVersion,
    textsHash: input.textsHash,
    decisions: input.decisions,
    prevHash,
  };
  return { ...base, selfHash: await sha256Hex(canonicalJson(base)) };
}

/** Zinciri uçtan uca doğrular: her selfHash yeniden hesaplanır, bağlar kontrol edilir. */
export async function verifyChain(receipts: readonly ConsentReceipt[]): Promise<boolean> {
  let prev = GENESIS_HASH;
  for (const receipt of receipts) {
    const { selfHash, ...rest } = receipt;
    if ((await sha256Hex(canonicalJson(rest))) !== selfHash) return false;
    if (receipt.prevHash !== prev) return false;
    prev = selfHash;
  }
  return true;
}
