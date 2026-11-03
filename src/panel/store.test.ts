import { describe, expect, it } from "vitest";
import { buildConsentReceipt } from "../consent/receipt.js";
import { computeDeadline } from "../dsar/deadline.js";
import type { FormInventoryReport } from "../report/types.js";
import { createInMemoryPanelStore } from "./store.js";

function emptyReport(siteOrigin = "https://musteri1.com"): FormInventoryReport {
  return {
    siteOrigin,
    formCount: 1,
    fieldCount: 2,
    categoryCounts: [],
    destinations: [],
    riskFlags: [],
    review: [],
  };
}

const decisions = { analytics: true, marketing: false, personalization: false };

describe("createInMemoryPanelStore", () => {
  it("tenant oluşturur", async () => {
    const store = createInMemoryPanelStore();
    const tenant = await store.createTenant({ name: "Ajans A", kind: "agency" });
    expect(tenant.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(tenant.kind).toBe("agency");
    expect(tenant.name).toBe("Ajans A");
  });

  it("bilinmeyen tenant'a client eklenemez", async () => {
    const store = createInMemoryPanelStore();
    await expect(store.createClient({ tenantId: "yok", name: "X" })).rejects.toThrow(/tenant/);
  });

  it("tenant→client→site hiyerarşisi kurulur ve listelenir", async () => {
    const store = createInMemoryPanelStore();
    const tenant = await store.createTenant({ name: "Ajans A", kind: "agency" });
    const client = await store.createClient({ tenantId: tenant.id, name: "Müşteri 1" });
    const site = await store.createSite({ clientId: client.id, url: "https://musteri1.com" });

    expect(site.clientId).toBe(client.id);
    const clients = await store.listClients(tenant.id);
    expect(clients).toHaveLength(1);
    expect(clients[0]!.name).toBe("Müşteri 1");
    await expect(store.createSite({ clientId: "yok", url: "https://x.com" })).rejects.toThrow(
      /client/,
    );
  });

  it("deleteClient: client + siteleri gider, zincir kanıtlarıyla birlikte silinir", async () => {
    const store = createInMemoryPanelStore();
    const tenant = await store.createTenant({ name: "A", kind: "agency" });
    const client = await store.createClient({ tenantId: tenant.id, name: "Gidecek" });
    const site = await store.createSite({ clientId: client.id, url: "https://gidecek.com" });
    const receipt = await buildConsentReceipt({
      site: "https://gidecek.com",
      bannerVersion: "b",
      textsHash: "t",
      decisions: { analytics: true, marketing: false, personalization: false },
      timestamp: "2026-11-02T10:00:00.000Z",
    });
    await store.appendReceipt({ siteId: site.id, receipt });

    await store.deleteClient(client.id);

    expect((await store.listClients(tenant.id))).toHaveLength(0);
    expect(await store.listSites(client.id)).toEqual([]);
    expect(await store.listScans(site.id)).toEqual([]);
    expect(await store.verifySiteChain(site.id)).toBe(true); // boş zincir = silindi
    await expect(store.deleteClient("yok")).rejects.toThrow(/client/);
  });

  it("setBannerConfig: site bazlı banner konfigürasyonu yazar ve temizler", async () => {
    const store = createInMemoryPanelStore();
    const tenant = await store.createTenant({ name: "A", kind: "direct" });
    const client = await store.createClient({ tenantId: tenant.id, name: "M" });
    const site = await store.createSite({ clientId: client.id, url: "https://musteri1.com" });

    const config = {
      bannerVersion: "banner-2026-11",
      texts: {
        title: "Çerez Tercihleriniz",
        description: "Açıklama",
        acceptAll: "Tümünü Kabul Et",
        rejectAll: "Sadece Zorunlu",
      },
    };
    const updated = await store.setBannerConfig(site.id, config);
    expect(updated.bannerConfig?.bannerVersion).toBe("banner-2026-11");
    expect((await store.getSite(site.id))?.bannerConfig?.texts.title).toBe("Çerez Tercihleriniz");

    const cleared = await store.setBannerConfig(site.id, null);
    expect(cleared.bannerConfig).toBeUndefined();
    await expect(store.setBannerConfig("yok", config)).rejects.toThrow(/site/);
  });

  it("getTenant kiracıyı döndürür, bilinmeyeni null verir; marka rengi ve logosu saklanır", async () => {
    const store = createInMemoryPanelStore();
    const tenant = await store.createTenant({
      name: "Ajans A",
      kind: "agency",
      brandColor: "#127a3d",
      brandLogoUrl: "https://ajans.com/logo.png",
    });
    const fetched = await store.getTenant(tenant.id);
    expect(fetched?.name).toBe("Ajans A");
    expect(fetched?.brandColor).toBe("#127a3d");
    expect(fetched?.brandLogoUrl).toBe("https://ajans.com/logo.png");
    expect(await store.getTenant("yok")).toBeNull();
  });

  it("listSites client'ın sitelerini sıralı döndürür ve sahiplikle sınırlıdır", async () => {
    const store = createInMemoryPanelStore();
    const tenant = await store.createTenant({ name: "A", kind: "agency" });
    const client = await store.createClient({ tenantId: tenant.id, name: "M" });
    await store.createSite({ clientId: client.id, url: "https://b.com" });
    await store.createSite({ clientId: client.id, url: "https://a.com" });
    const sites = await store.listSites(client.id);
    expect(sites.map((s) => s.url)).toEqual(["https://b.com", "https://a.com"]);
    expect(await store.listSites("yok")).toEqual([]);
  });

  it("DSAR kaydedilir: süre otomatik hesaplanır; durum güncelleme ve tek seferlik uzatma", async () => {
    const store = createInMemoryPanelStore();
    const tenant = await store.createTenant({ name: "A", kind: "direct" });
    const client = await store.createClient({ tenantId: tenant.id, name: "M" });
    const site = await store.createSite({ clientId: client.id, url: "https://musteri1.com" });

    const dsar = await store.saveDsar({
      siteId: site.id,
      type: "silme",
      subjectName: "Ayşe Yılmaz",
      subjectEmail: "ayse@example.com",
      message: "Verilerimi silin",
      receivedAt: "2026-11-02T10:00:00.000Z",
    });
    expect(dsar.status).toBe("new");
    expect(dsar.deadlineAt).toBe(computeDeadline("2026-11-02T10:00:00.000Z"));
    expect((await store.listDsars(site.id))).toHaveLength(1);

    const extended = await store.updateDsar(dsar.id, { extend: true });
    expect(extended.extended).toBe(true);

    await expect(store.updateDsar(dsar.id, { extend: true })).rejects.toThrow(/zaten/);

    const done = await store.updateDsar(dsar.id, {
      status: "completed",
      responseNote: "Veriler silindi",
    });
    expect(done.status).toBe("completed");
    expect(done.respondedAt).toBeDefined();

    await expect(store.updateDsar("yok", { status: "completed" })).rejects.toThrow(/başvuru/);
  });

  it("kullanıcı oluşturulur ve e-posta ile bulunur; e-posta benzersizdir", async () => {
    const store = createInMemoryPanelStore();
    const tenant = await store.createTenant({ name: "A", kind: "direct" });
    const user = await store.createUser({
      tenantId: tenant.id,
      email: "owner@ajans.com",
      passwordHash: "scrypt:aa:bb",
    });
    expect(user.email).toBe("owner@ajans.com");
    expect(user.tenantId).toBe(tenant.id);
    expect((await store.findUserByEmail("owner@ajans.com"))?.id).toBe(user.id);
    expect(await store.findUserByEmail("yok@ajans.com")).toBeNull();
    await expect(
      store.createUser({ tenantId: tenant.id, email: "owner@ajans.com", passwordHash: "scrypt:cc:dd" }),
    ).rejects.toThrow(/e-posta/);
  });

  it("getSite var olan siteyi döndürür, bilinmeyeni null verir", async () => {
    const store = createInMemoryPanelStore();
    const tenant = await store.createTenant({ name: "A", kind: "direct" });
    const client = await store.createClient({ tenantId: tenant.id, name: "M" });
    const site = await store.createSite({ clientId: client.id, url: "https://musteri1.com" });
    expect((await store.getSite(site.id))?.url).toBe("https://musteri1.com");
    expect(await store.getSite("yok")).toBeNull();
  });

  it("her site benzersiz ingest token'ı alır ve token'la çözümlenir", async () => {
    const store = createInMemoryPanelStore();
    const tenant = await store.createTenant({ name: "A", kind: "agency" });
    const client = await store.createClient({ tenantId: tenant.id, name: "M" });
    const site1 = await store.createSite({ clientId: client.id, url: "https://a.com" });
    const site2 = await store.createSite({ clientId: client.id, url: "https://b.com" });

    expect(site1.ingestToken).toMatch(/^[0-9a-f]{64}$/);
    expect(site2.ingestToken).toMatch(/^[0-9a-f]{64}$/);
    expect(site1.ingestToken).not.toBe(site2.ingestToken);

    const resolved = await store.getSiteByToken(site1.ingestToken);
    expect(resolved?.id).toBe(site1.id);
    expect(await store.getSiteByToken("yok")).toBeNull();
  });

  it("tarama kronolojik kaydedilir; döndürülen nesne izole kopyadır", async () => {
    const store = createInMemoryPanelStore();
    const tenant = await store.createTenant({ name: "A", kind: "direct" });
    const client = await store.createClient({ tenantId: tenant.id, name: "M" });
    const site = await store.createSite({ clientId: client.id, url: "https://musteri1.com" });

    await store.saveScan({ siteId: site.id, report: emptyReport(), cookies: [], observedTargets: [] });
    await store.saveScan({
      siteId: site.id,
      report: { ...emptyReport(), formCount: 2 },
      cookies: [{ name: "_ga", domain: ".", category: "analytics" }],
      observedTargets: [],
    });

    const scans = await store.listScans(site.id);
    expect(scans).toHaveLength(2);
    expect(scans[0]!.report.formCount).toBe(1);
    expect(scans[1]!.cookies).toEqual([{ name: "_ga", domain: ".", category: "analytics" }]);

    // izolasyon: dönen kopya üzerinde kurcalama depoyu etkilemez
    scans[0]!.report.formCount = 999;
    expect((await store.listScans(site.id))[0]!.report.formCount).toBe(1);

    await expect(
      store.saveScan({ siteId: "yok", report: emptyReport(), cookies: [], observedTargets: [] }),
    ).rejects.toThrow(/site/);
  });

  it("kanıt eklenir, sahte selfHash reddedilir, zincir site bazında doğrulanır", async () => {
    const store = createInMemoryPanelStore();
    const tenant = await store.createTenant({ name: "A", kind: "direct" });
    const client = await store.createClient({ tenantId: tenant.id, name: "M" });
    const site = await store.createSite({ clientId: client.id, url: "https://musteri1.com" });

    const r1 = await buildConsentReceipt({
      site: "https://musteri1.com",
      bannerVersion: "banner-2026-11",
      textsHash: "aaa111",
      decisions,
      timestamp: "2026-11-01T10:00:00.000Z",
    });
    const entry1 = await store.appendReceipt({ siteId: site.id, receipt: r1 });
    expect(entry1.prevChainHash).toMatch(/^[0-9a-f]{64}$/);
    expect(entry1.chainHash).toMatch(/^[0-9a-f]{64}$/);

    await expect(
      store.appendReceipt({ siteId: site.id, receipt: { ...r1, selfHash: "f".repeat(64) } }),
    ).rejects.toThrow(/selfHash/);

    const r2 = await buildConsentReceipt({
      site: "https://musteri1.com",
      bannerVersion: "banner-2026-11",
      textsHash: "aaa111",
      decisions,
      timestamp: "2026-11-01T10:01:00.000Z",
    });
    await store.appendReceipt({ siteId: site.id, receipt: r2 });

    expect(await store.verifySiteChain(site.id)).toBe(true);
    await expect(store.appendReceipt({ siteId: "yok", receipt: r1 })).rejects.toThrow(/site/);
  });
});
