import type { RequestTarget } from "../collector/targets.js";
import type { ConsentReceipt } from "../consent/receipt.js";
import type { FormInventoryReport } from "../report/types.js";
import { makeChainEntry, verifyStoredChain, verifyReceiptSelfHash, type StoredReceiptEntry } from "./chain.js";
import type { Client, PanelUser, ScanCookie, Site, StoredScan, Tenant, TenantKind } from "./types.js";

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
  /** Ingest kimliklendirme: token → site (bilinmeyen token → null). */
  getSiteByToken(token: string): Promise<Site | null>;
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
  createUser(input: { tenantId: string; email: string; passwordHash: string }): Promise<PanelUser>;
  findUserByEmail(email: string): Promise<PanelUser | null>;
}

export function createInMemoryPanelStore(): PanelStore {
  const tenants: Tenant[] = [];
  const clients: Client[] = [];
  const sites: Site[] = [];
  const scans: StoredScan[] = [];
  const receiptEntries: StoredReceiptEntry[] = [];
  const users: PanelUser[] = [];

  const clone = <T>(value: T): T => structuredClone(value);

/** 64 hex karakter — WebCrypto ile (tarayıcı/Node uyumlu). */
function randomIngestToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

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
        ingestToken: randomIngestToken(),
        createdAt: new Date().toISOString(),
      };
      sites.push(site);
      return clone(site);
    },

    async getSiteByToken(token) {
      const site = sites.find((s) => s.ingestToken === token);
      return site ? clone(site) : null;
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

    async createUser(input) {
      if (users.some((u) => u.email === input.email)) {
        throw new Error(`e-posta zaten kayıtlı: ${input.email}`);
      }
      const user: PanelUser = {
        id: crypto.randomUUID(),
        tenantId: input.tenantId,
        email: input.email,
        passwordHash: input.passwordHash,
        createdAt: new Date().toISOString(),
      };
      users.push(user);
      return clone(user);
    },

    async findUserByEmail(email) {
      const user = users.find((u) => u.email === email);
      return user ? clone(user) : null;
    },
  };
}
