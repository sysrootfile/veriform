import type { RequestTarget } from "../collector/targets.js";
import type { ConsentReceipt } from "../consent/receipt.js";
import type { FormInventoryReport } from "../report/types.js";

/** Ajans paneli alan modeli — tenant→client→site hiyerarşisi. */

export type TenantKind = "agency" | "direct";

export interface Tenant {
  id: string;
  name: string;
  kind: TenantKind;
  /** White-label vurgu rengi — yalnızca #rrggbb biçimi kabul edilir. */
  brandColor?: string | undefined;
  /** White-label logosu — yalnızca http(s) URL kabul edilir. */
  brandLogoUrl?: string | undefined;
  createdAt: string;
}

export interface Client {
  id: string;
  tenantId: string;
  name: string;
  /** Per-client white-label: yalnızca #rrggbb ve http(s) kabul edilir. */
  brandColor?: string | undefined;
  brandLogoUrl?: string | undefined;
  createdAt: string;
}

/** Site bazlı rıza bannerı konfigürasyonu — embed bunu panelden çeker. */
export interface SiteBannerConfig {
  bannerVersion: string;
  texts: {
    title: string;
    description: string;
    acceptAll: string;
    rejectAll: string;
  };
}

export interface Site {
  id: string;
  clientId: string;
  url: string;
  /** Embed/scanner'ın tarama ve kanıt POST'laması için gizli anahtar (64 hex). */
  ingestToken: string;
  bannerConfig?: SiteBannerConfig | undefined;
  /** Sürekli izleme aralığı (saat) — null/undefined = kapalı. */
  scanIntervalHours?: number | undefined;
  createdAt: string;
}

export interface ScanCookie {
  name: string;
  domain: string;
  category: string;
}

export interface ScannedScript {
  url: string;
  category: string;
}

export interface StoredScan {
  id: string;
  siteId: string;
  scannedAt: string;
  report: FormInventoryReport;
  cookies: ScanCookie[];
  observedTargets: RequestTarget[];
  scripts: ScannedScript[];
}

export interface PanelUser {
  id: string;
  tenantId: string;
  email: string;
  passwordHash: string;
  role: "owner" | "auditor";
  createdAt: string;
}

export interface AuditEntry {
  id: string;
  tenantId: string;
  action: string;
  detail: Record<string, unknown>;
  createdAt: string;
}

export type { ConsentReceipt };
