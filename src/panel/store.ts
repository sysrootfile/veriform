import type { RequestTarget } from "../collector/targets.js";
import type { ConsentReceipt } from "../consent/receipt.js";
import { computeDeadline, extendDeadline } from "../dsar/deadline.js";
import type { DsarRequest, DsarStatus, DsarType } from "../dsar/types.js";
import type { FormInventoryReport } from "../report/types.js";
import { makeChainEntry, verifyStoredChain, verifyReceiptSelfHash, type StoredReceiptEntry } from "./chain.js";
import type { AccountTokenPurpose, Client, ContactPackage, ContactRequest, PanelUser, PlanChangeRequest, ScanCookie, ScannedScript, Site, SiteBannerConfig, StoredScan, Tenant, TenantKind } from "./types.js";
import { deepClone, randomIngestToken } from "./shared.js";
import type { Correction } from "./corrections.js";
import type { AuditEntry } from "./types.js";
import type { ApiKeyRecord } from "./api-keys.js";
import { hashApiKey } from "./api-keys.js";

/**
 * Ajans paneli depolama portu — Postgres adapter'ı (RLS'li, bkz. migrations/)
 * bu sözleşmenin birebir aynısını uygular. Depodan dönen her nesne derin
 * kopyadır: çağıranın kurcalaması depoyu etkilemez.
 *
 * İki güven düzeyi vardır:
 * - tenantId alan metotlar kiracı oturumundan çağrılır. Postgres'te RLS
 *   kapsamında koşarlar (store.pg.ts asTenant); başka kiracının kaydı görünmez
 *   ve değişmez. In-memory adapter aynı sözleşmeyi sahiplik denetimiyle uygular.
 * - tenantId almayan, kaynağı kimlikle bulan metotlar sistem yoludur (ingest
 *   anahtarı, zamanlayıcı, operatör, hesap belirteci): kiracı filtresi yoktur.
 */

