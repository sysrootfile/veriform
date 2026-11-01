import { describe, expect, it } from "vitest";
import { buildConsentReceipt } from "../consent/receipt.js";
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
