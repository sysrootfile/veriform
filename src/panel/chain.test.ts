import { describe, expect, it } from "vitest";
import { buildConsentReceipt, GENESIS_HASH } from "../consent/receipt.js";
import {
  makeChainEntry,
  receiptsToCsv,
  verifyReceiptSelfHash,
  verifyStoredChain,
  type StoredReceiptEntry,
} from "./chain.js";

const decisions = { analytics: true, marketing: false, personalization: false };

function receiptInput(ts: string, prevHash?: string) {
  return {
    site: "https://site.com",
    bannerVersion: "banner-2026-11",
    textsHash: "aaa111",
    decisions,
    timestamp: ts,
    ...(prevHash !== undefined ? { prevHash } : {}),
  };
}

describe("verifyReceiptSelfHash", () => {
  it("geçerli kanıtın selfHash'i doğrulanır", async () => {
    const r = await buildConsentReceipt(receiptInput("2026-11-01T10:00:00.000Z"));
    expect(await verifyReceiptSelfHash(r)).toBe(true);
  });

  it("selfHash kurcalanan kanıt reddedilir", async () => {
    const r = await buildConsentReceipt(receiptInput("2026-11-01T10:00:00.000Z"));
    expect(await verifyReceiptSelfHash({ ...r, selfHash: "f".repeat(64) })).toBe(false);
  });
});

describe("verifyStoredChain (sunucu tarafı zincir)", () => {
  async function validEntries(count: number): Promise<StoredReceiptEntry[]> {
    const entries: StoredReceiptEntry[] = [];
    let prev: string | undefined;
    for (let i = 0; i < count; i++) {
      const receipt = await buildConsentReceipt(
        receiptInput(`2026-11-01T10:00:0${i}.000Z`),
      );
      const entry = await makeChainEntry("site-1", receipt, prev);
      entries.push(entry);
      prev = entry.chainHash;
    }
    return entries;
  }

  it("sunucu zinciri uçtan uca doğrulanır", async () => {
    expect(await verifyStoredChain(await validEntries(3))).toBe(true);
  });

  it("client kanıtı kurcalanınca (selfHash) zincir reddedilir", async () => {
    const entries = await validEntries(2);
    const tampered: StoredReceiptEntry[] = structuredClone(entries);
    tampered[0]!.receipt = { ...tampered[0]!.receipt, decisions: { ...decisions, marketing: true } };
    expect(await verifyStoredChain(tampered)).toBe(false);
  });

  it("chainHash kurcalanınca zincir reddedilir", async () => {
    const entries = await validEntries(2);
    const tampered: StoredReceiptEntry[] = structuredClone(entries);
    tampered[1]!.chainHash = "a".repeat(64);
    expect(await verifyStoredChain(tampered)).toBe(false);
  });

  it("kopuk bağ (prevChainHash) zinciri reddeder", async () => {
    const entries = await validEntries(2);
    const broken: StoredReceiptEntry[] = structuredClone(entries);
    broken[1]!.prevChainHash = "b".repeat(64);
    expect(await verifyStoredChain(broken)).toBe(false);
  });

  it("ilk giriş genesis'e bağlıdır", async () => {
    const entries = await validEntries(1);
    expect(entries[0]!.prevChainHash).toBe(GENESIS_HASH);
  });

  it("boş zincir geçerlidir", async () => {
    expect(await verifyStoredChain([])).toBe(true);
  });
});

describe("receiptsToCsv (kanıt ihracı)", () => {
  it("başlık + zincir girişlerini CSV olarak üretir", async () => {
    const receipt = await buildConsentReceipt(receiptInput("2026-11-02T10:00:00.000Z"));
    const entry = await makeChainEntry("site-1", receipt);
    const csv = receiptsToCsv([entry]);
    expect(csv.startsWith("id,received_at,site_id,site,self_hash,prev_chain_hash,chain_hash\n")).toBe(true);
    expect(csv).toContain(entry.id);
    expect(csv).toContain(entry.chainHash);
  });

  it("CSV özel karakterleri kaçırır (tırnak/virgül)", async () => {
    const receipt = await buildConsentReceipt({
      ...receiptInput("2026-11-02T10:00:00.000Z"),
      site: 'https://x.com,"a,b"',
    });
    const entry = await makeChainEntry("site-1", receipt);
    const csv = receiptsToCsv([entry]);
    // tırnak içi tırnak çiftlenir — sütun sayısı bozulmaz
    expect(csv).toContain('"https://x.com,""a,b"""');
  });

  it("boş liste yalnızca başlığı döndürür", () => {
    expect(receiptsToCsv([])).toBe("id,received_at,site_id,site,self_hash,prev_chain_hash,chain_hash\n");
  });
});
