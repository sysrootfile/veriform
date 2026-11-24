/**
 * Self-servis tarama sayfası (kamu) — GTM #1 lead magnet.
 * Rota glue'u server.ts'te; burada yalnızca sayfa render'ı.
 * Not: kamu uçtan Playwright taraması tetiklenir — prod'da kuyruk +
 * hız sınırı ile çalıştırılmalı (bkz. rota yorumu).
 */

import {
  FONT_FACES,
  WORLD_TOKENS,
  WORLD_BASE,
  SHEET_CSS,
  TABLE_CSS,
  REPORT_COMPONENTS,
  sheetOpen,
} from "../panel/design.js";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderScanRequestPage(input: {
  formAction: string;
  error?: string | undefined;
  /** Tarama tamamlandıysa raporun hazır HTML'i (renderReportHtml çıktısı). */
  resultHtml?: string | undefined;
}): string {
  const e = escapeHtml;
  const errorBlock = input.error
    ? `<p class="warn">${e(input.error)}</p>`
    : "";
  const resultBlock = input.resultHtml
    ? `<hr><div class="report">${input.resultHtml}</div>`
    : "";

  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ücretsiz Form Taraması — Veriform</title>
<style>:root { --accent: #1e7a46; --sheet-w: 860px; }
${FONT_FACES}
${WORLD_TOKENS}
${WORLD_BASE}
${SHEET_CSS}
${TABLE_CSS}
${REPORT_COMPONENTS}
h1{font-size:1.5rem;font-weight:800;letter-spacing:-.01em;line-height:1.2;margin:0 0 14px}
h2{font-size:1.02rem;font-weight:800;margin:1.9rem 0 .6rem}
form{display:flex;gap:12px;align-items:center;margin:1.2rem 0 2rem}
input{flex:1;font-family:"Archivo",system-ui,sans-serif;font-size:1rem;color:var(--ink);background:transparent;border:none;border-bottom:2px solid var(--rule);padding:10px 2px;transition:border-color 160ms var(--ease)}
input:focus{outline:none;border-bottom-color:var(--blue)}
input::placeholder{color:var(--ink-faint)}
button{background:var(--accent);color:#fff;font-family:"Archivo",system-ui,sans-serif;font-weight:700;font-size:.82rem;letter-spacing:.05em;text-transform:uppercase;padding:10px 20px;border:none;border-radius:6px;cursor:pointer;box-shadow:0 4px 12px color-mix(in srgb,var(--accent) 25%,transparent);transition:transform 160ms var(--ease),box-shadow 160ms var(--ease)}
button:active{transform:scale(.97)}
@media (hover:hover) and (pointer:fine){button:hover{transform:translateY(-1px);box-shadow:0 7px 18px color-mix(in srgb,var(--accent) 32%,transparent)}}
hr{border:none;border-top:2px solid var(--ink);margin:2rem 0}
code{font-family:"Spline Sans Mono",ui-monospace,monospace;font-size:.8rem;background:var(--desk);padding:.1rem .35rem;border-radius:4px;word-break:break-all}
ul{margin:.5rem 0;padding-left:1.3rem}
li{margin:.35rem 0}
footer{color:var(--ink-soft);font-size:.72rem;font-family:"Spline Sans Mono",ui-monospace,monospace;letter-spacing:.04em;border-top:2px solid var(--ink);margin-top:2.2rem;padding-top:14px}
@media (prefers-reduced-motion:reduce){button,input{transition:none}button:hover{transform:none}}</style>
</head>
<body>
${sheetOpen("ÜCRETSİZ TARAMA")}
<h1>Ücretsiz Form Taraması</h1>
<p>Sitenizdeki formların hangi kişisel verileri topladığını, nereye gönderdiğini ve
rıza öncesi çerez ihlallerini saniyeler içinde görün.</p>
${errorBlock}
<form method="post" action="${e(input.formAction)}">
  <input name="url" type="url" placeholder="https://siteniz.com" required>
  <button type="submit">Tara</button>
</form>
${resultBlock}
</div>
</body>
</html>`;
}
