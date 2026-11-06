import { readFileSync } from "node:fs";
import pg from "pg";

/**
 * CI/ilk kurulum için schema.sql uygulayıcısı — psql varsayımı yoktur,
 * repo bağımlılığı `pg` ile konuşur. Tek kullanım yeri CI entegrasyon job'ıdır.
 */

const url = process.env.PG_URL;
if (!url) {
  console.error("PG_URL gerekli — şemanın uygulanacağı veritabanı adresi");
  process.exit(1);
}

const schemaPath = new URL("../src/panel/schema.sql", import.meta.url);
const sql = readFileSync(schemaPath, "utf8");
const client = new pg.Client({ connectionString: url });

try {
  await client.connect();
  await client.query(sql);
} catch (error) {
  console.error("schema.sql uygulanamadı:", error instanceof Error ? error.message : error);
  await client.end().catch(() => {});
  process.exit(1);
}

await client.end();
console.log(`schema.sql uygulandı (${sql.split("\n").filter((l) => l.trim()).length} satır)`);
