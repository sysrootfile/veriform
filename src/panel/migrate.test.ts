import { randomBytes } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MIGRATIONS_DIR, isMigrationFileName, orderPending, runMigrations } from "./migrate.js";

describe("isMigrationFileName", () => {
  it("NNN_ad.sql biçimini kabul eder", () => {
    expect(isMigrationFileName("001_init.sql")).toBe(true);
    expect(isMigrationFileName("012_add_index.sql")).toBe(true);
  });

  it("biçimsiz adları reddeder", () => {
    expect(isMigrationFileName("schema.sql")).toBe(false);
    expect(isMigrationFileName("1_init.sql")).toBe(false);
    expect(isMigrationFileName("001_init.SQL")).toBe(false);
    expect(isMigrationFileName("001_init.sql.bak")).toBe(false);
    expect(isMigrationFileName("README.md")).toBe(false);
    expect(isMigrationFileName("001_Init.sql")).toBe(false);
  });
});

describe("orderPending", () => {
  it("dosyaları sürüm sırasına dizer", () => {
    expect(orderPending(["010_late.sql", "002_mid.sql", "001_init.sql"], [])).toEqual([
      "001_init.sql",
      "002_mid.sql",
      "010_late.sql",
    ]);
  });

  it("uygulanmış sürümleri eler", () => {
    expect(orderPending(["001_init.sql", "002_mid.sql"], ["001_init.sql"])).toEqual(["002_mid.sql"]);
  });

  it("biçimsiz adları yok sayar", () => {
    expect(orderPending(["README.md", "001_init.sql", "not.sql"], [])).toEqual(["001_init.sql"]);
  });

  it("boş girdilerde boş döner", () => {
    expect(orderPending([], [])).toEqual([]);
    expect(orderPending(["001_init.sql"], ["001_init.sql"])).toEqual([]);
  });

  it("kayıtlı ama dosyası olmayan sürüm sessizce yok sayılır", () => {
    expect(orderPending(["002_mid.sql"], ["001_init.sql"])).toEqual(["002_mid.sql"]);
  });
});

const PG_URL = process.env.PG_URL;
const describePg = PG_URL ? describe : describe.skip;

/**
 * Entegrasyon testleri kendi veritabanında koşar (public şeması boş):
 * paylaşılan veritabanındaki mevcut tablolar baseline tespitini yanıltmaz.
 */
describePg("runMigrations (PG entegrasyon)", () => {
  const dbName = `vf_migrate_test_${randomBytes(4).toString("hex")}`;
  let admin: pg.Client;
  let client: pg.Client;

  function testUrl(): string {
    const url = new URL(PG_URL!);
    url.pathname = `/${dbName}`;
    return url.toString();
  }

  async function connectScoped(): Promise<pg.Client> {
    const c = new pg.Client({ connectionString: testUrl() });
    await c.connect();
    return c;
  }

  beforeAll(async () => {
    admin = new pg.Client({ connectionString: PG_URL });
    await admin.connect();
    await admin.query(`create database ${dbName}`);
    client = await connectScoped();
  });

  beforeEach(async () => {
    await client.query("drop schema public cascade");
    await client.query("create schema public");
  });

  afterAll(async () => {
    await client.end();
    await admin.query(`drop database if exists ${dbName} with (force)`).catch(() => {});
    await admin.end();
  });

  it("boş veritabanına tüm migration'ları uygular ve kaydeder; ikinci koşu no-op", async () => {
    const first = await runMigrations(client);
    expect(first.applied).toEqual(["001_init.sql", "002_contact_requests.sql", "003_tenant_package.sql", "004_account_lifecycle.sql"]);
    expect(first.baselined).toEqual([]);

    const { rows: tables } = await client.query("select to_regclass('tenants') as reg");
    expect(tables[0].reg).not.toBeNull();
    const { rows: contact } = await client.query("select to_regclass('contact_requests') as reg");
    expect(contact[0].reg).not.toBeNull();
    const { rows: versions } = await client.query("select version from schema_migrations");
    expect(versions.map((r) => r.version)).toEqual(["001_init.sql", "002_contact_requests.sql", "003_tenant_package.sql", "004_account_lifecycle.sql"]);

    const second = await runMigrations(client);
    expect(second.applied).toEqual([]);
    expect(second.baselined).toEqual([]);
  }, 20_000);

  it("mevcut şemayı baseline eder — 001 yeniden çalışmaz, veri korunur", async () => {
    const sql = await readFile(new URL("001_init.sql", MIGRATIONS_DIR), "utf8");
    await client.query(sql);
    await client.query("insert into tenants (name, kind) values ('Eski Kiracı', 'agency')");

    const result = await runMigrations(client);
    expect(result.applied).toEqual(["002_contact_requests.sql", "003_tenant_package.sql", "004_account_lifecycle.sql"]);
    expect(result.baselined).toEqual(["001_init.sql"]);

    const { rows: tenants } = await client.query("select name from tenants");
    expect(tenants.map((r) => r.name)).toEqual(["Eski Kiracı"]);
    const { rows: versions } = await client.query("select version from schema_migrations");
    expect(versions.map((r) => r.version)).toEqual(["001_init.sql", "002_contact_requests.sql", "003_tenant_package.sql", "004_account_lifecycle.sql"]);
  }, 20_000);

  it("bozuk migration rollback olur ve kaydedilmez", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vf-migrate-"));
    try {
      const init = await readFile(new URL("001_init.sql", MIGRATIONS_DIR), "utf8");
      await writeFile(join(dir, "001_init.sql"), init);
      await writeFile(join(dir, "002_bad.sql"), "create table rollback_probe (id int);\nselect 1/0;\n");

      await expect(runMigrations(client, pathToFileURL(`${dir}/`))).rejects.toThrow("002_bad.sql");

      const { rows: versions } = await client.query("select version from schema_migrations");
      expect(versions.map((r) => r.version)).toEqual(["001_init.sql"]);
      const { rows: probe } = await client.query("select to_regclass('rollback_probe') as reg");
      expect(probe[0].reg).toBeNull();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }, 20_000);

  it("eşzamanlı iki koşucu advisory lock ile çakışmaz", async () => {
    const other = await connectScoped();
    try {
      const results = await Promise.all([runMigrations(client), runMigrations(other)]);
      const appliedTotal = results.flatMap((r) => r.applied);
      expect(appliedTotal).toEqual(["001_init.sql", "002_contact_requests.sql", "003_tenant_package.sql", "004_account_lifecycle.sql"]);
      const { rows } = await client.query("select count(*)::int as n from schema_migrations");
      expect(rows[0].n).toBe(4);
    } finally {
      await other.end();
    }
  }, 20_000);
});