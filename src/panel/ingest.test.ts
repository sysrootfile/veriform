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
  };
}

const decisions = { analytics: true, marketing: false, personalization: false };

async function setup() {
  const store = createInMemoryPanelStore();
  const tenant = await store.createTenant({ name: "A", kind: "direct" });
  const client = await store.createClient({ tenantId: tenant.id, name: "M" });
  const site = await store.createSite({ clientId: client.id, url: "https://musteri1.com" });
  return { store, site };
}

describe("createIngestApi", () => {
  it("geçerli token ile tarama kabul eder", async () => {
    const { store, site } = await setup();
    const api = createIngestApi(store);
    const scan = await api.scan({
      token: site.ingestToken,
      report: { ...emptyReport(), formCount: 2 },
      cookies: [],
      observedTargets: [],
    });
    expect(scan.report.formCount).toBe(2);
    expect((await store.listScans(site.id))).toHaveLength(1);
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
});
