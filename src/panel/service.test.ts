import { describe, expect, it } from "vitest";
import { buildConsentReceipt } from "../consent/receipt.js";
import { createIngestApi, IngestError } from "./ingest.js";
import type { FormInventoryReport } from "../report/types.js";
import { createInMemoryPanelStore } from "./store.js";
import { createPanelService } from "./service.js";

function emptyReport(): FormInventoryReport {
  return {
    siteOrigin: "https://ornek.com",
    formCount: 0,
    fieldCount: 0,
    categoryCounts: [],
    destinations: [],
    riskFlags: [],
    review: [],
      forms: [],
  };
}

const decisions = { analytics: true, marketing: false, personalization: false };

async function setup() {
  const store = createInMemoryPanelStore();
  const tenantA = await store.createTenant({ name: "Ajans A", kind: "agency" });
  const tenantB = await store.createTenant({ name: "Ajans B", kind: "agency" });
  const serviceA = createPanelService(store, { tenantId: tenantA.id, role: "owner" });
  const serviceB = createPanelService(store, { tenantId: tenantB.id, role: "owner" });
  const auditorA = createPanelService(store, { tenantId: tenantA.id, role: "auditor" });
  const clientA = await serviceA.addClient("A'nın Müşterisi");
  const siteA = await serviceA.addSite(clientA.id, "https://musteri-a.com");
  return { store, serviceA, serviceB, auditorA, clientA, siteA };
}

describe("createPanelService roller", () => {
  it("auditor okur ama mutasyon yapamaz", async () => {
    const { auditorA, clientA, siteA } = await setup();
    expect((await auditorA.getClientList()).map((c) => c.name)).toEqual(["A'nın Müşterisi"]);
    await expect(auditorA.addClient("X")).rejects.toThrow(/erişim reddedildi/);
    await expect(auditorA.addSite(clientA.id, "https://x.com")).rejects.toThrow(/erişim reddedildi/);
    await expect(auditorA.deleteClient(clientA.id)).rejects.toThrow(/erişim reddedildi/);
    await expect(auditorA.setBannerConfig(siteA.id, null)).rejects.toThrow(/erişim reddedildi/);
    await expect(
      auditorA.saveCorrection(siteA.id, { fieldName: "a", category: "email" }),
    ).rejects.toThrow(/erişim reddedildi/);
  });
});

