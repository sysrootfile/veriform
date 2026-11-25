import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PanelStore } from "./store.js";
import { createInMemoryPanelStore } from "./store.js";
import { createPostgresPanelStore, type PostgresPanelStore } from "./store.pg.js";

const PG_URL = process.env.PG_URL ?? "";

/** RLS'in etkin olması gereken tablolar — kiracıya ait her satır burada yaşar. */
const TENANT_TABLES = [
  "tenants",
  "clients",
  "sites",
  "scans",
  "consent_receipts",
  "users",
  "dsar_requests",
  "corrections",
  "audit_log",
  "api_keys",
  "plan_change_requests",
];

interface Seeded {
  tenantId: string;
  clientId: string;
  siteId: string;
}

/** Kiracı kapsamı sözleşmesi — iki adapter için aynı: başka kiracının kaydı görünmez ve değişmez. */
function tenantScopeContract(
  name: string,
  makeStore: () => Promise<PanelStore>,
  onSeeded?: (a: Seeded) => void,
) {
  describe(name, () => {
    let store: PanelStore;
    let a: Seeded;
    let b: Seeded;

    beforeAll(async () => {
      store = await makeStore();
      const tag = randomUUID();
      const seed = async (label: string): Promise<Seeded> => {
        const tenant = await store.createTenant({ name: `Kiracı ${label}`, kind: "direct" });
        const client = await store.createClient({ tenantId: tenant.id, name: `Müşteri ${label}` });
        const site = await store.createSite({
          tenantId: tenant.id,
          clientId: client.id,
          url: `https://${tag}-${label}.test`,
        });
        return { tenantId: tenant.id, clientId: client.id, siteId: site.id };
      };
      a = await seed("a");
      b = await seed("b");
      onSeeded?.(a);
    });

    it("başka kiracının müşterisi okunamaz, markalanamaz, silinemez; ona site eklenemez", async () => {
      expect(await store.listSites(a.tenantId, b.clientId)).toEqual([]);
      await expect(
        store.setClientBranding(a.tenantId, b.clientId, { brandColor: "#000000" }),
      ).rejects.toThrow(/bulunamadı/);
      await expect(store.deleteClient(a.tenantId, b.clientId)).rejects.toThrow(/bulunamadı/);
      await expect(
        store.createSite({
          tenantId: a.tenantId,
          clientId: b.clientId,
          url: "https://sizma.test",
        }),
      ).rejects.toThrow(/bulunamadı/);

      const [client] = await store.listClients(b.tenantId);
      expect(client!.id).toBe(b.clientId);
      expect(client!.brandColor).toBeUndefined();
      expect(await store.listSites(b.tenantId, b.clientId)).toHaveLength(1);
    });

    it("başka kiracının sitesi okunamaz ve değiştirilemez", async () => {
      expect(await store.getSite(a.tenantId, b.siteId)).toBeNull();
      expect(await store.listScans(a.tenantId, b.siteId)).toEqual([]);
      expect(await store.listDsars(a.tenantId, b.siteId)).toEqual([]);
      expect(await store.listReceipts(a.tenantId, b.siteId)).toEqual([]);

      await expect(
        store.setBannerConfig(a.tenantId, b.siteId, null),
      ).rejects.toThrow(/bulunamadı/);
      await expect(store.setScanSchedule(a.tenantId, b.siteId, 24)).rejects.toThrow(/bulunamadı/);
      await expect(
        store.saveCorrection(a.tenantId, b.siteId, { fieldName: "eposta", category: "email" }),
      ).rejects.toThrow(/bulunamadı/);
      await expect(
        store.updateDsar(a.tenantId, b.siteId, randomUUID(), { status: "completed" }),
      ).rejects.toThrow(/bulunamadı/);

      const site = await store.getSite(b.tenantId, b.siteId);
      expect(site!.bannerConfig).toBeUndefined();
      expect(site!.scanIntervalHours).toBeUndefined();
      expect(await store.listCorrections(b.tenantId, b.siteId)).toEqual([]);
    });

    it("reddedilen kiracı işleminden sonra bağlantı yetkili kipe döner", async () => {
      await expect(store.deleteClient(a.tenantId, b.clientId)).rejects.toThrow();
      const sites = await store.listAllSites();
      expect(sites.map((s) => s.id)).toEqual(expect.arrayContaining([a.siteId, b.siteId]));
    });
  });
}

tenantScopeContract("createInMemoryPanelStore — kiracı kapsamı", async () => createInMemoryPanelStore());

const d = PG_URL ? describe : describe.skip;

d("createPostgresPanelStore — kiracı kapsamı ve RLS (GERÇEK Postgres)", () => {
  let store: PostgresPanelStore;

  tenantScopeContract("sözleşme", async () => {
    store = createPostgresPanelStore(PG_URL);
    return store;
  }, (a) => {
    seededA = a;
  });

  afterAll(async () => {
    await store?.close();
  });

  it("her kiracı tablosunda RLS açıktır", async () => {
    const client = new pg.Client({ connectionString: PG_URL });
    await client.connect();
    try {
      const result = await client.query(
        "select relname, relrowsecurity from pg_class where relkind = 'r' and relname = any($1::text[])",
        [TENANT_TABLES],
      );
      expect(result.rows).toHaveLength(TENANT_TABLES.length);
      for (const row of result.rows) {
        expect(row.relrowsecurity, `${row.relname} RLS`).toBe(true);
      }
    } finally {
      await client.end();
    }
  });

  it("uygulama rolü kiracı seçmeden hiçbir kiracı satırını göremez", async () => {
    const client = new pg.Client({ connectionString: PG_URL });
    await client.connect();
    try {
      await client.query("begin");
      await client.query("set local role veriform_app");
      for (const table of TENANT_TABLES) {
        const result = await client.query(`select count(*)::int as n from ${table}`);
        expect(Number(result.rows[0].n), table).toBe(0);
      }
      await client.query("rollback");
    } finally {
      await client.end();
    }
  });

  it("kiracı seçilince WHERE'siz sorgu da yalnız kendi satırlarını görür", async () => {
    const client = new pg.Client({ connectionString: PG_URL });
    await client.connect();
    try {
      await client.query("begin");
      await client.query("set local role veriform_app");
      await client.query("select set_config('app.current_tenant', $1, true)", [seededA!.tenantId]);
      for (const table of ["clients", "sites", "tenants"]) {
        const result = await client.query(`select count(*)::int as n from ${table}`);
        expect(Number(result.rows[0].n), table).toBe(1);
      }
      await client.query("rollback");
    } finally {
      await client.end();
    }
  });

  it("uygulama rolü tablo oluşturamaz (yalnız veri erişimi)", async () => {
    const client = new pg.Client({ connectionString: PG_URL });
    await client.connect();
    try {
      await client.query("begin");
      await client.query("set local role veriform_app");
      await expect(client.query("create table rls_probe (id int)")).rejects.toThrow(/permission denied/);
      await client.query("rollback");
    } finally {
      await client.end();
    }
  });

  it("rol işlem bitince bağlantı sahibine döner", async () => {
    const client = new pg.Client({ connectionString: PG_URL });
    await client.connect();
    try {
      const before = (await client.query("select current_user as u")).rows[0].u;
      await client.query("begin");
      await client.query("set local role veriform_app");
      await client.query("commit");
      const after = (await client.query("select current_user as u")).rows[0].u;
      expect(after).toBe(before);
    } finally {
      await client.end();
    }
  });
});

let seededA: Seeded | undefined;
