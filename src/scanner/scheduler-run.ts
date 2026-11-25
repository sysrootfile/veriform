import { isDue } from "./scheduler.js";
import { diffScans, type ScanDiff } from "./diff.js";
import { buildChangeAlertEmail, shouldNotifyChange } from "../panel/notifications.js";
import { buildEmbedSource, scanSite, type ScanResult } from "./scan.js";
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

/** Tarama işinin yüzeyi — testlerde tarayıcısız sahte sürümle değiştirilir. */
export type SiteScanner = (url: string) => Promise<ScanResult>;

export interface SchedulerRunOptions {
  timeoutMs?: number | undefined;
  /** Değişiklik tespit edilince çağrılır — glue katmanı mail göndericiye bağlar. */
  notifier?: ((email: OutgoingEmail) => Promise<void>) | undefined;
  /** Test için zaman enjeksiyonu (varsayılan Date.now). */
  now?: (() => number) | undefined;
  /** Notifier hataları yutulmaz — testlerde gözlemlenebilir. */
  throwOnNotifierError?: boolean | undefined;
  /** Varsayılan: embed kaynağını üretip gerçek headless tarayıcıyla tarama. */
  scan?: SiteScanner | undefined;
}

export async function runScheduledScans(
  store: PanelStore,
  options: SchedulerRunOptions = {},
): Promise<ScheduledScanOutcome> {
  // Embed kaynağı yalnızca gerçek tarayıcı yolu kullanıldığında üretilir.
  const scan: SiteScanner =
    options.scan ??
    ((url) =>
      buildEmbedSource().then((embedSource) =>
        scanSite(url, {
          embedSource,
          ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
        }),
      ));

  const sites = await store.listAllSites();
  const nowMs = (options.now ?? Date.now)();
  const scanned: ScheduledScanOutcome["scanned"] = [];
  const failed: ScheduledScanOutcome["failed"] = [];
  const notified: ScheduledScanOutcome["notified"] = [];

  for (const site of sites) {
    const scans = await store.listAllScans(site.id);
    const prevScan = scans.at(-1);
    const lastScanAt = prevScan?.scannedAt;
    if (!isDue(site, lastScanAt, nowMs)) continue;

    try {
      const result = await scan(site.url);
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
        try {
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
        } catch (error) {
          if (options.throwOnNotifierError) throw error;
          // notifier hatası tarama turunu engellemez — sonraki tur tekrar dener
          console.error("[sched] uyarı e-postası gönderilemedi:", error);
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
