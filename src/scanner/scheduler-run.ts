import { isDue } from "./scheduler.js";
import { buildEmbedSource, scanSite } from "./scan.js";
import type { FormInventoryReport } from "../report/types.js";
import type { PanelStore } from "../panel/store.js";

/**
 * Sürekli izleme worker'ı: çizelgesi açık ve vakti gelen siteleri tarayıp
 * sonuçları depoya kaydeder. Faz 1'de ayrı worker konteynerine taşınacak —
 * o zamana kadar panel süreci içinde setInterval ile çalıştırılır.
 * Hatalar sonuçta toplanır: tek sitenin çökmesi turu engellemez.
 */

export interface ScheduledScanOutcome {
  scanned: Array<{ siteId: string; scanId: string; report: FormInventoryReport }>;
  failed: Array<{ siteId: string; error: string }>;
}

export async function runScheduledScans(
  store: PanelStore,
  options: { timeoutMs?: number | undefined } = {},
): Promise<ScheduledScanOutcome> {
  const sites = await store.listAllSites();
  const now = Date.now();
  const scanned: ScheduledScanOutcome["scanned"] = [];
  const failed: ScheduledScanOutcome["failed"] = [];

  const embedSource = await buildEmbedSource();

  for (const site of sites) {
    const scans = await store.listScans(site.id);
    const lastScanAt = scans.at(-1)?.scannedAt;
    if (!isDue(site, lastScanAt, now)) continue;

    try {
      const result = await scanSite(site.url, {
        embedSource,
        ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
      });
      const saved = await store.saveScan({
        siteId: site.id,
        report: result.report,
        cookies: result.cookies,
        observedTargets: result.observedTargets,
        scripts: result.scripts,
      });
      scanned.push({ siteId: site.id, scanId: saved.id, report: saved.report });
    } catch (error) {
      failed.push({
        siteId: site.id,
        error: error instanceof Error ? error.message : "bilinmeyen hata",
      });
    }
  }

  return { scanned, failed };
}