export interface PanelStore {
  /** Canlılık probu: depo erişilemezse reject eder (/healthz bunu kullanır). */
  ping(): Promise<void>;
  createTenant(input: {
    name: string;
    kind: TenantKind;
    package?: ContactPackage | undefined;
    trialEndsAt?: string | undefined;
    brandColor?: string | undefined;
    brandLogoUrl?: string | undefined;
  }): Promise<Tenant>;
  getTenant(tenantId: string): Promise<Tenant | null>;
  /** Kota denetimi: kiracının tüm müşterilerindeki site toplamı. */
  countSitesByTenant(tenantId: string): Promise<number>;
  createClient(input: { tenantId: string; name: string }): Promise<Client>;
  /** Per-client white-label — boş input marka alanlarını temizler. */
  setClientBranding(
    tenantId: string,
    clientId: string,
    input: { brandColor?: string | undefined; brandLogoUrl?: string | undefined },
  ): Promise<Client>;
  /** Hard delete: client + siteleri + taramaları + kanıt zinciri (KVKK saklama yükümlülüğü dışında kalıcı silme talebi için). */
  deleteClient(tenantId: string, clientId: string): Promise<void>;
  listClients(tenantId: string): Promise<Client[]>;
  createSite(input: { tenantId: string; clientId: string; url: string }): Promise<Site>;
  listSites(tenantId: string, clientId: string): Promise<Site[]>;
  getSite(tenantId: string, siteId: string): Promise<Site | null>;
  /** Sürekli izleme worker'ı için tüm siteler (sistem düzeyi, kiracı filtresi yok). */
  listAllSites(): Promise<Site[]>;
  /** Ingest kimliklendirme: token → site (bilinmeyen token → null). */
  getSiteByToken(token: string): Promise<Site | null>;
  /** İzleme kodu bağlantı sinyali: embedLastSeenAt damgası (bilinmeyen site sessiz). */
  markEmbedSeen(siteId: string): Promise<void>;
  saveScan(input: {
    siteId: string;
    report: FormInventoryReport;
    cookies: ScanCookie[];
    observedTargets: RequestTarget[];
    scripts?: ScannedScript[];
  }): Promise<StoredScan>;
  listScans(tenantId: string, siteId: string): Promise<StoredScan[]>;
  /** Zamanlayıcı için site taramaları (sistem düzeyi, kiracı filtresi yok). */
  listAllScans(siteId: string): Promise<StoredScan[]>;
  /** Client kanıtının selfHash'i doğrulanır; zincir bağını sunucu hesaplar. */
  appendReceipt(input: { siteId: string; receipt: ConsentReceipt }): Promise<StoredReceiptEntry>;
  verifySiteChain(tenantId: string, siteId: string): Promise<boolean>;
  createUser(input: {
    tenantId: string;
    email: string;
    passwordHash: string;
    role?: "owner" | "auditor" | undefined;
  }): Promise<PanelUser>;
  findUserByEmail(email: string): Promise<PanelUser | null>;
  findUserByTenant(tenantId: string): Promise<PanelUser | null>;
  setUserEmailVerified(userId: string): Promise<void>;
  updateUserPassword(userId: string, passwordHash: string): Promise<void>;
  /** Kullanıcının açık oturumlarını düşürür (şimdi'den önce verilenler geçersiz olur). */
  invalidateSessions(userId: string): Promise<void>;
  /** KVKK hesap silme: kiracı ve bağlı tüm veri (FK cascade). */
  deleteTenant(tenantId: string): Promise<void>;
  createAccountToken(input: {
    userId: string;
    purpose: AccountTokenPurpose;
    tokenHash: string;
    expiresAt: string;
  }): Promise<void>;
  /** Tek kullanımlık tüketim: yok/süresi dolmuş/kullanılmış/amaç farklı → null. Tüketim aynı kullanıcı+amaçtaki diğer bekleyen tokenları da iptal eder. */
  consumeAccountToken(tokenHash: string, purpose: AccountTokenPurpose): Promise<{ userId: string } | null>;
  setBannerConfig(tenantId: string, siteId: string, config: SiteBannerConfig | null): Promise<Site>;
  /** Sürekli izleme aralığı (saat); 0 = kapalı. */
  setScanSchedule(tenantId: string, siteId: string, intervalHours: number): Promise<Site>;
  saveDsar(input: {
    siteId: string;
    type: DsarType;
    subjectName: string;
    subjectEmail: string;
    message?: string | undefined;
    receivedAt?: string | undefined;
  }): Promise<DsarRequest>;
  listDsars(tenantId: string, siteId: string): Promise<DsarRequest[]>;
  /** Başvuru siteye ait değilse hata fırlar. */
  updateDsar(
    tenantId: string,
    siteId: string,
    dsarId: string,
    patch: { status?: DsarStatus | undefined; responseNote?: string | undefined; extend?: boolean | undefined },
  ): Promise<DsarRequest>;
  /** Kanıt ihracı: siteye ait zincir girişleri (varış sırasına göre). */
  listReceipts(tenantId: string, siteId: string): Promise<StoredReceiptEntry[]>;
  /** İnsan onaylı düzeltme — aynı alan için yenisi eskisinin üzerine yazar. */
  saveCorrection(tenantId: string, siteId: string, input: { fieldName: string; category: string }): Promise<Correction>;
  listCorrections(tenantId: string, siteId: string): Promise<Correction[]>;
  /** Ingest için düzeltme haritası (sistem düzeyi, kiracı filtresi yok). */
  listAllCorrections(siteId: string): Promise<Correction[]>;
  /** Denetim izi — panel mutasyonları service katmanından kaydedilir. */
  recordAudit(tenantId: string, action: string, detail?: Record<string, unknown>): Promise<void>;
  listAudit(tenantId: string): Promise<AuditEntry[]>;
  /** Headless API: düz anahtar bu çağrının yanıtında bir kez döner. */
  saveApiKey(
    tenantId: string,
    input: { name: string; prefix: string; keyHash: string },
  ): Promise<ApiKeyRecord>;
  listApiKeys(tenantId: string): Promise<ApiKeyRecord[]>;
  revokeApiKey(tenantId: string, keyId: string): Promise<void>;
  /** Anahtar → kiracı kimliklendirme; bulunamayan/iptalli anahtar → null. */
  findTenantByApiKey(key: string): Promise<{ tenantId: string; keyId: string } | null>;
  touchApiKey(key: string): Promise<void>;
  /** Landing iletişim talebi — operatör düzeyi (kiracı filtresi yok). */
  createContactRequest(input: {
    name: string;
    email: string;
    company?: string | undefined;
    package?: ContactRequest["package"];
    message: string;
  }): Promise<ContactRequest>;
  listContactRequests(): Promise<ContactRequest[]>;
  setContactHandled(id: string, handled: boolean): Promise<void>;
  /** Operatör yüzeyi: tüm kiracılar + paket değişimi. */
  listTenants(): Promise<Tenant[]>;
  setTenantPackage(tenantId: string, pkg: ContactPackage): Promise<void>;
  /** Plan geçiş talepleri: kiracı ister, operatör karara bağlar. */
  createPlanChangeRequest(input: { tenantId: string; toPackage: ContactPackage }): Promise<PlanChangeRequest>;
  listPlanChangeRequests(tenantId?: string): Promise<PlanChangeRequest[]>;
  decidePlanChangeRequest(id: string, decision: "approved" | "rejected"): Promise<PlanChangeRequest>;
  /** Değişiklik uyarısı bağlamı: site → kiracı + sahip e-postası (yoksa null). */
  getSiteAlertContext(
    siteId: string,
  ): Promise<{ tenantId: string; ownerEmail: string; siteUrl: string } | null>;
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
  const auditLog: Array<AuditEntry & { tenantId: string }> = [];
  const apiKeys: Array<ApiKeyRecord & { tenantId: string; keyHash: string }> = [];
  const contactRequests: ContactRequest[] = [];
  const planChangeRequests: PlanChangeRequest[] = [];
  const accountTokens: Array<{
    userId: string;
    purpose: AccountTokenPurpose;
    tokenHash: string;
    expiresAt: string;
    usedAt?: string | undefined;
  }> = [];

