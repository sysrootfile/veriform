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
