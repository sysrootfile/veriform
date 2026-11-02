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
  h1 { font-size: 1.3rem; color: var(--accent); } h2 { font-size: 1.05rem; margin-top: 1.6rem; }
  table { width: 100%; border-collapse: collapse; margin: .5rem 0 1rem; }
  td, th { border-bottom: 1px solid #eee; padding: .45rem .5rem; text-align: left; font-size: .92rem; }
  .num { text-align: right; }
  .badge-ok { color: #127a3d; background: #e8f5ee; padding: .2rem .55rem; border-radius: 999px; font-size: .82rem; font-weight: 600; }
  .badge-warn { color: #b45309; background: #fdf2e3; padding: .2rem .55rem; border-radius: 999px; font-size: .82rem; font-weight: 600; }
  .empty { color: #777; }
  form { margin: 1rem 0; display: flex; gap: .5rem; }
  input, button { padding: .45rem .7rem; border: 1px solid #ccc; border-radius: 6px; font-size: .92rem; }
  button { background: var(--accent); color: #fff; border: none; cursor: pointer; }
  footer { color: #888; font-size: .8rem; border-top: 1px solid #eee; margin-top: 2rem; padding-top: .8rem; }
`;

/** White-label vurgu rengi — yalnızca #rrggbb; başka her şey (CSS enjeksiyonu dahil) yoksayılır. */
function safeAccent(color?: string | undefined): string | undefined {
  return color && /^#[0-9a-fA-F]{6}$/.test(color) ? color : undefined;
}

const page = (title: string, body: string, accent?: string | undefined): string =>
  `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Veriform Panel — ${escapeHtml(title)}</title>
<style>:root { --accent: ${safeAccent(accent) ?? "#16161f"}; }
${STYLE}</style>
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
  demoSiteHref?: string | undefined;
  accent?: string | undefined;
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

  const demoLink = input.demoSiteHref
    ? `<p class="empty">Demo: <a href="${e(input.demoSiteHref)}">örnek site sayfası</a></p>`
    : "";

  return page(
    input.tenantName,
    `<h1>Veriform Panel · ${e(input.tenantName)}</h1>
${demoLink}
<h2>Müşteriler</h2>
<table>${rows}</table>
<form method="post" action="/clients">
  <input name="name" placeholder="Müşteri adı" required>
  <button type="submit">Müşteri ekle</button>
</form>`,
    input.accent,
  );
}

export function renderSitePage(input: {
  siteUrl: string;
  chainValid: boolean;
  scans: StoredScan[];
  draftHref?: string | undefined;
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

  const draftLink = input.draftHref
    ? `<p><a href="${e(input.draftHref)}">Aydınlatma metni taslağı (yazdırılabilir) →</a></p>`
    : "";

  return page(
    input.siteUrl,
    `<h1>${e(input.siteUrl)}</h1>
<p>${badge}</p>
${draftLink}
<h2>Taramalar</h2>
<table>
<tr><th>Tarih</th><th class="num">Form</th><th class="num">Risk</th><th class="num">Çerez ihlali</th></tr>
${rows}
</table>`,
  );
}

/** Giriş/kayıt hata metinleri — rota yalnızca kod/boolean geçirir, metin sabittir. */
export const LOGIN_ERROR_TEXT = "E-posta veya şifre hatalı";
export const REGISTER_ERRORS: Record<"duplicate" | "generic", string> = {
  duplicate: "Bu e-posta zaten kayıtlı — başka bir e-posta deneyin.",
  generic: "Kayıt başarısız — girdileri kontrol edin.",
};

export function renderClientDetailPage(input: {
  clientName: string;
  clientHref: string;
  sites: Array<{ id: string; url: string; ingestToken: string }>;
  accent?: string | undefined;
}): string {
  const e = escapeHtml;
  const rows = input.sites.length
    ? input.sites
        .map(
          (s) =>
            `<tr><td><a href="/sites/${e(s.id)}">${e(s.url)}</a></td><td><code>${e(s.ingestToken)}</code></td><td class="num"><a href="/sites/${e(s.id)}">Rapor →</a></td></tr>`,
        )
        .join("\n")
    : '<tr><td colspan="3" class="empty">Henüz site eklenmedi.</td></tr>';

  return page(
    input.clientName,
    `<h1>${e(input.clientName)}</h1>
<h2>Siteler</h2>
<p class="empty">İnject token'ı embed scriptinize ekleyin: <code>&lt;script src="https://cdn.veriform.io/v1/veriform-embed.js" data-site-token="…"&gt;&lt;/script&gt;</code></p>
<table>
<tr><th>Site</th><th>Ingest token</th><th class="num">Rapor</th></tr>
${rows}
</table>
<form method="post" action="${e(input.clientHref)}/sites">
  <input name="url" type="url" placeholder="https://musteri-sitesi.com" required>
  <button type="submit">Site ekle</button>
</form>`,
    input.accent,
  );
}

export function renderLoginPage(options: { hasError?: boolean } = {}): string {
  return page(
    "Giriş",
    `<h1>Veriform Panel · Giriş</h1>
${options.hasError ? `<p class="badge-warn">${LOGIN_ERROR_TEXT}</p>` : ""}
<form method="post" action="/login">
  <input name="email" type="email" placeholder="E-posta" required>
  <input name="password" type="password" placeholder="Şifre" required>
  <button type="submit">Giriş yap</button>
</form>
<p class="empty">Hesabın yok mu? <a href="/register">Ajansını kaydet</a></p>`,
  );
}

export function renderRegisterPage(options: { errorKind?: "duplicate" | "generic" } = {}): string {
  const errorText = options.errorKind ? REGISTER_ERRORS[options.errorKind] : undefined;
  return page(
    "Kayıt",
    `<h1>Veriform Panel · Ajans Kaydı</h1>
${errorText ? `<p class="badge-warn">${errorText}</p>` : ""}
<form method="post" action="/register">
  <input name="name" placeholder="Ajans adı" required>
  <input name="email" type="email" placeholder="E-posta" required>
  <input name="password" type="password" placeholder="Şifre" minlength="8" required>
  <button type="submit">Kaydol</button>
</form>
<p class="empty">Zaten hesabın var mı? <a href="/login">Giriş yap</a></p>`,
  );
}
