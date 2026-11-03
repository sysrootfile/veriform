/**
 * Self-servis tarama sayfası (kamu) — GTM #1 lead magnet.
 * Rota glue'u server.ts'te; burada yalnızca sayfa render'ı.
 * Not: kamu uçtan Playwright taraması tetiklenir — prod'da kuyruk +
 * hız sınırı ile çalıştırılmalı (bkz. rota yorumu).
 */

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
<style>
  body { font-family: system-ui, sans-serif; max-width: 780px; margin: 2rem auto; padding: 0 1rem; }
  .warn { color: #b45309; background: #fdf2e3; padding: .4rem .8rem; border-radius: 6px; }
  form { display: flex; gap: .5rem; margin: 1rem 0 2rem; }
  input, button { padding: .55rem .8rem; border: 1px solid #ccc; border-radius: 6px; font-size: 1rem; }
  input { flex: 1; }
  button { background: #16161f; color: #fff; border: none; cursor: pointer; }
  .report { border: 1px solid #ddd; border-radius: 8px; padding: 1rem; }
</style>
</head>
<body>
<h1>Ücretsiz Form Taraması</h1>
<p>Sitenizdeki formların hangi kişisel verileri topladığını, nereye gönderdiğini ve
rıza öncesi çerez ihlallerini saniyeler içinde görün.</p>
${errorBlock}
<form method="post" action="${e(input.formAction)}">
  <input name="url" type="url" placeholder="https://siteniz.com" required>
  <button type="submit">Tara</button>
</form>
${resultBlock}
</body>
</html>`;
}
