import type { Site } from "../panel/types.js";

/**
 * Sürekli izleme çizelgesi vakti — saf hesap.
 * Kibar yön: belirsizlik durumunda (bozuk tarih) vakti gelmiş sayılır —
 * aşırı tarama, kaçırılmış değişiklikten daha ucuz.
 */

const HOUR_MS = 3_600_000;

export function isDue(
  site: Site,
  lastScanAt: string | undefined,
  nowMs: number,
): boolean {
  const interval = site.scanIntervalHours ?? 0;
  if (interval <= 0) return false;
  if (!lastScanAt) return true;
  const last = new Date(lastScanAt).getTime();
  if (Number.isNaN(last)) return true;
  return nowMs - last >= interval * HOUR_MS;
}
