import type { RequestTarget } from "../collector/targets.js";
import type { ConsentReceipt } from "../consent/receipt.js";
import type { FormInventoryReport } from "../report/types.js";
import { makeChainEntry, verifyStoredChain, verifyReceiptSelfHash, type StoredReceiptEntry } from "./chain.js";
import type { Client, ScanCookie, Site, StoredScan, Tenant, TenantKind } from "./types.js";

/**
 * Ajans paneli depolama portu — Postgres adapter'ı (RLS'li, bkz. schema.sql)
 * bu sözleşmenin birebir aynısını uygular. Depodan dönen her nesne derin
 * kopyadır: çağıranın kurcalaması depoyu etkilemez.
 */

export interface PanelStore {
  createTenant(input: { name: string; kind: TenantKind }): Promise<Tenant>;
  createClient(input: { tenantId: string; name: string }): Promise<Client>;
  listClients(tenantId: string): Promise<Client[]>;
  createSite(input: { clientId: string; url: string }): Promise<Site>;
  getSite(siteId: string): Promise<Site | null>;
  saveScan(input: {
    siteId: string;
    report: FormInventoryReport;
    cookies: ScanCookie[];
    observedTargets: RequestTarget[];
  }): Promise<StoredScan>;
  listScans(siteId: string): Promise<StoredScan[]>;
  /** Client kanıtının selfHash'i doğrulanır; zincir bağını sunucu hesaplar. */
  appendReceipt(input: { siteId: string; receipt: ConsentReceipt }): Promise<StoredReceiptEntry>;
  verifySiteChain(siteId: string): Promise<boolean>;
}

export function createInMemoryPanelStore(): PanelStore {
  const tenants: Tenant[] = [];
  const clients: Client[] = [];
  const sites: Site[] = [];
  const scans: StoredScan[] = [];
  const receiptEntries: StoredReceiptEntry[] = [];

  const clone = <T>(value: T): T => structuredClone(value);

  return {
    async createTenant(input) {
      const tenant: Tenant = {
        id: crypto.randomUUID(),
        name: input.name,
        kind: input.kind,
        createdAt: new Date().toISOString(),
      };
      tenants.push(tenant);
      return clone(tenant);
    },

    async createClient(input) {
      if (!tenants.some((t) => t.id === input.tenantId)) {
        throw new Error(`tenant bulunamadı: ${input.tenantId}`);
      }
      const client: Client = {
        id: crypto.randomUUID(),
        tenantId: input.tenantId,
        name: input.name,
        createdAt: new Date().toISOString(),
      };
      clients.push(client);
      return clone(client);
    },

    async listClients(tenantId) {
      return clone(clients.filter((c) => c.tenantId === tenantId));
    },

    async createSite(input) {
      if (!clients.some((c) => c.id === input.clientId)) {
        throw new Error(`client bulunamadı: ${input.clientId}`);
      }
      const site: Site = {
        id: crypto.randomUUID(),
        clientId: input.clientId,
        url: input.url,
        createdAt: new Date().toISOString(),
      };
      sites.push(site);
      return clone(site);
    },

    async getSite(siteId) {
      const site = sites.find((s) => s.id === siteId);
      return site ? clone(site) : null;
    },

    async saveScan(input) {
      if (!sites.some((s) => s.id === input.siteId)) {
        throw new Error(`site bulunamadı: ${input.siteId}`);
      }
      const scan: StoredScan = {
        id: crypto.randomUUID(),
        siteId: input.siteId,
        scannedAt: new Date().toISOString(),
        report: clone(input.report),
        cookies: clone(input.cookies),
        observedTargets: clone(input.observedTargets),
      };
      scans.push(scan);
      return clone(scan);
    },

    async listScans(siteId) {
      return clone(scans.filter((s) => s.siteId === siteId));
    },

    async appendReceipt(input) {
      if (!sites.some((s) => s.id === input.siteId)) {
        throw new Error(`site bulunamadı: ${input.siteId}`);
      }
      if (!(await verifyReceiptSelfHash(input.receipt))) {
        throw new Error("selfHash doğrulaması başarısız — kanıt kurcalanmış olabilir");
      }
      const last = receiptEntries
        .filter((e) => e.siteId === input.siteId)
        .at(-1);
      const entry = await makeChainEntry(input.siteId, input.receipt, last?.chainHash);
      receiptEntries.push(entry);
      return clone(entry);
    },

    async verifySiteChain(siteId) {
      return verifyStoredChain(receiptEntries.filter((e) => e.siteId === siteId));
    },
  };
}
