import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { closeSharedBrowser } from "../scanner/browser.js";
import { buildEmbedSource, scanSite } from "../scanner/scan.js";
import { renderReportHtml } from "./render.js";

/**
 * Demo rapor üretici (thin glue):
 *   pnpm demo -- <url> [çıktı.html]
 * Gerçek tarama yapar, sonucu bağımsız HTML raporu olarak yazar.
 */
const [url = "", out = "docs/demo/veriform-demo-rapor.html"] = process.argv.slice(2);
if (!url) {
  console.error("Kullanım: pnpm demo -- <url> [çıktı.html]");
  process.exit(1);
}

const result = await scanSite(url, { embedSource: await buildEmbedSource() });
await closeSharedBrowser(); // tarayıcı çocuğu açık kalırsa süreç kapanmaz

const html = renderReportHtml(result.report, { scannedAt: new Date().toISOString() });
await mkdir(dirname(out), { recursive: true });
await writeFile(out, html, "utf8");
console.log(`Rapor yazıldı: ${out} (${result.report.formCount} form, ${result.report.riskFlags.length} risk)`);
