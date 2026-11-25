import { describe, expect, it } from "vitest";
import { createInMemoryPanelStore, type PanelStore } from "../panel/store.js";
import type { FormInventoryReport, ReportForm } from "../report/types.js";
import { runScheduledScans, type SiteScanner } from "./scheduler-run.js";
import type { ScanResult } from "./scan.js";

/**
 * Worker döngüsü testleri tarayıcı başlatmaz: tarama işi `scan` enjeksiyonuyla
 * verilir. Gerçek headless tarayıcı yolu src/scanner/scan.test.ts'de ölçülür.
 */

const SITE_URL = "https://ornek-musteri.com/";
const DEAD_URL = "http://127.0.0.1:1/";

const EMAIL_FORM: ReportForm[] = [
  { ref: "form-0", fields: [{ name: "email", category: "email" }] },
];

const EMAIL_PLUS_TCKN_FORM: ReportForm[] = [
  {
    ref: "form-0",
    fields: [
      { name: "email", category: "email" },
      { name: "tcno", category: "tckn" },
    ],
  },
];

function scanResult(url: string, forms: ReportForm[]): ScanResult {
  const report: FormInventoryReport = {
    siteOrigin: url,
    formCount: forms.length,
    fieldCount: forms.reduce((total, form) => total + form.fields.length, 0),
    categoryCounts: [{ category: "email", forms: forms.length }],
    destinations: [{ origin: url, forms: forms.length, sameOrigin: true }],
    riskFlags: [],
    review: [],
    forms,
  };
  return { url, finalUrl: url, report, observedTargets: [], cookies: [], scripts: [] };
}

/** handler'ı kaçıncı çağrı olduğuyla besler; görülen URL'leri sayarak bırakır. */
function recorder(
  handler: (url: string, call: number) => ScanResult,
): { scan: SiteScanner; urls: string[] } {
  const urls: string[] = [];
  const scan: SiteScanner = async (url) => {
    urls.push(url);
    return handler(url, urls.length);
  };
  return { scan, urls };
}

async function seededStore(
  intervalHours: number | null,
): Promise<{ store: PanelStore; siteId: string; tenantId: string }> {
  const store = createInMemoryPanelStore();
  const tenant = await store.createTenant({ name: "A", kind: "direct" });
  const client = await store.createClient({ tenantId: tenant.id, name: "M" });
  const site = await store.createSite({ tenantId: tenant.id, clientId: client.id, url: SITE_URL });
  if (intervalHours !== null) await store.setScanSchedule(tenant.id, site.id, intervalHours);
  return { store, siteId: site.id, tenantId: tenant.id };
}

describe("runScheduledScans (worker döngüsü)", () => {
  it("çizelgesi açık ve vakti gelen siteleri tarayıp kaydeder; ikinci tur atlar", async () => {
    const { store, siteId } = await seededStore(24);
    const { scan, urls } = recorder((url) => scanResult(url, EMAIL_FORM));

    const first = await runScheduledScans(store, { scan });
    expect(first.scanned, JSON.stringify(first.failed)).toHaveLength(1);
    expect(first.scanned[0]!.siteId).toBe(siteId);
    expect(first.scanned[0]!.report.formCount).toBe(1);

    // ikinci tur: az önce tarandı, 24 saat dolmadı → vakti yok
    const second = await runScheduledScans(store, { scan });
    expect(second.scanned).toHaveLength(0);
    expect(await store.listAllScans(siteId)).toHaveLength(1);
    expect(urls).toHaveLength(1);
  });

  it("çizelgesi kapalı siteler atlanır", async () => {
    const { store } = await seededStore(null);
    const { scan, urls } = recorder((url) => {
      throw new Error(`kapalı site tarandı: ${url}`);
    });

    const result = await runScheduledScans(store, { scan });
    expect(result.scanned).toHaveLength(0);
    expect(urls).toHaveLength(0);
  });

  it("tarama hatası sonucu düşürür ve diğer siteleri engellemez", async () => {
    const store = createInMemoryPanelStore();
    const tenant = await store.createTenant({ name: "A", kind: "direct" });
    const client = await store.createClient({ tenantId: tenant.id, name: "M" });
    const deadSite = await store.createSite({ tenantId: tenant.id, clientId: client.id, url: DEAD_URL });
    await store.setScanSchedule(tenant.id, deadSite.id, 24);
    const good = await store.createSite({ tenantId: tenant.id, clientId: client.id, url: SITE_URL });
    await store.setScanSchedule(tenant.id, good.id, 24);

    const { scan, urls } = recorder((url) => {
      if (url === DEAD_URL) throw new Error("connect ECONNREFUSED 127.0.0.1:1");
      return scanResult(url, EMAIL_FORM);
    });

    const result = await runScheduledScans(store, { scan });
    expect(result.failed.map((f) => f.siteId)).toContain(deadSite.id);
    expect(result.scanned.map((s) => s.siteId)).toContain(good.id);
    expect(urls).toHaveLength(2);
  });

  it("değişiklik tespit edilirse notifier çağrılır ve sahip e-postalanır", async () => {
    const { store, siteId, tenantId } = await seededStore(24);
    await store.createUser({
      tenantId,
      email: "owner@ajans.com",
      passwordHash: "scrypt:aa:bb",
      role: "owner",
    });

    let fakeNow = Date.now();
    const { scan } = recorder((url, call) =>
      scanResult(url, call === 1 ? EMAIL_FORM : EMAIL_PLUS_TCKN_FORM),
    );
    await runScheduledScans(store, { scan, now: () => fakeNow });

    // 25 saat ileri: aynı site yeniden taranır ve yeni bir alan çıkar
    fakeNow += 25 * 3_600_000;
    const sent: Array<{ to: string; subject: string }> = [];
    const result = await runScheduledScans(store, {
      scan,
      now: () => fakeNow,
      notifier: async (email) => {
        sent.push({ to: email.to, subject: email.subject });
      },
    });

    expect(result.scanned).toHaveLength(1);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toBe("owner@ajans.com");
    expect(sent[0]!.subject).toContain(SITE_URL);
    expect(await store.listAllScans(siteId)).toHaveLength(2);
  });

  it("notifier hatası tarama turunu engellemez", async () => {
    const { store, siteId } = await seededStore(24);
    let fakeNow = Date.now();
    const { scan } = recorder((url, call) =>
      scanResult(url, call === 1 ? EMAIL_FORM : EMAIL_PLUS_TCKN_FORM),
    );
    await runScheduledScans(store, { scan, now: () => fakeNow });

    fakeNow += 25 * 3_600_000;
    const result = await runScheduledScans(store, {
      scan,
      now: () => fakeNow,
      notifier: async () => {
        throw new Error("SMTP down");
      },
    });

    expect(result.scanned).toHaveLength(1); // tarama yine kaydedildi
    expect(result.notified).toHaveLength(0);
    expect(await store.listAllScans(siteId)).toHaveLength(2);
  });
});
