import { assertPublicHttpUrl } from "../scanner/url-guard.js";
import type { RequestTarget } from "../collector/targets.js";
import type { ConsentReceipt } from "../consent/receipt.js";
import type { DsarRequest, DsarStatus } from "../dsar/types.js";
import type { FormInventoryReport } from "../report/types.js";
import type { StoredReceiptEntry } from "./chain.js";
import type { Correction } from "./corrections.js";
import { effectivePackage, PLAN_LABELS, PLAN_LIMITS, trialDaysLeft } from "./plans.js";
import type { PanelStore } from "./store.js";
import type { Client, ScanCookie, ScannedScript, SetupProgress, Site, SiteBannerConfig, StoredScan } from "./types.js";

/**
 * Panel servis katmanı — HTTP handler'ların çağıracağı uygulama sözleşmesi.
 * Her işlem kiracı bağlamıyla çalışır ve sahiplik doğrular: RLS'in üstünde
 * savunma-derinliği katmanı. Hata mesajları varoluş sızdırmaz — bulunamayan
 * ile başkasının kaydı arasında ayrım yapılmaz.
 */

export interface PanelContext {
  tenantId: string;
  /** "auditor" yalnızca okur; mutasyonlar reddedilir. Varsayılan: owner. */
  role?: "owner" | "auditor" | undefined;
}

function deny(): never {
  throw new Error("erişim reddedildi");
}

function denyAuditor(role: PanelContext["role"]): void {
  if (role === "auditor") deny();
}

export interface PanelService {
  getClientList(): Promise<Client[]>;
  /** Kurulum şeridi: kiracının kendi verisinden türetilen altı adımın durumu. */
  getOnboardingStatus(): Promise<SetupProgress>;
  addClient(name: string): Promise<Client>;
  addSite(clientId: string, url: string): Promise<Site>;
  /** Paket kotası durumu: etiket, kullanılan site sayısı, limit (null = sınırsız). */
  getSiteQuota(): Promise<{
    label: string;
    used: number;
    limit: number | null;
    trial: "none" | "active" | "expired";
    trialDaysLeft: number;
  }>;
  getClientSites(clientId: string): Promise<Site[]>;
  setClientBranding(
    clientId: string,
    input: { brandColor?: string | undefined; brandLogoUrl?: string | undefined },
  ): Promise<Client>;
  /** Rotalar için tek nokta çözümleme: yok/başkasının kaydı ayrımı sızdırılmaz. */
  resolveSite(siteId: string): Promise<Site>;
  deleteClient(clientId: string): Promise<void>;
  setBannerConfig(siteId: string, config: SiteBannerConfig | null): Promise<Site>;
  setScanSchedule(siteId: string, intervalHours: number): Promise<Site>;
  getSiteScans(siteId: string): Promise<StoredScan[]>;
  ingestScan(input: {
    siteId: string;
    report: FormInventoryReport;
    cookies: ScanCookie[];
    observedTargets: RequestTarget[];
    scripts?: ScannedScript[];
  }): Promise<StoredScan>;
  ingestReceipt(siteId: string, receipt: ConsentReceipt): Promise<StoredReceiptEntry>;
  verifySite(siteId: string): Promise<boolean>;
  getSiteDsars(siteId: string): Promise<DsarRequest[]>;
  getSiteReceipts(siteId: string): Promise<StoredReceiptEntry[]>;
  saveCorrection(siteId: string, input: { fieldName: string; category: string }): Promise<Correction>;
  updateDsarStatus(
    siteId: string,
    dsarId: string,
    patch: { status?: DsarStatus | undefined; responseNote?: string | undefined; extend?: boolean | undefined },
  ): Promise<DsarRequest>;
}

