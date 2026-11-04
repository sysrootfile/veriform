import { isDue } from "./scheduler.js";
import { diffScans, type ScanDiff } from "./diff.js";
import { buildChangeAlertEmail, shouldNotifyChange } from "../panel/notifications.js";
import { buildEmbedSource, scanSite } from "./scan.js";
import type { FormInventoryReport } from "../report/types.js";
import type { OutgoingEmail } from "../panel/mailer.js";
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
  /** Değişiklik tespit edilip e-posta gönderilen siteler. */
  notified: Array<{ siteId: string; to: string }>;
}

export interface SchedulerRunOptions {
  timeoutMs?: number | undefined;
  /** Değişiklik tespit edilince çağrılır — glue katmanı mail göndericiye bağlar. */
  notifier?: ((email: OutgoingEmail) => Promise<void>) | undefined;
}

export async function runScheduledScans(
  store: PanelStore,
  options: SchedulerRunOptions = {},
): Promise<ScheduledScanOutcome> {
  const sites = await store.listAllSites();
  const now = Date.now();
  const scanned: ScheduledScanOutcome["scanned"] = [];
  const failed: ScheduledScanOutcome["failed"] = [];
  const notified: ScheduledScanOutcome["notified"] = [];

  const embedSource = await buildEmbedSource();

  for (const site of sites) {
    const scans = await store.listScans(site.id);
    const prevScan = scans.at(-1);
    const lastScanAt = prevScan?.scannedAt;
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

      // Değişiklik uyarısı: önceki taramayla diff, değişiklik varsa sahip e-postalanır
      if (options.notifier && prevScan) {
        const diff = diffScans(prevScan, saved);
        if (shouldNotifyChange(diff)) {
          const context = await store.getSiteAlertContext(site.id);
          if (context) {
            const email = buildChangeAlertEmail({
              siteUrl: context.siteUrl,
              diff,
              scannedAt: saved.scannedAt,
              panelUrl: process.env.PANEL_URL,
            });
            if (email) {
              await options.notifier({ to: context.ownerEmail, ...email });
              notified.push({ siteId: site.id, to: context.ownerEmail });
            }
          }
        }
      }
    } catch (error) {
      failed.push({
        siteId: site.id,
        error: error instanceof Error ? error.message : "bilinmeyen hata",
      });
    }
  }

  return { scanned, failed, notified };
}
