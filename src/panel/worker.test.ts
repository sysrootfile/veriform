import { describe, expect, it } from "vitest";
import { createInMemoryPanelStore, type PanelStore } from "./store.js";
import type { EmailSender, OutgoingEmail } from "./mailer.js";
import type { FormInventoryReport, ReportForm } from "../report/types.js";
import type { ScanResult } from "../scanner/scan.js";
import type { SiteScanner } from "../scanner/scheduler-run.js";
import { handleWorkerRun } from "./worker.js";

/**
 * Worker ucu testleri tarayıcı başlatmaz: scan/now enjeksiyonu scheduler-run
 * seam'lerinden geçer. Kritik regresyon: uç, turu notifier'sız çağırıyordu —
 * cron modelinde değişiklik uyarı e-postası hiç gitmiyordu (2026-11-07 ölçümü).
 */

const SITE_URL = "https://ornek-musteri.com/";
const TOKEN = "worker-token-123";

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

function recorder(handler: (url: string, call: number) => ScanResult): SiteScanner {
  let calls = 0;
  return async (url) => {
    calls += 1;
    return handler(url, calls);
  };
}

function capturingSender(): { sender: EmailSender; sent: OutgoingEmail[] } {
  const sent: OutgoingEmail[] = [];
  return {
    sent,
    sender: {
      async send(email) {
        sent.push(email);
      },
    },
  };
}

async function seededStore(): Promise<{ store: PanelStore; siteId: string }> {
  const store = createInMemoryPanelStore();
  const tenant = await store.createTenant({ name: "A", kind: "direct" });
  await store.createUser({
    tenantId: tenant.id,
    email: "owner@ajans.com",
    passwordHash: "scrypt:aa:bb",
    role: "owner",
  });
  const client = await store.createClient({ tenantId: tenant.id, name: "M" });
  const site = await store.createSite({ clientId: client.id, url: SITE_URL });
  await store.setScanSchedule(site.id, 24);
  return { store, siteId: site.id };
}

describe("handleWorkerRun (/internal/run-scheduled)", () => {
  it("token yoksa veya yanlışsa 403 — tur hiç çalışmaz", async () => {
    const { store } = await seededStore();
    const { sender, sent } = capturingSender();
    const scan = recorder(() => {
      throw new Error("token'sız tur taradı");
    });
    const deps = { store, workerToken: TOKEN, mailSender: sender, scan };

    expect((await handleWorkerRun(deps, undefined)).status).toBe(403);
    expect((await handleWorkerRun(deps, "yanlis")).status).toBe(403);
    expect(sent).toHaveLength(0);
  });

  it("WORKER_TOKEN tanımsızsa kapı fail-closed: sunulan token ne olursa olsun 403", async () => {
    const { store } = await seededStore();
    const { sender } = capturingSender();
    const deps = { store, workerToken: null, mailSender: sender };
    expect((await handleWorkerRun(deps, TOKEN)).status).toBe(403);
    expect((await handleWorkerRun(deps, undefined)).status).toBe(403);
  });

  it("değişiklik tespitinde uyarı e-postası mailSender'a gerçekten gider", async () => {
    const { store } = await seededStore();
    const { sender, sent } = capturingSender();
    let fakeNow = Date.now();
    const scan = recorder((url, call) =>
      scanResult(url, call === 1 ? EMAIL_FORM : EMAIL_PLUS_TCKN_FORM),
    );
    const deps = { store, workerToken: TOKEN, mailSender: sender, scan, now: () => fakeNow };

    const first = await handleWorkerRun(deps, TOKEN);
    expect(first.status).toBe(200);
    expect(first.json).toMatchObject({ scanned: 1, failed: 0, notified: 0 });

    fakeNow += 25 * 3_600_000;
    const second = await handleWorkerRun(deps, TOKEN);
    expect(second.status).toBe(200);
    expect(second.json).toMatchObject({ scanned: 1, failed: 0, notified: 1 });
    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toBe("owner@ajans.com");
    expect(sent[0]!.subject).toContain(SITE_URL);
  });

  it("mailSender hatası turu düşürmez: tarama kaydedilir, notified 0 kalır", async () => {
    const { store } = await seededStore();
    let fakeNow = Date.now();
    const scan = recorder((url, call) =>
      scanResult(url, call === 1 ? EMAIL_FORM : EMAIL_PLUS_TCKN_FORM),
    );
    const sender: EmailSender = {
      async send() {
        throw new Error("SMTP down");
      },
    };
    const deps = { store, workerToken: TOKEN, mailSender: sender, scan, now: () => fakeNow };

    await handleWorkerRun(deps, TOKEN);
    fakeNow += 25 * 3_600_000;
    const result = await handleWorkerRun(deps, TOKEN);
    expect(result.status).toBe(200);
    expect(result.json).toMatchObject({ scanned: 1, failed: 0, notified: 0 });
  });

  it("tarama hatası failed sayacına düşer, tur 200 döner", async () => {
    const { store } = await seededStore();
    const { sender } = capturingSender();
    const scan = recorder(() => {
      throw new Error("connect ECONNREFUSED");
    });
    const deps = { store, workerToken: TOKEN, mailSender: sender, scan };

    const result = await handleWorkerRun(deps, TOKEN);
    expect(result.status).toBe(200);
    expect(result.json).toMatchObject({ scanned: 0, failed: 1 });
  });
});