describe("createPanelService", () => {
  it("tenant yalnızca kendi client'larını görür", async () => {
    const { serviceA, serviceB } = await setup();
    expect((await serviceA.getClientList()).map((c) => c.name)).toEqual(["A'nın Müşterisi"]);
    expect(await serviceB.getClientList()).toEqual([]);
  });

  it("cross-tenant site yazımı engellenir (IDOR defense)", async () => {
    const { serviceB, clientA } = await setup();
    await expect(serviceB.addSite(clientA.id, "https://korsan.com")).rejects.toThrow(
      /erişim reddedildi/,
    );
  });

  it("cross-tenant tarama okuması engellenir", async () => {
    const { serviceA, serviceB, siteA } = await setup();
    await serviceA.ingestScan({
      siteId: siteA.id,
      report: emptyReport(),
      cookies: [],
      observedTargets: [],
    });
    await expect(serviceB.getSiteScans(siteA.id)).rejects.toThrow(/erişim reddedildi/);
    await expect(serviceB.getSiteScans("rastgele-id")).rejects.toThrow(/erişim reddedildi/);
  });

  it("scanner taraması kabul edilir ve sahibine okunur", async () => {
    const { serviceA, siteA } = await setup();
    const scan = await serviceA.ingestScan({
      siteId: siteA.id,
      report: { ...emptyReport(), formCount: 3 },
      cookies: [{ name: "_fbp", domain: ".", category: "marketing" }],
      observedTargets: [{ origin: "https://3p.example", path: "/c" }],
    });
    expect(scan.report.formCount).toBe(3);
    const scans = await serviceA.getSiteScans(siteA.id);
    expect(scans).toHaveLength(1);
    expect(scans[0]!.cookies[0]!.name).toBe("_fbp");
  });

  it("cross-tenant kanıt kabulü engellenir; sahibi zinciri doğrular", async () => {
    const { serviceA, serviceB, siteA } = await setup();
    const receipt = await buildConsentReceipt({
      site: "https://musteri-a.com",
      bannerVersion: "banner-2026-11",
      textsHash: "aaa111",
      decisions,
      timestamp: "2026-11-01T10:00:00.000Z",
    });
    await expect(serviceB.ingestReceipt(siteA.id, receipt)).rejects.toThrow(/erişim reddedildi/);
    await serviceA.ingestReceipt(siteA.id, receipt);
    expect(await serviceA.verifySite(siteA.id)).toBe(true);
  });

  it("resolveSite: sahibine siteyi döndürür; yoksa/başkasıysa varlık sızdırmadan reddeder", async () => {
    const { serviceA, serviceB, siteA } = await setup();
    expect((await serviceA.resolveSite(siteA.id)).url).toBe("https://musteri-a.com");
    await expect(serviceA.resolveSite("yok")).rejects.toThrow(/erişim reddedildi/);
    await expect(serviceB.resolveSite(siteA.id)).rejects.toThrow(/erişim reddedildi/);
  });

  it("getSiteReceipts: guard'lı kanıt listesi (ihracat için)", async () => {
    const { store, serviceA, serviceB, siteA } = await setup();
    const receipt = await buildConsentReceipt({
      site: "https://musteri-a.com",
      bannerVersion: "banner-2026-11",
      textsHash: "aaa111",
      decisions: { analytics: true, marketing: false, personalization: false },
      timestamp: "2026-11-02T10:00:00.000Z",
    });
    await store.appendReceipt({ siteId: siteA.id, receipt });
    expect(await serviceA.getSiteReceipts(siteA.id)).toHaveLength(1);
    await expect(serviceB.getSiteReceipts(siteA.id)).rejects.toThrow(/erişim reddedildi/);
  });

  it("getClientSites yalnızca kendi client'ının sitelerini verir", async () => {
    const { serviceA, serviceB, clientA } = await setup();
    await serviceA.addSite(clientA.id, "https://ikinci.com");
    const sites = await serviceA.getClientSites(clientA.id);
    expect(sites).toHaveLength(2); // setup seed'i + yeni eklenen
    expect(sites.map((s) => s.url)).toContain("https://ikinci.com");
    await expect(serviceB.getClientSites(clientA.id)).rejects.toThrow(/erişim reddedildi/);
    await expect(serviceA.getClientSites("yok")).rejects.toThrow(/erişim reddedildi/);
  });

  it("deleteClient: sahiplik guard'lı, kiracıdan kalıcı siler", async () => {
    const { store, serviceA, serviceB, clientA } = await setup();
    await expect(serviceB.deleteClient(clientA.id)).rejects.toThrow(/erişim reddedildi/);
    await serviceA.deleteClient(clientA.id);
    expect(await serviceA.getClientList()).toHaveLength(0);
    await expect(serviceA.getClientSites(clientA.id)).rejects.toThrow(/erişim reddedildi/);
  });

  it("setClientBranding: owner ayarlar, auditor reddedilir, audit kaydı düşer", async () => {
    const { store, serviceA, auditorA, clientA } = await setup();
    const branded = await serviceA.setClientBranding(clientA.id, {
      brandColor: "#0b5394",
      brandLogoUrl: "https://musteri-a.com/logo.png",
    });
    expect(branded.brandColor).toBe("#0b5394");
    await expect(
      auditorA.setClientBranding(clientA.id, { brandColor: "#000000" }),
    ).rejects.toThrow(/erişim reddedildi/);
    // audit: son kayıt client.branding olmalı (setup ile aynı tenant)
    const site2 = await serviceA.addSite(clientA.id, "https://ikinci.com");
    expect(site2.url).toBe("https://ikinci.com");
    const log = await store.listAudit(clientA.tenantId);
    expect(log.length).toBeGreaterThanOrEqual(3); // client.created + site.created×2
  });

  it("DSAR: site token'ıyla kabul, kiracı guard'lı okuma ve güncelleme", async () => {
    const store = createInMemoryPanelStore();
    const tenantA = await store.createTenant({ name: "A", kind: "agency" });
    const serviceA = createPanelService(store, { tenantId: tenantA.id });
    const clientA = await serviceA.addClient("Müşteri");
    const siteA = await serviceA.addSite(clientA.id, "https://musteri-a.com");
    const api = createIngestApi(store);

    const dsar = await api.dsar({
      token: siteA.ingestToken,
      type: "silme",
      subjectName: "Ayşe Yılmaz",
      subjectEmail: "ayse@example.com",
    });
    expect(dsar.status).toBe("new");

    const list = await serviceA.getSiteDsars(siteA.id);
    expect(list).toHaveLength(1);

    const updated = await serviceA.updateDsarStatus(siteA.id, dsar.id, {
      status: "in-review",
    });
    expect(updated.status).toBe("in-review");

    const serviceB = createPanelService(store, {
      tenantId: (await store.createTenant({ name: "B", kind: "agency" })).id,
    });
    await expect(serviceB.getSiteDsars(siteA.id)).rejects.toThrow(/erişim reddedildi/);
    await expect(
      serviceB.updateDsarStatus(siteA.id, dsar.id, { status: "completed" }),
    ).rejects.toThrow(/erişim reddedildi/);

    const err = await api
      .dsar({
        token: "yanlış",
        type: "silme",
        subjectName: "X",
        subjectEmail: "x@x.com",
      })
      .catch((e) => e);
    expect(err).toBeInstanceOf(IngestError);
    expect((err as IngestError).status).toBe(401);
  });
});

