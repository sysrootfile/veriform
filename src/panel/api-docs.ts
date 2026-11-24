/**
 * Headless API geliştirici dokümantasyonu — kamu sayfa.
 * Bilinçli tasarım: curl örneklerinde <panel-url> yer tutucusu kullanılır;
 * env/istek kaynaklı değer bu sayfaya hiç akmaz (taintsiz render).
 * Uç listesi handleApiRequest (api.ts) ile senkron tutulur.
 */

import { FONT_FACES, WORLD_TOKENS, WORLD_BASE, SHEET_CSS, PANEL_CSS, sheetOpen } from "./design.js";

const ENDPOINTS: Array<{ method: string; path: string; desc: string }> = [
  { method: "GET", path: "/api/v1/me", desc: "Kiracı bilgisi — kimlik doğrulama kontrolü" },
  { method: "GET", path: "/api/v1/clients", desc: "Müşteri listesi" },
  { method: "POST", path: "/api/v1/clients", desc: 'Müşteri oluştur — gövde: {"name": "..."}' },
  { method: "GET", path: "/api/v1/clients/:clientId/sites", desc: "Müşterinin siteleri (ingest token dahil)" },
  { method: "POST", path: "/api/v1/clients/:clientId/sites", desc: 'Site oluştur — gövde: {"url": "https://..."} (ingest token döner)' },
  { method: "GET", path: "/api/v1/sites/:siteId/scans", desc: "Sitelerin tarama geçmişi (JSON)" },
  { method: "GET", path: "/api/v1/sites/:siteId/report", desc: "Son taramanın envanter raporu (JSON)" },
];

export function renderApiDocsPage(): string {
  const rows = ENDPOINTS.map(
    (ep) =>
      `<tr><td><span class="m">${ep.method}</span></td><td><code>${ep.path}</code></td><td>${ep.desc}</td></tr>`,
  ).join("\n");

  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Veriform Headless API</title>
<style>:root { --accent: #1e7a46; --sheet-w: 900px; }
${FONT_FACES}
${WORLD_TOKENS}
${WORLD_BASE}
${SHEET_CSS}
${PANEL_CSS}
.m{font-family:"Spline Sans Mono",ui-monospace,monospace;font-weight:700;font-size:.72rem;letter-spacing:.08em;color:var(--blue)}</style>
</head>
<body>
${sheetOpen("API DOCS")}
<h1>Veriform Headless API</h1>
<p class="empty">Tüm istekler <code>X-API-Key</code> başlığı ile kimliklenir. Anahtarlar panelde
Ayarlar → API Anahtarları bölümünden oluşturulur (düz değer yalnızca bir kez gösterilir).</p>
<h2>Uçlar</h2>
<div class="table-scroll">
<table>
<tr><th>Metot</th><th>Yol</th><th>Açıklama</th></tr>
${rows}
</table>
</div>
<h2>Örnek</h2>
<pre><code>curl -H "X-API-Key: vfk_..." &lt;panel-url&gt;/api/v1/me</code></pre>
<h2>Site provizyonu (programatik)</h2>
<pre><code>curl -X POST &lt;panel-url&gt;/api/v1/clients \\
  -H "X-API-Key: vfk_..." -H "Content-Type: application/json" \\
  -d '{"name": "Yeni Müşteri"}'
curl -X POST &lt;panel-url&gt;/api/v1/clients/&lt;clientId&gt;/sites \\
  -H "X-API-Key: vfk_..." -H "Content-Type: application/json" \\
  -d '{"url": "https://musteri-sitesi.com"}'
# yanıt: { "id": "...", "url": "...", "ingestToken": "..." }
# ingestToken → müşteri sitesine gömülecek embed scriptin data-site-token'ı</code></pre>
<p class="empty">Hız sınırı: dakikada 60 istek. Rota glue'u handleApiRequest üzerinden
tüm bu uçları hizmet eder; doğrulama kuralları için bkz. api.ts testleri.</p>
</div>
</body>
</html>`;
}
