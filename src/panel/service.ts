import type { RequestTarget } from "../collector/targets.js";
import type { ConsentReceipt } from "../consent/receipt.js";
import type { DsarRequest, DsarStatus } from "../dsar/types.js";
import type { FormInventoryReport } from "../report/types.js";
import type { StoredReceiptEntry } from "./chain.js";
import type { PanelStore } from "./store.js";
import type { Client, ScanCookie, Site, SiteBannerConfig, StoredScan } from "./types.js";

/**
 * Panel servis katmanı — HTTP handler'ların çağıracağı uygulama sözleşmesi.
 * Her işlem kiracı bağlamıyla çalışır ve sahiplik doğrular: RLS'in üstünde
 * savunma-derinliği katmanı. Hata mesajları varoluş sızdırmaz — bulunamayan
 * ile başkasının kaydı arasında ayrım yapılmaz.
 */

export interface PanelContext {
  tenantId: string;
}

function deny(): never {
  throw new Error("erişim reddedildi");
}

export interface PanelService {
  getClientList(): Promise<Client[]>;
  addClient(name: string): Promise<Client>;
  addSite(clientId: string, url: string): Promise<Site>;
  getClientSites(clientId: string): Promise<Site[]>;
  deleteClient(clientId: string): Promise<void>;
  setBannerConfig(siteId: string, config: SiteBannerConfig | null): Promise<Site>;
  getSiteScans(siteId: string): Promise<StoredScan[]>;
  ingestScan(input: {
    siteId: string;
    report: FormInventoryReport;
    cookies: ScanCookie[];
    observedTargets: RequestTarget[];
  }): Promise<StoredScan>;
  ingestReceipt(siteId: string, receipt: ConsentReceipt): Promise<StoredReceiptEntry>;
  verifySite(siteId: string): Promise<boolean>;
  getSiteDsars(siteId: string): Promise<DsarRequest[]>;
  updateDsarStatus(
    siteId: string,
    dsarId: string,
    patch: { status?: DsarStatus | undefined; responseNote?: string | undefined; extend?: boolean | undefined },
  ): Promise<DsarRequest>;
}

export function createPanelService(store: PanelStore, context: PanelContext): PanelService {
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

    async addClient(name) {
      return store.createClient({ tenantId: context.tenantId, name });
    },

    async addSite(clientId, url) {
      await assertClientOwnership(clientId);
      return store.createSite({ clientId, url });
    },

    async getClientSites(clientId) {
      await assertClientOwnership(clientId);
      return store.listSites(clientId);
    },

    async deleteClient(clientId) {
      await assertClientOwnership(clientId);
      await store.deleteClient(clientId);
    },

    async setBannerConfig(siteId, config) {
      await assertSiteOwnership(siteId);
      return store.setBannerConfig(siteId, config);
    },

    async getSiteScans(siteId) {
      await assertSiteOwnership(siteId);
      return store.listScans(siteId);
    },

    async ingestScan(input) {
      await assertSiteOwnership(input.siteId);
      return store.saveScan(input);
    },

    async ingestReceipt(siteId, receipt) {
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

    async updateDsarStatus(siteId, dsarId, patch) {
      await assertSiteOwnership(siteId);
      return store.updateDsar(dsarId, patch);
    },
  };
}
