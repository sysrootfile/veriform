import { describe, expect, it } from "vitest";
import { purposesFromDecisions, TCF_PURPOSE_COUNT, TCF_PURPOSES } from "./tcf.js";

const decisions = { analytics: true, marketing: false, personalization: false };

describe("TCF 2.2 amaç modeli", () => {
  it("11 amaç tanımlıdır ve adları Türkçedir", () => {
    expect(TCF_PURPOSE_COUNT).toBe(11);
    expect(TCF_PURPOSES).toHaveLength(11);
    const lower = (s: string) => s.toLocaleLowerCase("tr");
    expect(lower(TCF_PURPOSES[0]!)).toContain("cihaz");
    expect(lower(TCF_PURPOSES[1]!)).toContain("reklam");
  });

  it("amaç 1 (cihazda saklama/erişim) zorunlu kategoriyle her zaman onaylıdır", () => {
    const { consents } = purposesFromDecisions({
      analytics: false,
      marketing: false,
      personalization: false,
    });
    expect(consents[0]).toBe(true);
    expect(consents.slice(1).every((c) => c === false)).toBe(true);
  });

  it("marketing → amaçlar 2,3,4,7", () => {
    const { consents } = purposesFromDecisions({
      analytics: false,
      marketing: true,
      personalization: false,
    });
    expect(consents[1]).toBe(true); // amaç 2
    expect(consents[2]).toBe(true); // amaç 3
    expect(consents[3]).toBe(true); // amaç 4
    expect(consents[6]).toBe(true); // amaç 7
    expect(consents[7]).toBe(false); // amaç 8
    expect(consents[4]).toBe(false); // amaç 5
  });

  it("analytics → amaçlar 8,9,10; personalization → 5,6,11", () => {
    const a = purposesFromDecisions({ analytics: true, marketing: false, personalization: false });
    expect([7, 8, 9].map((i) => a.consents[i])).toEqual([true, true, true]);
    expect(a.consents[1]).toBe(false);

    const p = purposesFromDecisions({ analytics: false, marketing: false, personalization: true });
    expect([4, 5, 10].map((i) => p.consents[i])).toEqual([true, true, true]);
    expect(p.consents[1]).toBe(false);
  });

  it("grantAll durumunda 11 amaçın tamamı onaylıdır", () => {
    const { consents } = purposesFromDecisions({
      analytics: true,
      marketing: true,
      personalization: true,
    });
    expect(consents.every((c) => c === true)).toBe(true);
  });

  it("meşru menfaat v0'da kullanılmaz — tüm dizi false", () => {
    const { legitimateInterests } = purposesFromDecisions({
      analytics: true,
      marketing: true,
      personalization: true,
    });
    expect(legitimateInterests).toHaveLength(11);
    expect(legitimateInterests.every((li) => li === false)).toBe(true);
  });
});
