import { describe, expect, it } from "vitest";
import { buildConsentReceipt } from "../consent/receipt.js";
import { computeDeadline } from "../dsar/deadline.js";
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
      forms: [],
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

  it("deleteClient: client + siteleri gider, zincir kanıtlarıyla birlikte silinir", async () => {
    const store = createInMemoryPanelStore();
    const tenant = await store.createTenant({ name: "A", kind: "agency" });
    const client = await store.createClient({ tenantId: tenant.id, name: "Gidecek" });
    const site = await store.createSite({ clientId: client.id, url: "https://gidecek.com" });
    const receipt = await buildConsentReceipt({
      site: "https://gidecek.com",
      bannerVersion: "b",
      textsHash: "t",
      decisions: { analytics: true, marketing: false, personalization: false },
      timestamp: "2026-11-02T10:00:00.000Z",
    });
    await store.appendReceipt({ siteId: site.id, receipt });

    await store.deleteClient(client.id);

    expect((await store.listClients(tenant.id))).toHaveLength(0);
    expect(await store.listSites(client.id)).toEqual([]);
    expect(await store.listScans(site.id)).toEqual([]);
    expect(await store.verifySiteChain(site.id)).toBe(true); // boş zincir = silindi
    await expect(store.deleteClient("yok")).rejects.toThrow(/client/);
  });

  it("setBannerConfig: site bazlı banner konfigürasyonu yazar ve temizler", async () => {
    const store = createInMemoryPanelStore();
    const tenant = await store.createTenant({ name: "A", kind: "direct" });
    const client = await store.createClient({ tenantId: tenant.id, name: "M" });
    const site = await store.createSite({ clientId: client.id, url: "https://musteri1.com" });

    const config = {
      bannerVersion: "banner-2026-11",
      texts: {
        title: "Çerez Tercihleriniz",
        description: "Açıklama",
        acceptAll: "Tümünü Kabul Et",
        rejectAll: "Sadece Zorunlu",
      },
    };
    const updated = await store.setBannerConfig(site.id, config);
    expect(updated.bannerConfig?.bannerVersion).toBe("banner-2026-11");
    expect((await store.getSite(site.id))?.bannerConfig?.texts.title).toBe("Çerez Tercihleriniz");

    const cleared = await store.setBannerConfig(site.id, null);
    expect(cleared.bannerConfig).toBeUndefined();
    await expect(store.setBannerConfig("yok", config)).rejects.toThrow(/site/);
  });

  it("getTenant kiracıyı döndürür, bilinmeyeni null verir; marka rengi ve logosu saklanır", async () => {
    const store = createInMemoryPanelStore();
    const tenant = await store.createTenant({
      name: "Ajans A",
      kind: "agency",
      brandColor: "#127a3d",
      brandLogoUrl: "https://ajans.com/logo.png",
    });
    const fetched = await store.getTenant(tenant.id);
    expect(fetched?.name).toBe("Ajans A");
    expect(fetched?.brandColor).toBe("#127a3d");
    expect(fetched?.brandLogoUrl).toBe("https://ajans.com/logo.png");
    expect(await store.getTenant("yok")).toBeNull();
  });

  it("listSites client'ın sitelerini sıralı döndürür ve sahiplikle sınırlıdır", async () => {
    const store = createInMemoryPanelStore();
    const tenant = await store.createTenant({ name: "A", kind: "agency" });
    const client = await store.createClient({ tenantId: tenant.id, name: "M" });
    await store.createSite({ clientId: client.id, url: "https://b.com" });
    await store.createSite({ clientId: client.id, url: "https://a.com" });
    const sites = await store.listSites(client.id);
    expect(sites.map((s) => s.url)).toEqual(["https://b.com", "https://a.com"]);
    expect(await store.listSites("yok")).toEqual([]);
  });

  it("DSAR kaydedilir: süre otomatik hesaplanır; durum güncelleme ve tek seferlik uzatma", async () => {
    const store = createInMemoryPanelStore();
    const tenant = await store.createTenant({ name: "A", kind: "direct" });
    const client = await store.createClient({ tenantId: tenant.id, name: "M" });
    const site = await store.createSite({ clientId: client.id, url: "https://musteri1.com" });

    const dsar = await store.saveDsar({
      siteId: site.id,
      type: "silme",
      subjectName: "Ayşe Yılmaz",
      subjectEmail: "ayse@example.com",
      message: "Verilerimi silin",
      receivedAt: "2026-11-02T10:00:00.000Z",
    });
    expect(dsar.status).toBe("new");
    expect(dsar.deadlineAt).toBe(computeDeadline("2026-11-02T10:00:00.000Z"));
    expect((await store.listDsars(site.id))).toHaveLength(1);

    const extended = await store.updateDsar(dsar.id, { extend: true });
    expect(extended.extended).toBe(true);

    await expect(store.updateDsar(dsar.id, { extend: true })).rejects.toThrow(/zaten/);

    const done = await store.updateDsar(dsar.id, {
      status: "completed",
      responseNote: "Veriler silindi",
    });
    expect(done.status).toBe("completed");
    expect(done.respondedAt).toBeDefined();

    await expect(store.updateDsar("yok", { status: "completed" })).rejects.toThrow(/başvuru/);
  });

  it("setClientBranding: per-client marka alanları yazar ve temizler", async () => {
    const store = createInMemoryPanelStore();
    const tenant = await store.createTenant({ name: "A", kind: "agency" });
    const client = await store.createClient({ tenantId: tenant.id, name: "M" });

    const branded = await store.setClientBranding(client.id, {
      brandColor: "#0b5394",
      brandLogoUrl: "https://musteri.com/logo.png",
    });
    expect(branded.brandColor).toBe("#0b5394");
    expect(branded.brandLogoUrl).toBe("https://musteri.com/logo.png");
    expect((await store.getTenant(tenant.id))?.brandColor).toBeUndefined(); // kiracı kirletilmedi

    const cleared = await store.setClientBranding(client.id, {});
    expect(cleared.brandColor).toBeUndefined();
    expect(cleared.brandLogoUrl).toBeUndefined();
    await expect(
      store.setClientBranding("yok", { brandColor: "#000000" }),
    ).rejects.toThrow(/client/);
  });

  it("setScanSchedule: aralık yazar, 0 kapatır, bilinmeyen site reddedilir", async () => {
    const store = createInMemoryPanelStore();
    const tenant = await store.createTenant({ name: "A", kind: "direct" });
    const client = await store.createClient({ tenantId: tenant.id, name: "M" });
    const site = await store.createSite({ clientId: client.id, url: "https://musteri1.com" });

    const scheduled = await store.setScanSchedule(site.id, 24);
    expect(scheduled.scanIntervalHours).toBe(24);
    expect((await store.getSite(site.id))?.scanIntervalHours).toBe(24);

    const off = await store.setScanSchedule(site.id, 0);
    expect(off.scanIntervalHours).toBe(0);
    await expect(store.setScanSchedule("yok", 24)).rejects.toThrow(/site/);
  });

  it("saveScan scripts alanını saklar ve listScans geri döndürür", async () => {
    const store = createInMemoryPanelStore();
    const tenant = await store.createTenant({ name: "A", kind: "direct" });
    const client = await store.createClient({ tenantId: tenant.id, name: "M" });
    const site = await store.createSite({ clientId: client.id, url: "https://musteri1.com" });

    await store.saveScan({
      siteId: site.id,
      report: emptyReport(),
      cookies: [],
      observedTargets: [],
      scripts: [{ url: "https://www.googletagmanager.com/gtag/js", category: "analytics" }],
    });
    const scans = await store.listScans(site.id);
    expect(scans[0]!.scripts).toEqual([
      { url: "https://www.googletagmanager.com/gtag/js", category: "analytics" },
    ]);
  });

  it("listAllSites: tüm kiracıların sitelerini döndürür (worker için)", async () => {
    const store = createInMemoryPanelStore();
    const t1 = await store.createTenant({ name: "A", kind: "agency" });
    const t2 = await store.createTenant({ name: "B", kind: "direct" });
    const c1 = await store.createClient({ tenantId: t1.id, name: "M1" });
    const c2 = await store.createClient({ tenantId: t2.id, name: "M2" });
    await store.createSite({ clientId: c1.id, url: "https://a.com" });
    await store.createSite({ clientId: c2.id, url: "https://b.com" });
    const all = await store.listAllSites();
    expect(all.map((s) => s.url).sort()).toEqual(["https://a.com", "https://b.com"]);
  });

  it("audit log: mutasyonlar kaydedilir ve kiracı bazında listelenir", async () => {
    const store = createInMemoryPanelStore();
    const tenant = await store.createTenant({ name: "A", kind: "agency" });
    await store.recordAudit(tenant.id, "client.created", { name: "M" });
    await store.recordAudit(tenant.id, "site.created", { url: "https://x.com" });
    const log = await store.listAudit(tenant.id);
    expect(log).toHaveLength(2);
    expect(log[0]!.action).toBe("client.created");
    expect(log[1]!.detail).toEqual({ url: "https://x.com" });
    const other = await store.createTenant({ name: "B", kind: "direct" });
    expect(await store.listAudit(other.id)).toHaveLength(0);
  });

  it("kullanıcı oluşturulur ve e-posta ile bulunur; e-posta benzersizdir", async () => {
    const store = createInMemoryPanelStore();
    const tenant = await store.createTenant({ name: "A", kind: "direct" });
    const user = await store.createUser({
      tenantId: tenant.id,
      email: "owner@ajans.com",
      passwordHash: "scrypt:aa:bb",
    });
    expect(user.email).toBe("owner@ajans.com");
    expect(user.tenantId).toBe(tenant.id);
    expect((await store.findUserByEmail("owner@ajans.com"))?.id).toBe(user.id);
    expect(await store.findUserByEmail("yok@ajans.com")).toBeNull();
    await expect(
      store.createUser({ tenantId: tenant.id, email: "owner@ajans.com", passwordHash: "scrypt:cc:dd" }),
    ).rejects.toThrow(/e-posta/);
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

  it("iletişim talebi saklanır, listelenir ve izole kopya döner", async () => {
    const store = createInMemoryPanelStore();
    const req = await store.createContactRequest({
      name: "Ayşe",
      email: "ayse@ajans.com",
      package: "pro",
      message: "15 site izlemek istiyoruz",
    });
    expect(req.id).toBeTruthy();
    expect(req.createdAt).toBeTruthy();
    req.message = "kurcalandı";
    const listed = await store.listContactRequests();
    expect(listed).toHaveLength(1);
    expect(listed[0]!.message).toBe("15 site izlemek istiyoruz");
    expect(listed[0]!.package).toBe("pro");
    listed[0]!.message = "tekrar kurcalandı";
    expect((await store.listContactRequests())[0]!.message).toBe("15 site izlemek istiyoruz");
  });
});

