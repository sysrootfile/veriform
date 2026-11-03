import type { RequestTarget } from "../collector/targets.js";
import type { ConsentReceipt } from "../consent/receipt.js";
import { computeDeadline, extendDeadline } from "../dsar/deadline.js";
import type { DsarRequest, DsarStatus, DsarType } from "../dsar/types.js";
import type { FormInventoryReport } from "../report/types.js";
import { makeChainEntry, verifyStoredChain, verifyReceiptSelfHash, type StoredReceiptEntry } from "./chain.js";
import type { Client, PanelUser, ScanCookie, Site, SiteBannerConfig, StoredScan, Tenant, TenantKind } from "./types.js";
import { deepClone, randomIngestToken } from "./shared.js";
import type { Correction } from "./corrections.js";

/**
 * Ajans paneli depolama portu — Postgres adapter'ı (RLS'li, bkz. schema.sql)
 * bu sözleşmenin birebir aynısını uygular. Depodan dönen her nesne derin
 * kopyadır: çağıranın kurcalaması depoyu etkilemez.
 */

export interface PanelStore {
  createTenant(input: {
    name: string;
    kind: TenantKind;
    brandColor?: string | undefined;
    brandLogoUrl?: string | undefined;
  }): Promise<Tenant>;
  getTenant(tenantId: string): Promise<Tenant | null>;
  createClient(input: { tenantId: string; name: string }): Promise<Client>;
  /** Hard delete: client + siteleri + taramaları + kanıt zinciri (KVKK saklama yükümlülüğü dışında kalıcı silme talebi için). */
  deleteClient(clientId: string): Promise<void>;
  listClients(tenantId: string): Promise<Client[]>;
  createSite(input: { clientId: string; url: string }): Promise<Site>;
  listSites(clientId: string): Promise<Site[]>;
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
  setBannerConfig(siteId: string, config: SiteBannerConfig | null): Promise<Site>;
  saveDsar(input: {
    siteId: string;
    type: DsarType;
    subjectName: string;
    subjectEmail: string;
    message?: string | undefined;
    receivedAt?: string | undefined;
  }): Promise<DsarRequest>;
  listDsars(siteId: string): Promise<DsarRequest[]>;
  updateDsar(
    dsarId: string,
    patch: { status?: DsarStatus | undefined; responseNote?: string | undefined; extend?: boolean | undefined },
  ): Promise<DsarRequest>;
  /** Kanıt ihracı: siteye ait zincir girişleri (varış sırasına göre). */
  listReceipts(siteId: string): Promise<StoredReceiptEntry[]>;
  /** İnsan onaylı düzeltme — aynı alan için yenisi eskisinin üzerine yazar. */
  saveCorrection(siteId: string, input: { fieldName: string; category: string }): Promise<Correction>;
  listCorrections(siteId: string): Promise<Correction[]>;
}

export function createInMemoryPanelStore(): PanelStore {
  const tenants: Tenant[] = [];
  const clients: Client[] = [];
  const sites: Site[] = [];
  const scans: StoredScan[] = [];
  const receiptEntries: StoredReceiptEntry[] = [];
  const users: PanelUser[] = [];
  const dsars: DsarRequest[] = [];
  const corrections: Array<Correction & { siteId: string }> = [];

  const clone = deepClone;

  return {
    async createTenant(input) {
      const tenant: Tenant = {
        id: crypto.randomUUID(),
        name: input.name,
        kind: input.kind,
        ...(input.brandColor ? { brandColor: input.brandColor } : {}),
        ...(input.brandLogoUrl ? { brandLogoUrl: input.brandLogoUrl } : {}),
        createdAt: new Date().toISOString(),
      };
      tenants.push(tenant);
      return clone(tenant);
    },

    async getTenant(tenantId) {
      const tenant = tenants.find((t) => t.id === tenantId);
      return tenant ? clone(tenant) : null;
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

    async deleteClient(clientId) {
      const idx = clients.findIndex((c) => c.id === clientId);
      if (idx === -1) throw new Error(`client bulunamadı: ${clientId}`);
      const siteIds = sites.filter((s) => s.clientId === clientId).map((s) => s.id);
      clients.splice(idx, 1);
      for (let i = sites.length - 1; i >= 0; i--) {
        if (siteIds.includes(sites[i]!.id)) sites.splice(i, 1);
      }
      for (let i = scans.length - 1; i >= 0; i--) {
        if (siteIds.includes(scans[i]!.siteId)) scans.splice(i, 1);
      }
      for (let i = receiptEntries.length - 1; i >= 0; i--) {
        if (siteIds.includes(receiptEntries[i]!.siteId)) receiptEntries.splice(i, 1);
      }
      for (let i = dsars.length - 1; i >= 0; i--) {
        if (siteIds.includes(dsars[i]!.siteId)) dsars.splice(i, 1);
      }
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

    async listSites(clientId) {
      return clone(sites.filter((s) => s.clientId === clientId));
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
        throw new Error("e-posta zaten kayıtlı");
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

    async setBannerConfig(siteId, config) {
      const site = sites.find((s) => s.id === siteId);
      if (!site) throw new Error(`site bulunamadı: ${siteId}`);
      site.bannerConfig = config ? clone(config) : undefined;
      return clone(site);
    },

    async saveDsar(input) {
      if (!sites.some((s) => s.id === input.siteId)) {
        throw new Error(`site bulunamadı: ${input.siteId}`);
      }
      const receivedAt = input.receivedAt ?? new Date().toISOString();
      const dsar: DsarRequest = {
        id: crypto.randomUUID(),
        siteId: input.siteId,
        type: input.type,
        subjectName: input.subjectName,
        subjectEmail: input.subjectEmail,
        ...(input.message ? { message: input.message } : {}),
        receivedAt,
        deadlineAt: computeDeadline(receivedAt),
        status: "new",
      };
      dsars.push(dsar);
      return clone(dsar);
    },

    async listDsars(siteId) {
      return clone(dsars.filter((d) => d.siteId === siteId));
    },

    async updateDsar(dsarId, patch) {
      const dsar = dsars.find((d) => d.id === dsarId);
      if (!dsar) throw new Error(`başvuru bulunamadı: ${dsarId}`);

      if (patch.extend) {
        if (dsar.extended) throw new Error("süre zaten uzatılmış — KVKK m.13 tek uzatma hakkı verir");
        dsar.deadlineAt = extendDeadline(dsar.deadlineAt);
        dsar.extended = true;
      }
      if (patch.status) {
        dsar.status = patch.status;
        if (patch.status === "completed" || patch.status === "rejected") {
          dsar.respondedAt = new Date().toISOString();
        }
      }
      if (patch.responseNote !== undefined) dsar.responseNote = patch.responseNote;
      return clone(dsar);
    },

    async listReceipts(siteId) {
      return clone(receiptEntries.filter((e) => e.siteId === siteId));
    },

    async saveCorrection(siteId, input) {
      if (!sites.some((s) => s.id === siteId)) {
        throw new Error(`site bulunamadı: ${siteId}`);
      }
      const correction: Correction = {
        fieldName: input.fieldName,
        category: input.category as Correction["category"],
      };
      const idx = corrections.findIndex(
        (c) => c.siteId === siteId && c.fieldName === input.fieldName,
      );
      const stored: Correction & { siteId: string } = { siteId, ...correction };
      if (idx >= 0) corrections[idx] = stored;
      else corrections.push(stored);
      return clone(correction);
    },

    async listCorrections(siteId) {
      return clone(corrections.filter((c) => c.siteId === siteId));
    },
  };
}