  const clone = deepClone;

  // Başka kiracının kaydı ile var olmayan kayıt aynı yanıtı verir (varoluş sızdırmaz).
  const ownClient = (tenantId: string, clientId: string): Client | undefined =>
    clients.find((c) => c.id === clientId && c.tenantId === tenantId);
  const ownSite = (tenantId: string, siteId: string): Site | undefined => {
    const site = sites.find((s) => s.id === siteId);
    return site && ownClient(tenantId, site.clientId) ? site : undefined;
  };
  const requireClient = (tenantId: string, clientId: string): Client => {
    const client = ownClient(tenantId, clientId);
    if (!client) throw new Error(`client bulunamadı: ${clientId}`);
    return client;
  };
  const requireSite = (tenantId: string, siteId: string): Site => {
    const site = ownSite(tenantId, siteId);
    if (!site) throw new Error(`site bulunamadı: ${siteId}`);
    return site;
  };

  return {
    async ping() {},

    async createTenant(input) {
      const tenant: Tenant = {
        id: crypto.randomUUID(),
        name: input.name,
        kind: input.kind,
        package: input.package ?? "starter",
        ...(input.trialEndsAt ? { trialEndsAt: input.trialEndsAt } : {}),
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

    async countSitesByTenant(tenantId) {
      const clientIds = new Set(clients.filter((c) => c.tenantId === tenantId).map((c) => c.id));
      return sites.filter((s) => clientIds.has(s.clientId)).length;
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

    async setClientBranding(tenantId, clientId, input) {
      const client = requireClient(tenantId, clientId);
      client.brandColor = input.brandColor;
      client.brandLogoUrl = input.brandLogoUrl;
      return clone(client);
    },

    async deleteClient(tenantId, clientId) {
      const idx = clients.findIndex((c) => c.id === clientId && c.tenantId === tenantId);
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
      requireClient(input.tenantId, input.clientId);
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

    async listSites(tenantId, clientId) {
      const client = ownClient(tenantId, clientId);
      return clone(client ? sites.filter((s) => s.clientId === clientId) : []);
    },

    async getSite(tenantId, siteId) {
      const site = ownSite(tenantId, siteId);
      return site ? clone(site) : null;
    },

    async markEmbedSeen(siteId) {
      const site = sites.find((s) => s.id === siteId);
      if (site) site.embedLastSeenAt = new Date().toISOString();
    },

    async listAllSites() {
      return clone(sites);
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
        scripts: clone(input.scripts ?? []),
      };
      scans.push(scan);
      return clone(scan);
    },

    async listScans(tenantId, siteId) {
      return clone(ownSite(tenantId, siteId) ? scans.filter((s) => s.siteId === siteId) : []);
    },

    async listAllScans(siteId) {
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

    async verifySiteChain(tenantId, siteId) {
      const visible = ownSite(tenantId, siteId);
      return verifyStoredChain(visible ? receiptEntries.filter((e) => e.siteId === siteId) : []);
    },

    async createUser(input) {
      if (users.some((u) => u.email === input.email)) {
        throw new Error("e-posta zaten kayıtlı");
      }
      const user: PanelUser = {
        role: "owner" as const,
        id: crypto.randomUUID(),
        tenantId: input.tenantId,
        email: input.email,
        passwordHash: input.passwordHash,
        sessionsValidAfter: new Date(0).toISOString(),
        createdAt: new Date().toISOString(),
      };
      users.push(user);
      return clone(user);
    },

    async invalidateSessions(userId) {
      const user = users.find((u) => u.id === userId);
      if (!user) throw new Error(`kullanıcı bulunamadı: ${userId}`);
      user.sessionsValidAfter = new Date().toISOString();
    },

    async findUserByEmail(email) {
      const user = users.find((u) => u.email === email);
      return user ? clone(user) : null;
    },

    async findUserByTenant(tenantId) {
      const user = users.find((u) => u.tenantId === tenantId);
      return user ? clone(user) : null;
    },

    async setUserEmailVerified(userId) {
      const user = users.find((u) => u.id === userId);
      if (!user) throw new Error(`kullanıcı bulunamadı: ${userId}`);
      user.emailVerifiedAt = new Date().toISOString();
    },

    async updateUserPassword(userId, passwordHash) {
      const user = users.find((u) => u.id === userId);
      if (!user) throw new Error(`kullanıcı bulunamadı: ${userId}`);
      user.passwordHash = passwordHash;
    },

    async deleteTenant(tenantId) {
      const idx = tenants.findIndex((t) => t.id === tenantId);
      if (idx === -1) throw new Error(`tenant bulunamadı: ${tenantId}`);
      const clientIds = clients.filter((c) => c.tenantId === tenantId).map((c) => c.id);
      const siteIds = sites.filter((s) => clientIds.includes(s.clientId)).map((s) => s.id);
      const userIds = users.filter((u) => u.tenantId === tenantId).map((u) => u.id);
      tenants.splice(idx, 1);
      const purge = <T>(arr: T[], pred: (x: T) => boolean): void => {
        for (let i = arr.length - 1; i >= 0; i--) if (pred(arr[i]!)) arr.splice(i, 1);
      };
      purge(clients, (c) => c.tenantId === tenantId);
      purge(sites, (s) => clientIds.includes(s.clientId));
      purge(scans, (s) => siteIds.includes(s.siteId));
      purge(receiptEntries, (e) => siteIds.includes(e.siteId));
      purge(dsars, (d) => siteIds.includes(d.siteId));
      purge(corrections, (c) => siteIds.includes(c.siteId));
      purge(users, (u) => u.tenantId === tenantId);
      purge(auditLog, (a) => a.tenantId === tenantId);
      purge(apiKeys, (k) => k.tenantId === tenantId);
      purge(accountTokens, (t) => userIds.includes(t.userId));
      purge(planChangeRequests, (r) => r.tenantId === tenantId);
    },

    async createAccountToken(input) {
      accountTokens.push({ ...input });
    },

    async consumeAccountToken(tokenHash, purpose) {
      const token = accountTokens.find(
        (t) =>
          t.tokenHash === tokenHash &&
          t.purpose === purpose &&
          !t.usedAt &&
          Date.parse(t.expiresAt) > Date.now(),
      );
      if (!token) return null;
      const now = new Date().toISOString();
      token.usedAt = now;
      for (const sibling of accountTokens) {
        if (sibling.userId === token.userId && sibling.purpose === purpose && !sibling.usedAt) {
          sibling.usedAt = now;
        }
      }
      return { userId: token.userId };
    },

    async setBannerConfig(tenantId, siteId, config) {
      const site = requireSite(tenantId, siteId);
      site.bannerConfig = config ? clone(config) : undefined;
      return clone(site);
    },

    async setScanSchedule(tenantId, siteId, intervalHours) {
      const site = requireSite(tenantId, siteId);
      site.scanIntervalHours = intervalHours;
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

    async listDsars(tenantId, siteId) {
      return clone(ownSite(tenantId, siteId) ? dsars.filter((d) => d.siteId === siteId) : []);
    },

    async updateDsar(tenantId, siteId, dsarId, patch) {
      requireSite(tenantId, siteId);
      const dsar = dsars.find((d) => d.id === dsarId && d.siteId === siteId);
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

    async listReceipts(tenantId, siteId) {
      return clone(ownSite(tenantId, siteId) ? receiptEntries.filter((e) => e.siteId === siteId) : []);
    },

    async saveCorrection(tenantId, siteId, input) {
      requireSite(tenantId, siteId);
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

    async listCorrections(tenantId, siteId) {
      return clone(ownSite(tenantId, siteId) ? corrections.filter((c) => c.siteId === siteId) : []);
    },

    async listAllCorrections(siteId) {
      return clone(corrections.filter((c) => c.siteId === siteId));
    },

    async recordAudit(tenantId, action, detail) {
      auditLog.push({
        id: crypto.randomUUID(),
        tenantId,
        action,
        detail: clone(detail ?? {}),
        createdAt: new Date().toISOString(),
      });
    },

    async listAudit(tenantId) {
      return clone(auditLog.filter((a) => a.tenantId === tenantId));
    },

    async saveApiKey(tenantId, input) {
      const record: ApiKeyRecord & { tenantId: string; keyHash: string } = {
        id: crypto.randomUUID(),
        tenantId,
        name: input.name,
        prefix: input.prefix,
        keyHash: input.keyHash,
        createdAt: new Date().toISOString(),
      };
      apiKeys.push(record);
      return clone(record);
    },

    async listApiKeys(tenantId) {
      return clone(
        apiKeys
          .filter((k) => k.tenantId === tenantId)
          .map(({ keyHash: _hash, ...rest }) => rest),
      );
    },

    async revokeApiKey(tenantId, keyId) {
      const key = apiKeys.find((k) => k.tenantId === tenantId && k.id === keyId);
      if (!key) throw new Error(`API anahtarı bulunamadı: ${keyId}`);
      key.revokedAt = new Date().toISOString();
    },

    async findTenantByApiKey(key) {
      const hash = hashApiKey(key);
      const found = apiKeys.find(
        (k) => k.keyHash === hash && !k.revokedAt,
      );
      if (!found) return null;
      found.lastUsedAt = new Date().toISOString();
      return { tenantId: found.tenantId, keyId: found.id };
    },

    async touchApiKey(key) {
      const hash = hashApiKey(key);
      const found = apiKeys.find((k) => k.keyHash === hash);
      if (found) found.lastUsedAt = new Date().toISOString();
    },

    async createContactRequest(input) {
      const req: ContactRequest = {
        id: crypto.randomUUID(),
        name: input.name,
        email: input.email,
        ...(input.company ? { company: input.company } : {}),
        ...(input.package ? { package: input.package } : {}),
        message: input.message,
        createdAt: new Date().toISOString(),
      };
      contactRequests.push(req);
      return clone(req);
    },

    async listContactRequests() {
      return clone(contactRequests);
    },

    async setContactHandled(id, handled) {
      const req = contactRequests.find((r) => r.id === id);
      if (!req) throw new Error(`talep bulunamadı: ${id}`);
      if (handled) req.handledAt = new Date().toISOString();
      else delete req.handledAt;
    },

    async listTenants() {
      return clone(tenants);
    },

    async setTenantPackage(tenantId, pkg) {
      const tenant = tenants.find((t) => t.id === tenantId);
      if (!tenant) throw new Error(`tenant bulunamadı: ${tenantId}`);
      tenant.package = pkg;
      delete tenant.trialEndsAt;
    },

    async createPlanChangeRequest(input) {
      const tenant = tenants.find((t) => t.id === input.tenantId);
      if (!tenant) throw new Error(`tenant bulunamadı: ${input.tenantId}`);
      if (tenant.package === input.toPackage) throw new Error("zaten bu pakettesiniz");
      if (planChangeRequests.some((r) => r.tenantId === input.tenantId && r.status === "pending")) {
        throw new Error("zaten bekleyen bir geçiş talebiniz var");
      }
      const req: PlanChangeRequest = {
        id: crypto.randomUUID(),
        tenantId: input.tenantId,
        fromPackage: tenant.package,
        toPackage: input.toPackage,
        status: "pending",
        createdAt: new Date().toISOString(),
      };
      planChangeRequests.push(req);
      return clone(req);
    },

    async listPlanChangeRequests(tenantId) {
      const rows = tenantId
        ? planChangeRequests.filter((r) => r.tenantId === tenantId)
        : planChangeRequests;
      return clone([...rows].reverse());
    },

    async decidePlanChangeRequest(id, decision) {
      const req = planChangeRequests.find((r) => r.id === id);
      if (!req) throw new Error(`talep bulunamadı: ${id}`);
      if (req.status !== "pending") throw new Error("talep zaten sonuçlanmış");
      req.status = decision;
      req.decidedAt = new Date().toISOString();
      if (decision === "approved") {
        const tenant = tenants.find((t) => t.id === req.tenantId);
        if (tenant) {
          tenant.package = req.toPackage;
          delete tenant.trialEndsAt;
        }
      }
      return clone(req);
    },

    async getSiteAlertContext(siteId) {
      const site = sites.find((s) => s.id === siteId);
      if (!site) return null;
      const client = clients.find((c) => c.id === site.clientId);
      if (!client) return null;
      const owner = users.find(
        (u) => u.tenantId === client.tenantId && u.role === "owner",
      );
      if (!owner) return null;
      return {
        tenantId: client.tenantId,
        ownerEmail: owner.email,
        siteUrl: site.url,
      };
    },
  };
}
