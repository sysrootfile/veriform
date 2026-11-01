import { describe, expect, it } from "vitest";
import {
  buildConsentReceipt,
  canonicalJson,
  GENESIS_HASH,
  sha256Hex,
  verifyChain,
  type ConsentReceipt,
} from "./receipt.js";

const decisions = { analytics: true, marketing: false, personalization: false };

describe("canonicalJson", () => {
  it("anahtarları özyinelemeli sıralar, boşluksuz üretir", () => {
    expect(canonicalJson({ b: 1, a: { d: 4, c: 3 } })).toBe('{"a":{"c":3,"d":4},"b":1}');
  });
});

describe("sha256Hex", () => {
  it("bilinen NIST test vektörünü doğrular", async () => {
    expect(await sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});

describe("buildConsentReceipt", () => {
  it("ilk kanıt genesis hash'ine bağlanır ve deterministiktir", async () => {
    const input = {
      site: "https://site.com",
      bannerVersion: "banner-2026-11",
      textsHash: "aaa111",
      decisions,
      timestamp: "2026-11-01T10:00:00.000Z",
    };
    const a = await buildConsentReceipt(input);
    const b = await buildConsentReceipt(input);

    expect(a.prevHash).toBe(GENESIS_HASH);
    expect(a.prevHash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.selfHash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.selfHash).toBe(b.selfHash);
    expect(a.ts).toBe("2026-11-01T10:00:00.000Z");
  });

  it("karar değişirse selfHash değişir", async () => {
    const base = {
      site: "https://site.com",
      bannerVersion: "banner-2026-11",
      textsHash: "aaa111",
      timestamp: "2026-11-01T10:00:00.000Z",
    };
    const granted = await buildConsentReceipt({ ...base, decisions });
    const denied = await buildConsentReceipt({
      ...base,
      decisions: { analytics: false, marketing: false, personalization: false },
    });
    expect(granted.selfHash).not.toBe(denied.selfHash);
  });
});

describe("verifyChain", () => {
  async function chainOf(count: number): Promise<ConsentReceipt[]> {
    const receipts: ConsentReceipt[] = [];
    let prev: string | undefined;
    for (let i = 0; i < count; i++) {
      const r = await buildConsentReceipt({
        site: "https://site.com",
        bannerVersion: "banner-2026-11",
        textsHash: "aaa111",
        decisions,
        timestamp: `2026-11-01T10:00:0${i}.000Z`,
        ...(prev !== undefined ? { prevHash: prev } : {}),
      });
      receipts.push(r);
      prev = r.selfHash;
    }
    return receipts;
  }

  it("geçerli zincir doğrulanır", async () => {
    expect(await verifyChain(await chainOf(3))).toBe(true);
  });

  it("kararı değiştirilmiş kanıt zinciri bozar", async () => {
    const receipts = await chainOf(3);
    const tampered: ConsentReceipt[] = structuredClone(receipts);
    tampered[1]!.decisions = { ...tampered[1]!.decisions, marketing: true };
    expect(await verifyChain(tampered)).toBe(false);
  });

  it("kopuk bağ (prevHash uydurma) zinciri bozar", async () => {
    const receipts = await chainOf(2);
    const broken: ConsentReceipt[] = structuredClone(receipts);
    broken[1]!.prevHash = "f".repeat(64);
    expect(await verifyChain(broken)).toBe(false);
  });

  it("sırası değiştirilmiş kanıtlar zinciri bozar", async () => {
    const receipts = await chainOf(3);
    const reordered = [receipts[1]!, receipts[0]!, receipts[2]!];
    expect(await verifyChain(reordered)).toBe(false);
  });

  it("boş zincir geçerlidir", async () => {
    expect(await verifyChain([])).toBe(true);
  });
});
