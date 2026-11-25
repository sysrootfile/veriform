import { randomUUID } from "node:crypto";
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
      tenantId: tenant.id,
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

  it("markEmbedSeen: embed_last_seen_at sütununa yazar ve ISO okur", async () => {
    const tenant = await store.createTenant({ name: "PG Seen", kind: "agency" });
    const client = await store.createClient({ tenantId: tenant.id, name: "PG M" });
    const site = await store.createSite({ tenantId: tenant.id, clientId: client.id, url: "https://pg-seen.com" });
    expect(site.embedLastSeenAt).toBeUndefined();
    await store.markEmbedSeen(site.id);
    const seen = (await store.getSite(tenant.id, site.id))?.embedLastSeenAt;
    expect(seen).toBeDefined();
    expect(Number.isNaN(Date.parse(seen!))).toBe(false);
  });

  it("taramayı jsonb olarak yazar/okur; kurcalamadan izole kopya döner", async () => {
    const tenant = await store.createTenant({ name: "A", kind: "direct" });
    const client = await store.createClient({ tenantId: tenant.id, name: "M" });
    const site = await store.createSite({ tenantId: tenant.id, clientId: client.id, url: "https://pg-musteri.com" });

    const saved = await store.saveScan({
      siteId: site.id,
      report: emptyReport(),
      cookies: [{ name: "_fbp", domain: ".", category: "marketing" }],
      observedTargets: [{ origin: "https://3p.example", path: "/c", via: "xhr" }],
    });
    expect(saved.report.categoryCounts).toEqual([{ category: "email", forms: 1 }]);

    const scans = await store.listScans(tenant.id, site.id);
    expect(scans).toHaveLength(1);
    expect(scans[0]!.cookies[0]!.name).toBe("_fbp");
    scans[0]!.report.formCount = 999;
    expect((await store.listScans(tenant.id, site.id))[0]!.report.formCount).toBe(1);
  });

  it("kanıt zinciri gerçek veritabanında doğrulanır; sahte selfHash reddedilir", async () => {
    const tenant = await store.createTenant({ name: "B", kind: "direct" });
    const client = await store.createClient({ tenantId: tenant.id, name: "M2" });
    const site = await store.createSite({ tenantId: tenant.id, clientId: client.id, url: "https://pg2.com" });

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

    expect(await store.verifySiteChain(tenant.id, site.id)).toBe(true);
  });

  it("eşzamanlı kanıt kabulleri zinciri çatallamaz (advisory lock)", async () => {
    const tenant = await store.createTenant({ name: "D", kind: "direct" });
    const client = await store.createClient({ tenantId: tenant.id, name: "M4" });
    const site = await store.createSite({ tenantId: tenant.id, clientId: client.id, url: "https://pg4.com" });

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

    expect(await store.verifySiteChain(tenant.id, site.id)).toBe(true);
  });

  it("DSAR gerçek veritabanında saklanır: süre hesabı, uzatma, durum geçişi", async () => {
    const tenant = await store.createTenant({ name: "C", kind: "direct" });
    const client = await store.createClient({ tenantId: tenant.id, name: "M3" });
    const site = await store.createSite({ tenantId: tenant.id, clientId: client.id, url: "https://pg3.com" });

    const dsar = await store.saveDsar({
      siteId: site.id,
      type: "silme",
      subjectName: "Mehmet Kaya",
      subjectEmail: "mehmet@example.com",
      receivedAt: "2026-11-02T10:00:00.000Z",
    });
    expect(dsar.deadlineAt).toBe("2026-12-02T10:00:00.000Z");

    const extended = await store.updateDsar(tenant.id, site.id, dsar.id, { extend: true });
    expect(extended.deadlineAt).toBe("2027-01-01T10:00:00.000Z");
    await expect(store.updateDsar(tenant.id, site.id, dsar.id, { extend: true })).rejects.toThrow(/zaten/);

    const done = await store.updateDsar(tenant.id, site.id, dsar.id, {
      status: "completed",
      responseNote: "Silme işlemi tamamlandı",
    });
    expect(done.status).toBe("completed");
    expect(done.respondedAt).toBeDefined();
    expect((await store.listDsars(tenant.id, site.id))).toHaveLength(1);
  });

  it("updateDsar gerçek DB'de başka sitenin başvurusunu güncelleyemez", async () => {
    const tenant = await store.createTenant({ name: "Sahiplik", kind: "direct" });
    const client = await store.createClient({ tenantId: tenant.id, name: "MS" });
    const siteA = await store.createSite({ tenantId: tenant.id, clientId: client.id, url: "https://pg-sahip-a.com" });
    const siteB = await store.createSite({ tenantId: tenant.id, clientId: client.id, url: "https://pg-sahip-b.com" });
    const dsar = await store.saveDsar({
      siteId: siteA.id,
      type: "silme",
      subjectName: "Sahne Adı",
      subjectEmail: "sahip@example.com",
      receivedAt: "2026-11-02T10:00:00.000Z",
    });

    await expect(store.updateDsar(tenant.id, siteB.id, dsar.id, { status: "completed" })).rejects.toThrow(
      /başvuru bulunamadı/,
    );
    expect((await store.listDsars(tenant.id, siteA.id))[0]!.status).toBe("new");
  });

  it("invalidateSessions gerçek DB'de oturum geçerlilik anını şimdiye çeker", async () => {
    const tenant = await store.createTenant({ name: "Oturum", kind: "direct" });
    const user = await store.createUser({
      tenantId: tenant.id,
      email: `oturum-pg-${randomUUID()}@example.com`,
      passwordHash: "h",
    });
    expect(user.sessionsValidAfter).toBe("1970-01-01T00:00:00.000Z");

    await store.invalidateSessions(user.id);

    const found = await store.findUserByTenant(tenant.id);
    expect(Date.parse(found!.sessionsValidAfter)).toBeGreaterThan(Date.now() - 60_000);
  });

  it("ping gerçek DB'ye select 1 atar; erişilemeyen DB'de reddedilir", async () => {
    await expect(store.ping()).resolves.toBeUndefined();

    const broken = createPostgresPanelStore("postgres://postgres:yanlis@127.0.0.1:1/yok");
    try {
      await expect(broken.ping()).rejects.toThrow();
    } finally {
      await broken.close();
    }
  });

  it("iletişim talebi gerçek veritabanında saklanır ve listelenir", async () => {
    const req = await store.createContactRequest({
      name: "PG Ajans",
      email: "pg@ajans.com",
      company: "PG A.Ş.",
      package: "ultimate",
      message: "özel kurulum talebi",
    });
    expect(req.id).toBeTruthy();
    const listed = await store.listContactRequests();
    const found = listed.find((r) => r.id === req.id);
    expect(found?.company).toBe("PG A.Ş.");
    expect(found?.package).toBe("ultimate");
    expect(found?.message).toBe("özel kurulum talebi");
  });

  it("tenant paketi gerçek DB'de saklanır; verilmezse starter", async () => {
    const explicit = await store.createTenant({ name: "PG Pro", kind: "agency", package: "pro" });
    expect(explicit.package).toBe("pro");
    expect((await store.getTenant(explicit.id))?.package).toBe("pro");
    const fallback = await store.createTenant({ name: "PG Varsayılan", kind: "agency" });
    expect(fallback.package).toBe("starter");
  });

  it("countSitesByTenant müşteriler arası toplar ve kiracıya izoledir", async () => {
    const tenant = await store.createTenant({ name: "PG Kota", kind: "agency" });
    const other = await store.createTenant({ name: "PG Başka", kind: "agency" });
    const c1 = await store.createClient({ tenantId: tenant.id, name: "M1" });
    const c2 = await store.createClient({ tenantId: tenant.id, name: "M2" });
    const oc = await store.createClient({ tenantId: other.id, name: "Yabancı" });
    expect(await store.countSitesByTenant(tenant.id)).toBe(0);
    await store.createSite({ tenantId: tenant.id, clientId: c1.id, url: "https://kota1.com" });
    await store.createSite({ tenantId: tenant.id, clientId: c2.id, url: "https://kota2.com" });
    await store.createSite({ tenantId: other.id, clientId: oc.id, url: "https://yabanci.com" });
    expect(await store.countSitesByTenant(tenant.id)).toBe(2);
    expect(await store.countSitesByTenant(other.id)).toBe(1);
    await store.deleteClient(tenant.id, c1.id);
    expect(await store.countSitesByTenant(tenant.id)).toBe(1);
  });

  it("kullanıcı doğrulama + şifre güncelleme gerçek DB'de kalıcı", async () => {
    const tenant = await store.createTenant({ name: "PG Hesap", kind: "agency" });
    const user = await store.createUser({
      tenantId: tenant.id,
      email: `pg-hesap-${randomUUID()}@ajans.com`,
      passwordHash: "hash-1",
    });
    expect(user.emailVerifiedAt).toBeUndefined();
    const byTenant = await store.findUserByTenant(tenant.id);
    expect(byTenant?.email).toBe(user.email);
    await store.setUserEmailVerified(user.id);
    await store.updateUserPassword(user.id, "hash-2");
    const found = await store.findUserByEmail(user.email);
    expect(found?.emailVerifiedAt).toBeTruthy();
    expect(found?.passwordHash).toBe("hash-2");
  });

  it("hesap token'ı tek kullanımlık, amaç-izoleli ve süreli; eşzamanlı tüketim tek kazanır", async () => {
    const tenant = await store.createTenant({ name: "PG Token", kind: "agency" });
    const user = await store.createUser({
      tenantId: tenant.id,
      email: `pg-token-${randomUUID()}@ajans.com`,
      passwordHash: "hash-t",
    });
    const tokenT = randomUUID().replaceAll("-", "").padEnd(64, "t");
    const tokenE = randomUUID().replaceAll("-", "").padEnd(64, "e");
    const expiresAt = new Date(Date.now() + 60_000).toISOString();
    await store.createAccountToken({ userId: user.id, purpose: "verify-email", tokenHash: tokenT, expiresAt });
    expect(await store.consumeAccountToken(tokenT, "reset-password")).toBeNull();
    const [a, b] = await Promise.all([
      store.consumeAccountToken(tokenT, "verify-email"),
      store.consumeAccountToken(tokenT, "verify-email"),
    ]);
    expect([a, b].filter((r) => r !== null)).toHaveLength(1);
    expect((a ?? b)?.userId).toBe(user.id);
    expect(await store.consumeAccountToken(tokenT, "verify-email")).toBeNull();

    await store.createAccountToken({
      userId: user.id,
      purpose: "reset-password",
      tokenHash: tokenE,
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });
    expect(await store.consumeAccountToken(tokenE, "reset-password")).toBeNull();
  });

  it("deleteTenant gerçek DB'de cascade eder: kullanıcı, müşteri, site, token gider", async () => {
    const tenant = await store.createTenant({ name: "PG Sil", kind: "agency" });
    const user = await store.createUser({
      tenantId: tenant.id,
      email: `pg-sil-${randomUUID()}@ajans.com`,
      passwordHash: "hash-s",
    });
    const client = await store.createClient({ tenantId: tenant.id, name: "Silinecek" });
    await store.createSite({ tenantId: tenant.id, clientId: client.id, url: "https://sil-pg.com" });
    const tokenS = randomUUID().replaceAll("-", "").padEnd(64, "s");
    await store.createAccountToken({
      userId: user.id,
      purpose: "verify-email",
      tokenHash: tokenS,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    await store.deleteTenant(tenant.id);
    expect(await store.getTenant(tenant.id)).toBeNull();
    expect(await store.findUserByEmail(user.email)).toBeNull();
    expect(await store.listClients(tenant.id)).toEqual([]);
    expect(await store.consumeAccountToken(tokenS, "verify-email")).toBeNull();
    await expect(store.deleteTenant(tenant.id)).rejects.toThrow(/tenant bulunamadı/);
  });
});