export function createPanelService(store: PanelStore, context: PanelContext): PanelService {
  const role = context.role ?? "owner";
  const assertClientOwnership = async (clientId: string): Promise<Client> => {
    const clients = await store.listClients(context.tenantId);
    const client = clients.find((c) => c.id === clientId);
    if (!client) deny();
    return client!;
  };

  const assertSiteOwnership = async (siteId: string): Promise<Site> => {
    const site = await store.getSite(siteId);
    if (!site) deny();
    const clients = await store.listClients(context.tenantId);
    if (!clients.some((c) => c.id === site!.clientId)) deny();
    return site!;
  };

  return {
    async getClientList() {
      return store.listClients(context.tenantId);
    },

    async getOnboardingStatus() {
      const user = await store.findUserByTenant(context.tenantId);
      const status: SetupProgress = {
        hasClient: false,
        hasSite: false,
        hasScan: false,
        emailVerified: Boolean(user?.emailVerifiedAt),
        hasEmbed: false,
        hasBanner: false,
      };
      const clients = await store.listClients(context.tenantId);
      if (!clients.length) return status;
      status.hasClient = true;
      let firstSiteId: string | undefined;
      for (const client of clients) {
        const sites = await store.listSites(client.id);
        if (sites.length) {
          status.hasSite = true;
          firstSiteId ??= sites[0]!.id;
        }
        for (const site of sites) {
          if (site.bannerConfig) status.hasBanner = true;
          if (site.embedLastSeenAt) status.hasEmbed = true;
          if (!status.hasScan && (await store.listScans(site.id)).length) status.hasScan = true;
        }
      }
      return {
        ...status,
        firstClientId: clients[0]!.id,
        ...(firstSiteId ? { firstSiteId } : {}),
      };
    },

    async addClient(name) {
      denyAuditor(role);
      const client = await store.createClient({ tenantId: context.tenantId, name });
      await store.recordAudit(context.tenantId, "client.created", { clientId: client.id, name });
      return client;
    },

    async addSite(clientId, url) {
      denyAuditor(role);
      await assertClientOwnership(clientId);
      const tenant = await store.getTenant(context.tenantId);
      const limit = PLAN_LIMITS[effectivePackage(tenant ?? { package: "starter" })];
      if (limit !== null && (await store.countSitesByTenant(context.tenantId)) >= limit) {
        throw new Error("site kotası doldu");
      }
      assertPublicHttpUrl(url);
      const site = await store.createSite({ clientId, url });
      await store.recordAudit(context.tenantId, "site.created", {
        siteId: site.id,
        url,
      });
      return site;
    },

    async getSiteQuota() {
      const tenant = await store.getTenant(context.tenantId);
      const base = tenant ?? { package: "starter" as const };
      const pkg = effectivePackage(base);
      const daysLeft = trialDaysLeft(tenant?.trialEndsAt);
      return {
        label: PLAN_LABELS[pkg],
        used: await store.countSitesByTenant(context.tenantId),
        limit: PLAN_LIMITS[pkg],
        trial: daysLeft === null ? ("none" as const) : daysLeft > 0 ? ("active" as const) : ("expired" as const),
        trialDaysLeft: daysLeft ?? 0,
      };
    },

    async getClientSites(clientId) {
      await assertClientOwnership(clientId);
      return store.listSites(clientId);
    },

    async setClientBranding(clientId, input) {
      denyAuditor(role);
      await assertClientOwnership(clientId);
      const client = await store.setClientBranding(clientId, input);
      await store.recordAudit(context.tenantId, "client.branding", {
        clientId,
        brandColor: input.brandColor ?? null,
        brandLogoUrl: input.brandLogoUrl ?? null,
      });
      return client;
    },

    async resolveSite(siteId) {
      return assertSiteOwnership(siteId);
    },

    async deleteClient(clientId) {
      denyAuditor(role);
      await assertClientOwnership(clientId);
      await store.deleteClient(clientId);
      await store.recordAudit(context.tenantId, "client.deleted", { clientId });
    },

    async setBannerConfig(siteId, config) {
      denyAuditor(role);
      await assertSiteOwnership(siteId);
      const site = await store.setBannerConfig(siteId, config);
      await store.recordAudit(context.tenantId, "banner.configured", {
        siteId,
        bannerVersion: config?.bannerVersion ?? null,
      });
      return site;
    },

    async setScanSchedule(siteId, intervalHours) {
      denyAuditor(role);
      await assertSiteOwnership(siteId);
      const site = await store.setScanSchedule(siteId, intervalHours);
      await store.recordAudit(context.tenantId, "scan.schedule.changed", {
        siteId,
        intervalHours,
      });
      return site;
    },

    async getSiteScans(siteId) {
      await assertSiteOwnership(siteId);
      return store.listScans(siteId);
    },

    async ingestScan(input) {
      denyAuditor(role);
      await assertSiteOwnership(input.siteId);
      return store.saveScan(input);
    },

    async ingestReceipt(siteId, receipt) {
      denyAuditor(role);
      await assertSiteOwnership(siteId);
      return store.appendReceipt({ siteId, receipt });
    },

    async verifySite(siteId) {
      await assertSiteOwnership(siteId);
      return store.verifySiteChain(siteId);
    },

    async getSiteDsars(siteId) {
      await assertSiteOwnership(siteId);
      return store.listDsars(siteId);
    },

    async getSiteReceipts(siteId) {
      await assertSiteOwnership(siteId);
      return store.listReceipts(siteId);
    },

    async saveCorrection(siteId, input) {
      denyAuditor(role);
      await assertSiteOwnership(siteId);
      const correction = await store.saveCorrection(siteId, input);
      await store.recordAudit(context.tenantId, "correction.saved", {
        siteId,
        fieldName: input.fieldName,
        category: input.category,
      });
      return correction;
    },

    async updateDsarStatus(siteId, dsarId, patch) {
      denyAuditor(role);
      await assertSiteOwnership(siteId);
      return store.updateDsar(siteId, dsarId, patch);
    },
  };
}