describe("getOnboardingStatus", () => {
  it("boş kiracıda üç adım da bekler", async () => {
    const store = createInMemoryPanelStore();
    const tenant = await store.createTenant({ name: "Yeni Ajans", kind: "agency" });
    const service = createPanelService(store, { tenantId: tenant.id });
    expect(await service.getOnboardingStatus()).toEqual({
      hasClient: false,
      hasSite: false,
      hasScan: false,
    });
  });

  it("müşteri ve site var ama tarama yokken ilk iki adım tamam", async () => {
    const { serviceA } = await setup();
    expect(await serviceA.getOnboardingStatus()).toEqual({
      hasClient: true,
      hasSite: true,
      hasScan: false,
    });
  });

  it("ilk tarama gelince üçüncü adım da tamamlanır", async () => {
    const { serviceA, siteA } = await setup();
    await serviceA.ingestScan({
      siteId: siteA.id,
      report: emptyReport(),
      cookies: [],
      observedTargets: [],
    });
    expect(await serviceA.getOnboardingStatus()).toEqual({
      hasClient: true,
      hasSite: true,
      hasScan: true,
    });
  });

  it("başka kiracının verisi durumu etkilemez", async () => {
    const { serviceB } = await setup();
    expect(await serviceB.getOnboardingStatus()).toEqual({
      hasClient: false,
      hasSite: false,
      hasScan: false,
    });
  });
});

