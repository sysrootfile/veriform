import type { RequestTarget } from "../collector/targets.js";
import type { ConsentReceipt } from "../consent/receipt.js";
import type { DsarRequest, DsarType } from "../dsar/types.js";
import type { FormInventoryReport } from "../report/types.js";
import type { StoredReceiptEntry } from "./chain.js";
import { applyCorrections } from "./corrections.js";
import type { PanelStore } from "./store.js";
import type { ScanCookie, SiteBannerConfig, StoredScan } from "./types.js";

/**
 * Gövde doğrulama — `as never` yerine sınırdaki minimal şekil kontrolü.
 * Geçersiz gövde → IngestError(400).
 */

function requireScanReport(value: unknown): FormInventoryReport {
  if (typeof value !== "object" || value === null) {
    throw new IngestError(400, "geçersiz tarama verisi");
  }
  const r = value as Record<string, unknown>;
  if (
    typeof r.siteOrigin !== "string" ||
    typeof r.formCount !== "number" ||
    !Array.isArray(r.categoryCounts)
  ) {
    throw new IngestError(400, "geçersiz tarama verisi");
  }
  return value as FormInventoryReport;
}

function requireScanArrays(
  cookies: unknown,
  observedTargets: unknown,
): { cookies: ScanCookie[]; observedTargets: RequestTarget[] } {
  const okCookies =
    cookies === undefined || cookies === null
      ? []
      : Array.isArray(cookies) &&
        cookies.every(
          (c) =>
            typeof c === "object" &&
            c !== null &&
            typeof (c as ScanCookie).name === "string" &&
            typeof (c as ScanCookie).domain === "string" &&
            typeof (c as ScanCookie).category === "string",
        );
  const okTargets =
    observedTargets === undefined || observedTargets === null
      ? []
      : Array.isArray(observedTargets) &&
        observedTargets.every(
          (t) =>
            typeof t === "object" &&
            t !== null &&
            typeof (t as RequestTarget).origin === "string" &&
            typeof (t as RequestTarget).path === "string",
        );
  if (!okCookies || !okTargets) {
    throw new IngestError(400, "geçersiz tarama verisi");
  }
  return {
    cookies: (cookies ?? []) as ScanCookie[],
    observedTargets: (observedTargets ?? []) as RequestTarget[],
  };
}

/**
 * Ingest API — embed/scanner'ın veri ittiği yüzey.
 * Kimliklendirme tenant oturumuyla değil **site ingest token'ı** ile yapılır:
 * token'ı bilen, o site adına tarama ve kanıt yükleyebilir. Kiracı işlemleri
 * PanelService'te kalır; bu katman yalnızca makine-iletişimi içindir.
 */

export class IngestError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export interface IngestApi {
  scan(input: {
    token: string;
    /** Doğrulanır — geçersiz şekil 400. */
    report: unknown;
    cookies?: unknown;
    observedTargets?: unknown;
  }): Promise<StoredScan>;
  receipt(input: { token: string; receipt: ConsentReceipt }): Promise<StoredReceiptEntry>;
  dsar(input: {
    token: string;
    type: DsarType;
    subjectName: string;
    subjectEmail: string;
    message?: string | undefined;
  }): Promise<DsarRequest>;
  /** Embed'in banner konfigürasyonunu çekmesi (yoksa null). */
  embedConfig(input: { token: string }): Promise<SiteBannerConfig | null>;
}

export function createIngestApi(store: PanelStore): IngestApi {
  return {
    async scan(input) {
      const site = await store.getSiteByToken(input.token);
      if (!site) throw new IngestError(401, "geçersiz ingest token'ı");
      const { cookies, observedTargets } = requireScanArrays(input.cookies, input.observedTargets);
      const report = requireScanReport(input.report);
      // İnsan onaylı düzeltme haritası: kabul anında rapora uygulanır
      const corrections = await store.listCorrections(site.id);
      const corrected = applyCorrections(report, corrections);
      return store.saveScan({
        siteId: site.id,
        report: corrected,
        cookies,
        observedTargets,
      });
    },

    async receipt(input) {
      const site = await store.getSiteByToken(input.token);
      if (!site) throw new IngestError(401, "geçersiz ingest token'ı");
      try {
        return await store.appendReceipt({ siteId: site.id, receipt: input.receipt });
      } catch (error) {
        // selfHash doğrulama hatası = istemci kanıtı geçersiz → 422
        throw new IngestError(
          422,
          error instanceof Error ? error.message : "kanıt reddedildi",
        );
      }
    },

    async dsar(input) {
      const site = await store.getSiteByToken(input.token);
      if (!site) throw new IngestError(401, "geçersiz ingest token'ı");
      return store.saveDsar({
        siteId: site.id,
        type: input.type,
        subjectName: input.subjectName,
        subjectEmail: input.subjectEmail,
        ...(input.message ? { message: input.message } : {}),
      });
    },

    async embedConfig(input) {
      const site = await store.getSiteByToken(input.token);
      if (!site) throw new IngestError(401, "geçersiz ingest token'ı");
      return site.bannerConfig ?? null;
    },
  };
}
