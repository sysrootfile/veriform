import type { RequestTarget } from "../collector/targets.js";
import type { ConsentReceipt } from "../consent/receipt.js";
import type { FormInventoryReport } from "../report/types.js";

/** Ajans paneli alan modeli — tenant→client→site hiyerarşisi. */

export type TenantKind = "agency" | "direct";

export interface Tenant {
  id: string;
  name: string;
  kind: TenantKind;
  createdAt: string;
}

export interface Client {
  id: string;
  tenantId: string;
  name: string;
  createdAt: string;
}

export interface Site {
  id: string;
  clientId: string;
  url: string;
  createdAt: string;
}

export interface ScanCookie {
  name: string;
  domain: string;
  category: string;
}

export interface StoredScan {
  id: string;
  siteId: string;
  scannedAt: string;
  report: FormInventoryReport;
  cookies: ScanCookie[];
  observedTargets: RequestTarget[];
}

export type { ConsentReceipt };
