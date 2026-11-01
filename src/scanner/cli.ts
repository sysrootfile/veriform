import { closeSharedBrowser } from "./browser.js";
import { buildEmbedSource, scanSite } from "./scan.js";

/**
 * CLI tarama aracı (thin glue — mantık scan.ts'te ve testlidir):
 *   pnpm scan -- <url>
 * Raporu JSON olarak stdout'a yazar.
 */
const url = process.argv[2];
if (!url) {
  console.error("Kullanım: pnpm scan -- <url>");
  process.exit(1);
}

const result = await scanSite(url, { embedSource: await buildEmbedSource() });
await closeSharedBrowser(); // tarayıcı çocuğu açık kalırsa süreç kapanmaz
console.log(JSON.stringify(result, null, 2));