d("operatör portları (gerçek PG)", () => {
  it("setContactHandled gerçek DB'de kalıcı; listTenants ve setTenantPackage çalışır", async () => {
    const store = createPostgresPanelStore(PG_URL);
    try {
      const req = await store.createContactRequest({
        name: "PG Op",
        email: `pg-op-${randomUUID()}@x.com`,
        message: "operatör testi",
      });
      expect(req.handledAt).toBeUndefined();
      await store.setContactHandled(req.id, true);
      const marked = (await store.listContactRequests()).find((r) => r.id === req.id);
      expect(marked?.handledAt).toBeTruthy();
      await store.setContactHandled(req.id, false);
      const unmarked = (await store.listContactRequests()).find((r) => r.id === req.id);
      expect(unmarked?.handledAt).toBeUndefined();
      await expect(store.setContactHandled(randomUUID(), true)).rejects.toThrow(/talep bulunamadı/);

      const t = await store.createTenant({ name: `PG Op ${randomUUID()}`, kind: "agency" });
      const listed = await store.listTenants();
      expect(listed.some((x) => x.id === t.id)).toBe(true);
      await store.setTenantPackage(t.id, "pro");
      expect((await store.getTenant(t.id))?.package).toBe("pro");
      await expect(store.setTenantPackage(randomUUID(), "pro")).rejects.toThrow(/tenant bulunamadı/);
    } finally {
      await store.close();
    }
  });
});

