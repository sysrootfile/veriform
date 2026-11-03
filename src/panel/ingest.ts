import type { RequestTarget } from "../collector/targets.js";
import type { ConsentReceipt } from "../consent/receipt.js";
import type { DsarRequest, DsarType } from "../dsar/types.js";
import type { FormInventoryReport } from "../report/types.js";
import type { StoredReceiptEntry } from "./chain.js";
import type { PanelStore } from "./store.js";
import type { ScanCookie, SiteBannerConfig, StoredScan } from "./types.js";

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
    report: FormInventoryReport;
    cookies: ScanCookie[];
    observedTargets: RequestTarget[];
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
      return store.saveScan({
        siteId: site.id,
        report: input.report,
        cookies: input.cookies,
        observedTargets: input.observedTargets,
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
