import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildConsentReceipt } from "../consent/receipt.js";
import type { FormInventoryReport } from "../report/types.js";
import { createPostgresPanelStore, type PostgresPanelStore } from "./store.pg.js";

const PG_URL = process.env.PG_URL ?? "";
const d = PG_URL ? describe : describe.skip;

function emptyReport(): FormInventoryReport {
  return {
    siteOrigin: "https://pg-musteri.com",
    formCount: 1,
    fieldCount: 2,
    categoryCounts: [{ category: "email", forms: 1 }],
    destinations: [{ origin: "https://pg-musteri.com", forms: 1, sameOrigin: true }],
    riskFlags: [],
    review: [],
      forms: [],
  };
}

const decisions = { analytics: true, marketing: false, personalization: false };

d("createPostgresPanelStore (GERÇEK Postgres — docker veriform-pg)", () => {
  let store: PostgresPanelStore;

  beforeAll(() => {
    store = createPostgresPanelStore(PG_URL);
  });

  afterAll(async () => {
    await store.close();
  });

  it("tenant→client→site hiyerarşisi kurar ve referans bütünlüğü uygular", async () => {
    const tenant = await store.createTenant({ name: "PG Ajans", kind: "agency" });
    const client = await store.createClient({ tenantId: tenant.id, name: "PG Müşteri" });
    const site = await store.createSite({
      clientId: client.id,
      url: "https://pg-musteri.com",
    });

    expect(site.ingestToken).toMatch(/^[0-9a-f]{64}$/);
    expect((await store.getSiteByToken(site.ingestToken))?.id).toBe(site.id);
    expect((await store.listClients(tenant.id)).map((c) => c.name)).toEqual(["PG Müşteri"]);
    await expect(
      store.createClient({ tenantId: "00000000-0000-0000-0000-000000000000", name: "X" }),
    ).rejects.toThrow(/tenant/);
  });

  it("taramayı jsonb olarak yazar/okur; kurcalamadan izole kopya döner", async () => {
    const tenant = await store.createTenant({ name: "A", kind: "direct" });
    const client = await store.createClient({ tenantId: tenant.id, name: "M" });
    const site = await store.createSite({ clientId: client.id, url: "https://pg-musteri.com" });

    const saved = await store.saveScan({
      siteId: site.id,
      report: emptyReport(),
      cookies: [{ name: "_fbp", domain: ".", category: "marketing" }],
      observedTargets: [{ origin: "https://3p.example", path: "/c", via: "xhr" }],
    });
    expect(saved.report.categoryCounts).toEqual([{ category: "email", forms: 1 }]);

    const scans = await store.listScans(site.id);
    expect(scans).toHaveLength(1);
    expect(scans[0]!.cookies[0]!.name).toBe("_fbp");
    scans[0]!.report.formCount = 999;
    expect((await store.listScans(site.id))[0]!.report.formCount).toBe(1);
  });

  it("kanıt zinciri gerçek veritabanında doğrulanır; sahte selfHash reddedilir", async () => {
    const tenant = await store.createTenant({ name: "B", kind: "direct" });
    const client = await store.createClient({ tenantId: tenant.id, name: "M2" });
    const site = await store.createSite({ clientId: client.id, url: "https://pg2.com" });

    const r1 = await buildConsentReceipt({
      site: "https://pg2.com",
      bannerVersion: "banner-2026-11",
      textsHash: "aaa111",
      decisions,
      timestamp: "2026-11-02T10:00:00.000Z",
    });
    const entry1 = await store.appendReceipt({ siteId: site.id, receipt: r1 });
    expect(entry1.prevChainHash).toMatch(/^[0-9a-f]{64}$/);

    await expect(
      store.appendReceipt({ siteId: site.id, receipt: { ...r1, selfHash: "f".repeat(64) } }),
    ).rejects.toThrow(/selfHash/);

    const r2 = await buildConsentReceipt({
      site: "https://pg2.com",
      bannerVersion: "banner-2026-11",
      textsHash: "aaa111",
      decisions,
      timestamp: "2026-11-02T10:01:00.000Z",
    });
    await store.appendReceipt({ siteId: site.id, receipt: r2 });

    expect(await store.verifySiteChain(site.id)).toBe(true);
  });

  it("eşzamanlı kanıt kabulleri zinciri çatallamaz (advisory lock)", async () => {
    const tenant = await store.createTenant({ name: "D", kind: "direct" });
    const client = await store.createClient({ tenantId: tenant.id, name: "M4" });
    const site = await store.createSite({ clientId: client.id, url: "https://pg4.com" });

    const receipts = await Promise.all(
      [0, 1, 2].map((i) =>
        buildConsentReceipt({
          site: "https://pg4.com",
          bannerVersion: "banner-2026-11",
          textsHash: "aaa111",
          decisions,
          timestamp: `2026-11-02T10:00:0${i}.000Z`,
        }),
      ),
    );
    await Promise.all(
      receipts.map((receipt) => store.appendReceipt({ siteId: site.id, receipt })),
    );

    expect(await store.verifySiteChain(site.id)).toBe(true);
  });

  it("DSAR gerçek veritabanında saklanır: süre hesabı, uzatma, durum geçişi", async () => {
    const tenant = await store.createTenant({ name: "C", kind: "direct" });
    const client = await store.createClient({ tenantId: tenant.id, name: "M3" });
    const site = await store.createSite({ clientId: client.id, url: "https://pg3.com" });

    const dsar = await store.saveDsar({
      siteId: site.id,
      type: "silme",
      subjectName: "Mehmet Kaya",
      subjectEmail: "mehmet@example.com",
      receivedAt: "2026-11-02T10:00:00.000Z",
    });
    expect(dsar.deadlineAt).toBe("2026-12-02T10:00:00.000Z");

    const extended = await store.updateDsar(dsar.id, { extend: true });
    expect(extended.deadlineAt).toBe("2027-01-01T10:00:00.000Z");
    await expect(store.updateDsar(dsar.id, { extend: true })).rejects.toThrow(/zaten/);

    const done = await store.updateDsar(dsar.id, {
      status: "completed",
      responseNote: "Silme işlemi tamamlandı",
    });
    expect(done.status).toBe("completed");
    expect(done.respondedAt).toBeDefined();
    expect((await store.listDsars(site.id))).toHaveLength(1);
  });
});
