import { describe, expect, it } from "vitest";
import {
  computeDeadline,
  daysLeft,
  DSAR_DEADLINE_DAYS,
  extendDeadline,
  isOverdue,
} from "./deadline.js";

const RECEIVED = "2026-11-02T10:00:00.000Z";

describe("DSAR 30 günlük yasal süre (KVKK m.13)", () => {
  it("süre 30 gündür", () => {
    expect(DSAR_DEADLINE_DAYS).toBe(30);
  });

  it("deadline = alım + 30 gün (aynı saat)", () => {
    expect(computeDeadline(RECEIVED)).toBe("2026-12-02T10:00:00.000Z");
  });

  it("daysLeft: tavan fonksiyonla tam gün sayar", () => {
    // 29 gün 23 saat sonra → 1 gün kaldı
    const almost = new Date(new Date(RECEIVED).getTime() + (29 * 24 + 23) * 3600_000).toISOString();
    expect(daysLeft(RECEIVED, almost)).toBe(1);
    // tam 30 gün sonra → 0 (süre bugün doluyor)
    const exact = computeDeadline(RECEIVED);
    expect(daysLeft(RECEIVED, exact)).toBe(0);
    // 31 gün sonra → -1 (geçti)
    const late = new Date(new Date(RECEIVED).getTime() + 31 * 86400_000).toISOString();
    expect(daysLeft(RECEIVED, late)).toBe(-1);
  });

  it("isOverdue: süresi geçmiş ve henüz yanıtlanmamış başvuru", () => {
    const late = new Date(new Date(RECEIVED).getTime() + 31 * 86400_000).toISOString();
    expect(isOverdue(RECEIVED, late, "new")).toBe(true);
    expect(isOverdue(RECEIVED, late, "completed")).toBe(false); // yanıtlanmışsa gecikme sayılmaz
    expect(isOverdue(RECEIVED, computeDeadline(RECEIVED), "new")).toBe(false); // son gün değil
  });

  it("uzatma: tek seferlik +30 gün", () => {
    const deadline = computeDeadline(RECEIVED);
    expect(extendDeadline(deadline)).toBe("2027-01-01T10:00:00.000Z");
  });
});