d("deneme + plan geçiş talepleri (gerçek PG)", () => {
  let store: PostgresPanelStore;

  beforeAll(() => {
    store = createPostgresPanelStore(PG_URL);
  });

  afterAll(async () => {
    await store.close();
  });

  it("trialEndsAt gerçek DB'de kalıcı; setTenantPackage denemeyi temizler", async () => {
    const ends = "2026-12-08T00:00:00.000Z";
    const t = await store.createTenant({ name: `PG Deneme ${randomUUID()}`, kind: "agency", package: "pro", trialEndsAt: ends });
    expect(t.trialEndsAt).toBe(ends);
    expect((await store.getTenant(t.id))?.trialEndsAt).toBe(ends);
    await store.setTenantPackage(t.id, "ultimate");
    const after = await store.getTenant(t.id);
    expect(after?.package).toBe("ultimate");
    expect(after?.trialEndsAt).toBeUndefined();
  });

  it("plan talebi akışı: pending tekliği, onay paketi uygular + denemeyi temizler, ret değiştirmez", async () => {
    const t = await store.createTenant({
      name: `PG Plan ${randomUUID()}`,
      kind: "agency",
      package: "starter",
      trialEndsAt: "2026-12-08T00:00:00.000Z",
    });
    const req = await store.createPlanChangeRequest({ tenantId: t.id, toPackage: "pro" });
    expect(req.fromPackage).toBe("starter");
    expect(req.status).toBe("pending");
    await expect(store.createPlanChangeRequest({ tenantId: t.id, toPackage: "ultimate" })).rejects.toThrow(/bekleyen/);
    await expect(store.createPlanChangeRequest({ tenantId: t.id, toPackage: "starter" })).rejects.toThrow(/bekleyen|zaten bu pakettesiniz/);

    const decided = await store.decidePlanChangeRequest(req.id, "approved");
    expect(decided.status).toBe("approved");
    expect(decided.decidedAt).toBeTruthy();
    const after = await store.getTenant(t.id);
    expect(after?.package).toBe("pro");
    expect(after?.trialEndsAt).toBeUndefined();
    await expect(store.decidePlanChangeRequest(req.id, "rejected")).rejects.toThrow(/sonuçlanmış/);

    const req2 = await store.createPlanChangeRequest({ tenantId: t.id, toPackage: "ultimate" });
    expect((await store.decidePlanChangeRequest(req2.id, "rejected")).status).toBe("rejected");
    expect((await store.getTenant(t.id))?.package).toBe("pro");
    expect((await store.listPlanChangeRequests(t.id)).map((r) => r.id).sort()).toEqual([req.id, req2.id].sort());
  });

  it("eşzamanlı karar tek kazanır; deleteTenant talepleri cascade eder", async () => {
    const t = await store.createTenant({ name: `PG Yarış ${randomUUID()}`, kind: "agency" });
    const req = await store.createPlanChangeRequest({ tenantId: t.id, toPackage: "pro" });
    const results = await Promise.allSettled([
      store.decidePlanChangeRequest(req.id, "approved"),
      store.decidePlanChangeRequest(req.id, "rejected"),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);

    const t2 = await store.createTenant({ name: `PG Sil Plan ${randomUUID()}`, kind: "agency" });
    const req2 = await store.createPlanChangeRequest({ tenantId: t2.id, toPackage: "pro" });
    await store.deleteTenant(t2.id);
    expect((await store.listPlanChangeRequests()).some((r) => r.id === req2.id)).toBe(false);
  });
});