describe("paket ve site sayacı", () => {
  it("createTenant paketsiz starter varsayar", async () => {
    const store = createInMemoryPanelStore();
    const tenant = await store.createTenant({ name: "A", kind: "agency" });
    expect(tenant.package).toBe("starter");
    expect((await store.getTenant(tenant.id))?.package).toBe("starter");
  });

  it("createTenant açık paketi saklar", async () => {
    const store = createInMemoryPanelStore();
    const tenant = await store.createTenant({ name: "A", kind: "agency", package: "pro" });
    expect(tenant.package).toBe("pro");
  });

  it("countSitesByTenant kiracının tüm müşterilerindeki siteleri sayar", async () => {
    const store = createInMemoryPanelStore();
    const a = await store.createTenant({ name: "A", kind: "agency" });
    const b = await store.createTenant({ name: "B", kind: "agency" });
    const c1 = await store.createClient({ tenantId: a.id, name: "M1" });
    const c2 = await store.createClient({ tenantId: a.id, name: "M2" });
    const cb = await store.createClient({ tenantId: b.id, name: "MB" });
    await store.createSite({ clientId: c1.id, url: "https://bir.com" });
    await store.createSite({ clientId: c2.id, url: "https://iki.com" });
    await store.createSite({ clientId: cb.id, url: "https://uc.com" });
    expect(await store.countSitesByTenant(a.id)).toBe(2);
    expect(await store.countSitesByTenant(b.id)).toBe(1);
  });

  it("müşteri silinince sayaç düşer", async () => {
    const store = createInMemoryPanelStore();
    const a = await store.createTenant({ name: "A", kind: "agency" });
    const c1 = await store.createClient({ tenantId: a.id, name: "M1" });
    await store.createSite({ clientId: c1.id, url: "https://bir.com" });
    await store.deleteClient(c1.id);
    expect(await store.countSitesByTenant(a.id)).toBe(0);
  });
});

