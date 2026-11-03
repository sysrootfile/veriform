import type { StoredScan } from "./types.js";
import { diffScans } from "../scanner/diff.js";

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
  button.danger { background: #8b1d1d; }
  footer { color: #888; font-size: .8rem; border-top: 1px solid #eee; margin-top: 2rem; padding-top: .8rem; }
`;

/** White-label vurgu rengi — yalnızca #rrggbb; başka her şey (CSS enjeksiyonu dahil) yoksayılır. */
function safeAccent(color?: string | undefined): string | undefined {
  return color && /^#[0-9a-fA-F]{6}$/.test(color) ? color : undefined;
}

/** White-label logosu — yalnızca http(s) URL; javascript:/data: engellenir. */
function safeLogoUrl(url?: string | undefined): string | undefined {
  return url && /^https?:\/\/\S+$/i.test(url) ? url : undefined;
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
  logoUrl?: string | undefined;
}): string {
  const e = escapeHtml;
  const logoUrl = safeLogoUrl(input.logoUrl);
  const logo = logoUrl
    ? `<img src="${e(logoUrl)}" alt="${e(input.tenantName)}" style="height:30px;vertical-align:middle;margin-right:.5rem">`
    : "";
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
    `<h1>${logo}Veriform Panel · ${e(input.tenantName)}</h1>
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
  siteId: string;
  chainValid: boolean;
  scans: StoredScan[];
  draftLinks?: Array<{ href: string; label: string }> | undefined;
  evidenceHref?: string | undefined;
  bannerConfig?:
    | { bannerVersion: string; texts: { title: string; description: string; acceptAll: string; rejectAll: string } }
    | undefined;
}): string {
  const e = escapeHtml;
  const badge = input.chainValid
    ? '<span class="badge-ok">Kanıt zinciri geçerli ✓</span>'
    : '<span class="badge-warn">⚠ Zincir doğrulaması başarısız — kurcalama şüphesi</span>';

  const visible = input.scans.slice(-10);
  const paginationNote =
    input.scans.length > 10
      ? `<p class="empty">${input.scans.length} taramanın son 10'u gösteriliyor.</p>`
      : "";

  // Değişiklik uyarısı: son iki tarama arasında form/alan farkı varsa göster.
  const prevScan = input.scans.length >= 2 ? input.scans[input.scans.length - 2] : null;
  const currScan = input.scans.at(-1);
  let alertSection = "";
  if (prevScan && currScan) {
    const diff = diffScans(prevScan, currScan);
    const lines: string[] = [];
    for (const nf of diff.newForms) {
      lines.push(
        `<li>Yeni form/alan <code>${e(nf.formRef)}</code>: ${e(nf.newFieldNames.join(", "))}</li>`,
      );
    }
    for (const ref of diff.removedFormRefs) {
      lines.push(`<li>Kaldırılan form <code>${e(ref)}</code></li>`);
    }
    for (const category of diff.newCookieCategories) {
      lines.push(`<li>Yeni çerez kategorisi: ${e(category)}</li>`);
    }
    if (lines.length) {
      alertSection = `<h2>Değişiklik Uyarısı</h2><ul>${lines.join("\n")}</ul>`;
    }
  }

  const rows = visible.length
    ? visible
        .map((s) => {
          const violations = s.cookies.filter((c) => c.category !== "necessary").length;
          return `<tr><td>${e(s.scannedAt)}</td><td class="num">${s.report.formCount}</td><td class="num">${s.report.riskFlags.length}</td><td class="num">${violations}</td></tr>`;
        })
        .join("\n")
    : '<tr><td colspan="4" class="empty">Henüz tarama yok — `pnpm demo -- <site-url>` ile ilk taramayı çalıştırın.</td></tr>';

  const draftLinks = (input.draftLinks ?? [])
    .map((d) => `<a href="${e(d.href)}">${e(d.label)}</a>`)
    .join(" · ");
  const draftSection = input.draftLinks?.length
    ? `<p>Metin taslakları (yazdırılabilir): ${draftLinks}</p>`
    : "";
  const evidenceLink = input.evidenceHref
    ? `<p><a href="${e(input.evidenceHref)}">Kanıt ihracı (CSV) →</a></p>`
    : "";

  const bc = input.bannerConfig;
  const bannerForm = `<h2>Rıza Bannerı Konfigürasyonu</h2>
<p class="empty">Bu ayarlar embed scripte <code>/api/embed/config</code> üzerinden akar; bannerVersion değişirse müşteri yeniden rıza verir.</p>
<form method="post" action="/sites/${e(input.siteId)}/banner">
  <input name="bannerVersion" placeholder="banner-2026-11" value="${e(bc?.bannerVersion ?? "")}" required>
  <input name="title" placeholder="Başlık" value="${e(bc?.texts.title ?? "Çerez Tercihleriniz")}" required>
  <input name="description" placeholder="Açıklama" value="${e(bc?.texts.description ?? "")}">
  <input name="acceptAll" placeholder="Kabul butonu" value="${e(bc?.texts.acceptAll ?? "Tümünü Kabul Et")}" required>
  <input name="rejectAll" placeholder="Reddet butonu" value="${e(bc?.texts.rejectAll ?? "Sadece Zorunlu")}" required>
  <button type="submit">Konfigürasyonu kaydet</button>
</form>`;

  const reviewSection =
    currScan && currScan.report.review.length
      ? `<h2>İnsan Onayı Bekleyen Sınıflandırmalar</h2>
<table>
<tr><th>Form</th><th>Alan</th><th>Mevcut kategori</th><th>Güven</th><th>Düzelt</th></tr>
${currScan.report.review
  .map((r) => {
    const options = ["tckn", "iban", "card", "phone", "email", "full_name", "birthdate", "address", "passport", "free_text"];
    return `<tr><td>${e(r.formRef)}</td><td>${e(r.fieldName ?? "—")}</td><td>${e(r.category)}</td><td class="num">${r.confidence}</td>
<td><form method="post" action="/sites/${e(input.siteId)}/review">
  <input type="hidden" name="scanId" value="${e(currScan.id)}">
  <input type="hidden" name="fieldName" value="${e(r.fieldName ?? "")}">
  <select name="category">${options.map((o) => `<option value="${o}">${o}</option>`).join("")}</select>
  <button type="submit">Düzelt</button>
</form></td></tr>`;
  })
  .join("\n")}
</table>`
      : "";

  return page(
    input.siteUrl,
    `<h1>${e(input.siteUrl)}</h1>
<p>${badge}</p>
${draftSection}
${evidenceLink}
${alertSection}
${reviewSection}
<h2>Taramalar</h2>
${paginationNote}
<table>
<tr><th>Tarih</th><th class="num">Form</th><th class="num">Risk</th><th class="num">Çerez ihlali</th></tr>
${rows}
</table>
${bannerForm}`,
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
</form>
<h2>Tehlikeli Bölge</h2>
<p class="empty">Silmek kalıcıdır: müşterinin tüm siteleri, taramaları ve <strong>rıza kanıt zinciri</strong> birlikte silinir.</p>
<form method="post" action="${e(input.clientHref)}/delete">
  <button type="submit" class="danger">Müşteriyi kalıcı sil</button>
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
