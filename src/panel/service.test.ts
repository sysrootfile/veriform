import { describe, expect, it } from "vitest";
import { buildConsentReceipt } from "../consent/receipt.js";
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
  };
}

const decisions = { analytics: true, marketing: false, personalization: false };

async function setup() {
  const store = createInMemoryPanelStore();
  const tenantA = await store.createTenant({ name: "Ajans A", kind: "agency" });
  const tenantB = await store.createTenant({ name: "Ajans B", kind: "agency" });
  const serviceA = createPanelService(store, { tenantId: tenantA.id });
  const serviceB = createPanelService(store, { tenantId: tenantB.id });
  const clientA = await serviceA.addClient("A'nın Müşterisi");
  const siteA = await serviceA.addSite(clientA.id, "https://musteri-a.com");
  return { store, serviceA, serviceB, clientA, siteA };
}

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

  it("getClientSites yalnızca kendi client'ının sitelerini verir", async () => {
    const { serviceA, serviceB, clientA } = await setup();
    await serviceA.addSite(clientA.id, "https://ikinci.com");
    const sites = await serviceA.getClientSites(clientA.id);
    expect(sites).toHaveLength(2); // setup seed'i + yeni eklenen
    expect(sites.map((s) => s.url)).toContain("https://ikinci.com");
    await expect(serviceB.getClientSites(clientA.id)).rejects.toThrow(/erişim reddedildi/);
    await expect(serviceA.getClientSites("yok")).rejects.toThrow(/erişim reddedildi/);
  });
});