describe("site kotası (paket zorlaması)", () => {
  async function tenantWithPackage(pkg: "starter" | "pro" | "ultimate") {
    const store = createInMemoryPanelStore();
    const tenant = await store.createTenant({ name: "Kota Ajans", kind: "agency", package: pkg });
    const service = createPanelService(store, { tenantId: tenant.id });
    const client = await service.addClient("Müşteri");
    return { store, service, client };
  }

  it("starter üç siteye izin verir, dördüncüyü reddeder", async () => {
    const { service, client } = await tenantWithPackage("starter");
    for (let i = 1; i <= 3; i++) await service.addSite(client.id, `https://s${i}.com`);
    await expect(service.addSite(client.id, "https://s4.com")).rejects.toThrow(/site kotası doldu/);
  });

  it("kota müşteriler arası toplamadır — ikinci müşteride de dolar", async () => {
    const { service, client } = await tenantWithPackage("starter");
    for (let i = 1; i <= 3; i++) await service.addSite(client.id, `https://s${i}.com`);
    const client2 = await service.addClient("Müşteri 2");
    await expect(service.addSite(client2.id, "https://s4.com")).rejects.toThrow(/site kotası doldu/);
  });

  it("pro 15 siteye izin verir, 16.'yı reddeder", async () => {
    const { service, client } = await tenantWithPackage("pro");
    for (let i = 1; i <= 15; i++) await service.addSite(client.id, `https://s${i}.com`);
    await expect(service.addSite(client.id, "https://s16.com")).rejects.toThrow(/site kotası doldu/);
  });

  it("ultimate sınırsızdır", async () => {
    const { service, client } = await tenantWithPackage("ultimate");
    for (let i = 1; i <= 20; i++) await service.addSite(client.id, `https://s${i}.com`);
    expect((await service.getClientSites(client.id)).length).toBe(20);
  });

  it("site silinince kota yeniden yer açar", async () => {
    const { store, service, client } = await tenantWithPackage("starter");
    const sites = [];
    for (let i = 1; i <= 3; i++) sites.push(await service.addSite(client.id, `https://s${i}.com`));
    await store.deleteClient(client.id);
    const client2 = await service.addClient("Yeni Müşteri");
    await expect(service.addSite(client2.id, "https://yeniden.com")).resolves.toBeTruthy();
    expect(sites.length).toBe(3);
  });

  it("getSiteQuota paket etiketi, kullanım ve limiti döner", async () => {
    const { service, client } = await tenantWithPackage("pro");
    await service.addSite(client.id, "https://bir.com");
    expect(await service.getSiteQuota()).toEqual({
      label: "Pro",
      used: 1,
      limit: 15,
      trial: "none",
      trialDaysLeft: 0,
    });
  });

  it("ultimate quota limiti null döner", async () => {
    const { service } = await tenantWithPackage("ultimate");
    expect(await service.getSiteQuota()).toEqual({
      label: "Ultimate",
      used: 0,
      limit: null,
      trial: "none",
      trialDaysLeft: 0,
    });
  });

  it("deneme sürerken seçilen paket kotası geçerli; kalan gün raporlanır", async () => {
    const store = createInMemoryPanelStore();
    const tenant = await store.createTenant({
      name: "Deneme",
      kind: "agency",
      package: "pro",
      trialEndsAt: new Date(Date.now() + 5 * 86400000).toISOString(),
    });
    const service = createPanelService(store, { tenantId: tenant.id });
    const client = await service.addClient("M");
    for (let i = 1; i <= 4; i++) await service.addSite(client.id, `https://d${i}.com`);
    const quota = await service.getSiteQuota();
    expect(quota.label).toBe("Pro");
    expect(quota.limit).toBe(15);
    expect(quota.trial).toBe("active");
    expect(quota.trialDaysLeft).toBe(5);
  });

  it("deneme bittiyse kota starter'a düşer ve expired raporlanır", async () => {
    const store = createInMemoryPanelStore();
    const tenant = await store.createTenant({
      name: "Bitmiş",
      kind: "agency",
      package: "pro",
      trialEndsAt: new Date(Date.now() - 86400000).toISOString(),
    });
    const service = createPanelService(store, { tenantId: tenant.id });
    const client = await service.addClient("M");
    for (let i = 1; i <= 3; i++) await service.addSite(client.id, `https://b${i}.com`);
    await expect(service.addSite(client.id, "https://b4.com")).rejects.toThrow(/site kotası doldu/);
    const quota = await service.getSiteQuota();
    expect(quota.label).toBe("Starter");
    expect(quota.limit).toBe(3);
    expect(quota.trial).toBe("expired");
    expect(quota.trialDaysLeft).toBe(0);
  });

  it("auditor kota doluyken de mutasyon yapamaz (önce rol denetimi)", async () => {
    const store = createInMemoryPanelStore();
    const tenant = await store.createTenant({ name: "A", kind: "agency", package: "starter" });
    const owner = createPanelService(store, { tenantId: tenant.id });
    const auditor = createPanelService(store, { tenantId: tenant.id, role: "auditor" });
    const client = await owner.addClient("M");
    await expect(auditor.addSite(client.id, "https://x.com")).rejects.toThrow(/erişim reddedildi/);
  });
});