describe("hesap yaşam döngüsü store portları", () => {
  it("findUserByTenant kiracının kullanıcısını verir; yoksa null", async () => {
    const store = createInMemoryPanelStore();
    const t = await store.createTenant({ name: "A", kind: "agency" });
    expect(await store.findUserByTenant(t.id)).toBeNull();
    await store.createUser({ tenantId: t.id, email: "u@x.com", passwordHash: "h" });
    expect((await store.findUserByTenant(t.id))?.email).toBe("u@x.com");
  });

  it("setUserEmailVerified ve updateUserPassword kullanıcıyı günceller", async () => {
    const store = createInMemoryPanelStore();
    const t = await store.createTenant({ name: "A", kind: "agency" });
    const u = await store.createUser({ tenantId: t.id, email: "u@x.com", passwordHash: "h" });
    expect(u.emailVerifiedAt).toBeUndefined();
    await store.setUserEmailVerified(u.id);
    expect((await store.findUserByEmail("u@x.com"))?.emailVerifiedAt).toBeTruthy();
    await store.updateUserPassword(u.id, "yeni-hash");
    expect((await store.findUserByEmail("u@x.com"))?.passwordHash).toBe("yeni-hash");
  });

  it("consumeAccountToken amaç uyuşmazlığında null döner", async () => {
    const store = createInMemoryPanelStore();
    const t = await store.createTenant({ name: "A", kind: "agency" });
    const u = await store.createUser({ tenantId: t.id, email: "u@x.com", passwordHash: "h" });
    await store.createAccountToken({
      userId: u.id,
      purpose: "verify-email",
      tokenHash: "c".repeat(64),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    expect(await store.consumeAccountToken("c".repeat(64), "reset-password")).toBeNull();
    expect(await store.consumeAccountToken("c".repeat(64), "verify-email")).toEqual({ userId: u.id });
    expect(await store.consumeAccountToken("c".repeat(64), "verify-email")).toBeNull();
  });

  it("deleteTenant kiracıyı ve bağlı veriyi cascade siler", async () => {
    const store = createInMemoryPanelStore();
    const t = await store.createTenant({ name: "A", kind: "agency" });
    const c = await store.createClient({ tenantId: t.id, name: "M" });
    await store.createSite({ clientId: c.id, url: "https://x.com" });
    await store.createUser({ tenantId: t.id, email: "u@x.com", passwordHash: "h" });
    await store.deleteTenant(t.id);
    expect(await store.getTenant(t.id)).toBeNull();
    expect(await store.findUserByEmail("u@x.com")).toBeNull();
    expect(await store.listClients(t.id)).toEqual([]);
    expect(await store.countSitesByTenant(t.id)).toBe(0);
  });
});
