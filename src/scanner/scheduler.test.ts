import { describe, expect, it } from "vitest";
import type { Site } from "../panel/types.js";
import { isDue } from "./scheduler.js";

function site(intervalHours?: number): Site {
  return {
    id: "site-1",
    clientId: "c1",
    url: "https://x.com",
    ingestToken: "t".repeat(64),
    ...(intervalHours !== undefined ? { scanIntervalHours: intervalHours } : {}),
    createdAt: "2026-11-01T10:00:00.000Z",
  };
}

const NOW = new Date("2026-11-03T12:00:00.000Z").getTime();

describe("isDue (çizelge vakti)", () => {
  it("çizelge kapalıysa (undefined/0) asla vakti gelmez", () => {
    expect(isDue(site(undefined), undefined, NOW)).toBe(false);
    expect(isDue(site(0), undefined, NOW)).toBe(false);
  });

  it("hiç taranmamış ve çizelge açık → vakti geldi", () => {
    expect(isDue(site(24), undefined, NOW)).toBe(true);
  });

  it("son tarama aralığın içindeyse henüz vakti gelmemiş", () => {
    const lastScan = new Date(NOW - 23 * 3_600_000).toISOString(); // 23 saat önce
    expect(isDue(site(24), lastScan, NOW)).toBe(false);
  });

  it("son tarama aralığı aşmışsa vakti geldi (sınır dahil)", () => {
    const lastScan = new Date(NOW - 24 * 3_600_000).toISOString(); // tam 24 saat
    expect(isDue(site(24), lastScan, NOW)).toBe(true);
    const older = new Date(NOW - 30 * 3_600_000).toISOString();
    expect(isDue(site(24), older, NOW)).toBe(true);
  });

  it("geçersiz lastScan değeri güvenli yönde davranır (taranmamış sayılır)", () => {
    expect(isDue(site(24), "bozuk-tarih", NOW)).toBe(true);
  });
});
