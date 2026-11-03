import { describe, expect, it } from "vitest";
import { createRateLimiter } from "./rate-limit.js";

describe("createRateLimiter", () => {
  it("limit dahilindeki isteklere izin verir", () => {
    const limiter = createRateLimiter({ max: 3, windowMs: 60_000, now: () => 1_000 });
    expect(limiter.allow("ip1")).toBe(true);
    expect(limiter.allow("ip1")).toBe(true);
    expect(limiter.allow("ip1")).toBe(true);
  });

  it("limit aşılınca reddeder", () => {
    const limiter = createRateLimiter({ max: 2, windowMs: 60_000, now: () => 1_000 });
    limiter.allow("ip1");
    limiter.allow("ip1");
    expect(limiter.allow("ip1")).toBe(false);
  });

  it("pencere sıfırlandığında izin verir", () => {
    let now = 1_000;
    const limiter = createRateLimiter({ max: 1, windowMs: 60_000, now: () => now });
    limiter.allow("ip1");
    expect(limiter.allow("ip1")).toBe(false);
    now = 1_000 + 60_000;
    expect(limiter.allow("ip1")).toBe(true);
  });

  it("anahtarlar birbirinden bağımsızdır", () => {
    const limiter = createRateLimiter({ max: 1, windowMs: 60_000, now: () => 1_000 });
    expect(limiter.allow("ip1")).toBe(true);
    expect(limiter.allow("ip2")).toBe(true);
    expect(limiter.allow("ip1")).toBe(false);
  });

  it("eski girişler budanır (bellek sınırı)", () => {
    let now = 1_000;
    const limiter = createRateLimiter({ max: 5, windowMs: 60_000, now: () => now });
    for (let i = 0; i < 10; i++) {
      limiter.allow(`ip${i}`);
      now += 10_000; // her istek pencereyi taşıyor → eskiler düşmeli
    }
    // 6 pencere boyunca hiçbir anahtar aktif değil
    now += 60_000;
    expect(limiter.allow("ip0")).toBe(true);
  });
});
