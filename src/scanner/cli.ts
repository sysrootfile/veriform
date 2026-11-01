import { closeSharedBrowser } from "./browser.js";
import { buildEmbedSource, scanSite } from "./scan.js";
import { postScanToPanel } from "./ingest.js";

/**
 * CLI tarama aracı (thin glue — mantık scan.ts'te ve testlidir):
 *   pnpm scan -- <url> [panelUrl siteToken]
 * Raporu JSON olarak stdout'a yazar; panelUrl+token verilirse panele POST'lar.
 */
const url = process.argv[2];
const panelUrl = process.argv[3];
const siteToken = process.argv[4];
if (!url) {
  console.error("Kullanım: pnpm scan -- <url> [panelUrl siteToken]");
  process.exit(1);
}

const result = await scanSite(url, { embedSource: await buildEmbedSource() });
await closeSharedBrowser(); // tarayıcı çocuğu açık kalırsa süreç kapanmaz

if (panelUrl && siteToken) {
  const { id } = await postScanToPanel(panelUrl, siteToken, result);
  console.error(`Panele gönderildi: ${id}`); // stdout JSON'u bozmasın
}
console.log(JSON.stringify(result, null, 2));
