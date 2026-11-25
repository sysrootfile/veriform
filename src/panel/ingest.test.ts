import { describe, expect, it } from "vitest";
import { buildConsentReceipt } from "../consent/receipt.js";
import type { FormInventoryReport } from "../report/types.js";
import { createInMemoryPanelStore } from "./store.js";
import { createIngestApi, IngestError } from "./ingest.js";

function emptyReport(): FormInventoryReport {
  return {
    siteOrigin: "https://musteri1.com",
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
  const tenant = await store.createTenant({ name: "A", kind: "direct" });
  const client = await store.createClient({ tenantId: tenant.id, name: "M" });
  const site = await store.createSite({ tenantId: tenant.id, clientId: client.id, url: "https://musteri1.com" });
  return { store, site, tenantId: tenant.id };
}

describe("createIngestApi", () => {
  it("geçerli token ile tarama kabul eder", async () => {
    const { store, site, tenantId } = await setup();
    const api = createIngestApi(store);
    const scan = await api.scan({
      token: site.ingestToken,
      report: { ...emptyReport(), formCount: 2 },
      cookies: [],
      observedTargets: [],
    });
    expect(scan.report.formCount).toBe(2);
    expect((await store.listScans(tenantId, site.id))).toHaveLength(1);
  });

  it("yanlış token taramayı 401 ile reddeder", async () => {
    const { store } = await setup();
    const api = createIngestApi(store);
    const err = await api
      .scan({ token: "yok", report: emptyReport(), cookies: [], observedTargets: [] })
      .catch((e) => e);
    expect(err).toBeInstanceOf(IngestError);
    expect((err as IngestError).status).toBe(401);
  });

  it("geçerli token ile kanıt kabul eder; sahte selfHash 422 olur", async () => {
    const { store, site } = await setup();
    const api = createIngestApi(store);
    const receipt = await buildConsentReceipt({
      site: "https://musteri1.com",
      bannerVersion: "banner-2026-11",
      textsHash: "aaa111",
      decisions,
      timestamp: "2026-11-01T10:00:00.000Z",
    });

    const entry = await api.receipt({ token: site.ingestToken, receipt });
    expect(entry.chainHash).toMatch(/^[0-9a-f]{64}$/);

    const err = await api
      .receipt({ token: site.ingestToken, receipt: { ...receipt, selfHash: "f".repeat(64) } })
      .catch((e) => e);
    expect(err).toBeInstanceOf(IngestError);
    expect((err as IngestError).status).toBe(422);

    const err401 = await api
      .receipt({ token: "yok", receipt })
      .catch((e) => e);
    expect((err401 as IngestError).status).toBe(401);
  });

  it("geçersiz tarama gövdesi 400 döner (şekil doğrulaması — as never yok)", async () => {
    const { site, store } = await setup();
    const api = createIngestApi(store);
    const bad = await api
      .scan({ token: site.ingestToken, report: { siteOrigin: 42 }, cookies: [], observedTargets: [] })
      .catch((e) => e);
    expect(bad).toBeInstanceOf(IngestError);
    expect((bad as IngestError).status).toBe(400);
  });

  it("cookies/observedTargets verilmemişse boş kabul edilir", async () => {
    const { store, site } = await setup();
    const api = createIngestApi(store);
    const scan = await api.scan({
      token: site.ingestToken,
      report: {
        siteOrigin: "https://musteri1.com",
        formCount: 1,
        fieldCount: 1,
        categoryCounts: [],
        destinations: [],
        riskFlags: [],
        review: [],
      forms: [],
      },
    });
    expect(scan.cookies).toEqual([]);
    expect(scan.observedTargets).toEqual([]);
  });

  it("insan düzeltmesi: correction map ingest'te rapora uygulanır", async () => {
    const { store, site, tenantId } = await setup();
    await store.saveCorrection(tenantId, site.id, { fieldName: "aciklama", category: "address" });
    const api = createIngestApi(store);
    const scan = await api.scan({
      token: site.ingestToken,
      report: {
        siteOrigin: "https://musteri1.com",
        formCount: 1,
        fieldCount: 1,
        categoryCounts: [{ category: "free_text", forms: 1 }],
        destinations: [],
        riskFlags: [],
        review: [
          {
            formRef: "form-0",
            fieldName: "aciklama",
            category: "free_text",
            confidence: 0.3,
            reason: "Sınıflandırma güveni düşük",
          },
        ],
        forms: [{ ref: "form-0", fields: [{ name: "aciklama", category: "free_text" }] }],
      },
    });
    const field = (scan.report as unknown as {
      forms: Array<{ fields: Array<{ name: string; category: string }> }>;
    }).forms[0]!.fields[0]!;
    expect(field.category).toBe("address");
    expect(scan.report.review).toHaveLength(0);
  });

  it("embedConfig: token ile banner konfigürasyonu döner; temizlenen null; yanlış token 401", async () => {
    const { store, site, tenantId } = await setup();
    await store.setBannerConfig(tenantId, site.id, {
      bannerVersion: "banner-2026-11",
      texts: { title: "T", description: "D", acceptAll: "A", rejectAll: "R" },
    });
    const api = createIngestApi(store);

    expect(await api.embedConfig({ token: site.ingestToken })).toMatchObject({
      bannerVersion: "banner-2026-11",
    });

    await store.setBannerConfig(tenantId, site.id, null);
    expect(await api.embedConfig({ token: site.ingestToken })).toBeNull();

    const err = await api.embedConfig({ token: "yok" }).catch((e) => e);
    expect((err as IngestError).status).toBe(401);
  });

  it("embedConfig bağlantı sinyali sayılır: site embedLastSeenAt damgalanır", async () => {
    const { store, site, tenantId } = await setup();
    const api = createIngestApi(store);
    expect((await store.getSite(tenantId, site.id))?.embedLastSeenAt).toBeUndefined();
    await api.embedConfig({ token: site.ingestToken });
    const seen = (await store.getSite(tenantId, site.id))?.embedLastSeenAt;
    expect(seen).toBeDefined();
    expect(Number.isNaN(Date.parse(seen!))).toBe(false);
  });
});
