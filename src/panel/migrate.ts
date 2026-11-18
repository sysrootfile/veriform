import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import pg from "pg";

/**
 * Sürümlü SQL migration koşucusu.
 * - Dosyalar `NNN_ad.sql` biçiminde, sürüm sırasıyla uygulanır (src/panel/migrations/).
 * - Her migration kendi transaction'ında koşar; hata rollback + kayıtsız bırakır.
 * - `schema_migrations` tablosu uygulanan sürümleri tutar; advisory lock ile
 *   eşzamanlı koşucular (panel açılışı + CLI) çakışmaz.
 * - Baseline: kayıtsız ama şeması kurulu veritabanı (initdb mount'lu eski volume)
 *   001'i yeniden çalıştırmadan kaydedilir — veri kaybı olmaz.
 */

export const MIGRATIONS_DIR = new URL("./migrations/", import.meta.url);

// Sabit anahtar: aynı veritabanındaki tüm Veriform koşucuları aynı kilidi bekler.
const ADVISORY_LOCK_KEY = 726_431;

const MIGRATION_FILE = /^\d{3}_[a-z0-9_]+\.sql$/;

export function isMigrationFileName(name: string): boolean {
  return MIGRATION_FILE.test(name);
}

export function orderPending(files: readonly string[], applied: readonly string[]): string[] {
  const done = new Set(applied);
  return files
    .filter((f) => isMigrationFileName(f) && !done.has(f))
    .sort((a, b) => a.localeCompare(b));
}

export interface MigrationResult {
  applied: string[];
  baselined: string[];
}

export async function runMigrations(client: pg.Client, dir: URL = MIGRATIONS_DIR): Promise<MigrationResult> {
  const files = orderPending(await readdir(fileURLToPath(dir)), []);
  // Lock, catalog yarışından önce: eşzamanlı `create table if not exists`
  // PG'de pg_type unique ihlaliyle çökebilir — tablo oluşturma da lock içinde.
  await client.query("select pg_advisory_lock($1)", [ADVISORY_LOCK_KEY]);
  try {
    await client.query(
      "create table if not exists schema_migrations (version text primary key, applied_at timestamptz not null default now())",
    );
    const { rows } = await client.query("select version from schema_migrations");
    const applied: string[] = rows.map((r) => r.version);
    const baselined: string[] = [];

    if (applied.length === 0 && files.length > 0) {
      const { rows: existing } = await client.query("select to_regclass('tenants') as reg");
      if (existing[0].reg !== null) {
        const first = files[0]!;
        await client.query("insert into schema_migrations (version) values ($1)", [first]);
        baselined.push(first);
        applied.push(first);
      }
    }

    const pending = orderPending(files, applied);
    const newlyApplied: string[] = [];
    for (const file of pending) {
      const sql = await readFile(new URL(file, dir), "utf8");
      try {
        await client.query("begin");
        await client.query(sql);
        await client.query("insert into schema_migrations (version) values ($1)", [file]);
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw new Error(`migration başarısız: ${file}`, { cause: error });
      }
      newlyApplied.push(file);
    }
    return { applied: newlyApplied, baselined };
  } finally {
    await client.query("select pg_advisory_unlock($1)", [ADVISORY_LOCK_KEY]);
  }
}

/** Bağlantıyı açar, migration'ları koşar, kapatır. Panel açılışı ve CLI bunu kullanır. */
export async function migrateDatabase(connectionString: string, dir?: URL): Promise<MigrationResult> {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    return await runMigrations(client, dir);
  } finally {
    await client.end();
  }
}