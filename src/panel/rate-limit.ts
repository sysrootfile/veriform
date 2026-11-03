/**
 * Sabit pencereli hız sınırı — kamu uçlar için minimal koruma.
 * Saf zaman enjeksiyonu: test edilebilir; prod'da now verilmez (Date.now).
 * Uç değiştirilebilir worker/kuyruk mimarisine geçilince bu modül
 * Redis tabanlı sürümle değiştirilir.
 */

export interface RateLimiterOptions {
  max: number;
  windowMs: number;
  /** Test için zaman enjeksiyonu. */
  now?: () => number;
}

export interface RateLimiter {
  allow(key: string): boolean;
}

export function createRateLimiter(options: RateLimiterOptions): RateLimiter {
  const now = options.now ?? Date.now;
  const hits = new Map<string, number[]>();

  return {
    allow(key) {
      const t = now();
      const windowStart = t - options.windowMs;
      const timestamps = (hits.get(key) ?? []).filter((ts) => ts > windowStart);
      if (timestamps.length >= options.max) {
        hits.set(key, timestamps);
        return false;
      }
      timestamps.push(t);
      hits.set(key, timestamps);
      // Budama: tamamen boşalan anahtarları sil (bellek sınırı)
      if (hits.size > 10_000) {
        for (const [k, ts] of hits) {
          if (ts.every((v) => v <= windowStart)) hits.delete(k);
        }
      }
      return true;
    },
  };
}
