import { migrateDatabase } from "./migrate.js";

/** CLI: PG_URL (CI) ya da DATABASE_URL (prod) ile migration koşar. */
const url = process.env.PG_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error("[migrate] PG_URL ya da DATABASE_URL gerekli");
  process.exit(1);
}

const result = await migrateDatabase(url);
for (const file of result.baselined) console.log(`[migrate] baseline (mevcut şema kaydedildi): ${file}`);
for (const file of result.applied) console.log(`[migrate] uygulandı: ${file}`);
if (!result.applied.length && !result.baselined.length) console.log("[migrate] şema güncel — iş yok");