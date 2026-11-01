import type { StoredScan } from "./types.js";

/**
 * Panel sayfa renderer'ları — servis katmanının verisini HTML'e çevirir.
 * Rapor renderer'ıyla aynı ilke: saf fonksiyon, tüm girdi metinleri
 * HTML'e kaçırılır. HTTP çerçevesinden bağımsızdır (Next.js'e geçişte
 * aynı fonksiyonlar kullanılabilir).
 */

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const STYLE = `
  body { font-family: system-ui, sans-serif; max-width: 860px; margin: 2rem auto; padding: 0 1rem; color: #16161f; }
  h1 { font-size: 1.3rem; } h2 { font-size: 1.05rem; margin-top: 1.6rem; }
  table { width: 100%; border-collapse: collapse; margin: .5rem 0 1rem; }
  td, th { border-bottom: 1px solid #eee; padding: .45rem .5rem; text-align: left; font-size: .92rem; }
  .num { text-align: right; }
  .badge-ok { color: #127a3d; background: #e8f5ee; padding: .2rem .55rem; border-radius: 999px; font-size: .82rem; font-weight: 600; }
  .badge-warn { color: #b45309; background: #fdf2e3; padding: .2rem .55rem; border-radius: 999px; font-size: .82rem; font-weight: 600; }
  .empty { color: #777; }
  form { margin: 1rem 0; display: flex; gap: .5rem; }
  input, button { padding: .45rem .7rem; border: 1px solid #ccc; border-radius: 6px; font-size: .92rem; }
  button { background: #16161f; color: #fff; border: none; cursor: pointer; }
  footer { color: #888; font-size: .8rem; border-top: 1px solid #eee; margin-top: 2rem; padding-top: .8rem; }
`;

const page = (title: string, body: string): string =>
  `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Veriform Panel — ${escapeHtml(title)}</title>
<style>${STYLE}</style>
</head>
<body>
${body}
<footer>Veriform panel — izleyici ham veri saklamaz; kanıtlar kurcalama kanıtlı zincirde.</footer>
</body>
</html>`;

export interface ClientRow {
  id: string;
  name: string;
}

export function renderClientsPage(input: {
  tenantName: string;
  clients: ClientRow[];
}): string {
  const e = escapeHtml;
  const rows = input.clients.length
    ? input.clients
        .map(
          (c) =>
            `<tr><td><a href="/clients/${e(c.id)}">${e(c.name)}</a></td><td class="num"><a href="/clients/${e(c.id)}">Siteleri →</a></td></tr>`,
        )
        .join("\n")
    : '<tr><td class="empty">Henüz müşteri eklenmedi.</td></tr>';

  return page(
    input.tenantName,
    `<h1>Veriform Panel · ${e(input.tenantName)}</h1>
<h2>Müşteriler</h2>
<table>${rows}</table>
<form method="post" action="/clients">
  <input name="name" placeholder="Müşteri adı" required>
  <button type="submit">Müşteri ekle</button>
</form>`,
  );
}

export function renderSitePage(input: {
  siteUrl: string;
  chainValid: boolean;
  scans: StoredScan[];
}): string {
  const e = escapeHtml;
  const badge = input.chainValid
    ? '<span class="badge-ok">Kanıt zinciri geçerli ✓</span>'
    : '<span class="badge-warn">⚠ Zincir doğrulaması başarısız — kurcalama şüphesi</span>';

  const rows = input.scans.length
    ? input.scans
        .map((s) => {
          const violations = s.cookies.filter((c) => c.category !== "necessary").length;
          return `<tr><td>${e(s.scannedAt)}</td><td class="num">${s.report.formCount}</td><td class="num">${s.report.riskFlags.length}</td><td class="num">${violations}</td></tr>`;
        })
        .join("\n")
    : '<tr><td colspan="4" class="empty">Henüz tarama yok — `pnpm demo -- <site-url>` ile ilk taramayı çalıştırın.</td></tr>';

  return page(
    input.siteUrl,
    `<h1>${e(input.siteUrl)}</h1>
<p>${badge}</p>
<h2>Taramalar</h2>
<table>
<tr><th>Tarih</th><th class="num">Form</th><th class="num">Risk</th><th class="num">Çerez ihlali</th></tr>
${rows}
</table>`,
  );
}
