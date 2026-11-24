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
  .setup { border: 1px solid #e5e5ea; border-radius: 8px; padding: .9rem 1.1rem; margin: 0 0 1.4rem; background: #fafafb; }
  .setup h2 { margin: 0 0 .5rem; font-size: 1rem; }
  .setup ol { margin: .3rem 0 .5rem; padding-left: 1.2rem; }
  .setup li { margin: .35rem 0; font-size: .92rem; }
  .setup li.setup-done { color: #127a3d; }
  .setup-hint { color: #777; font-size: .85rem; }
  form { margin: 1rem 0; display: flex; gap: .5rem; flex-wrap: wrap; }
  input, button, select { padding: .45rem .7rem; border: 1px solid #ccc; border-radius: 6px; font-size: .92rem; }
  button { background: var(--accent); color: #fff; border: none; cursor: pointer; }
  button:hover { filter: brightness(1.15); }
  button.danger { background: #8b1d1d; }
  a:focus-visible, button:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .topnav { display: flex; flex-wrap: wrap; gap: .25rem; align-items: center; border-bottom: 1px solid #e5e5ea; padding-bottom: .6rem; margin-bottom: 1.2rem; }
  .topnav a { color: #444; text-decoration: none; font-size: .88rem; padding: .35rem .65rem; border-radius: 6px; }
  .topnav a:hover { background: #f2f2f5; color: #16161f; }
  .topnav a[aria-current="page"] { background: var(--accent); color: #fff; font-weight: 600; }
  .topnav .nav-logout { margin-left: auto; color: #8b1d1d; }
  .topnav .nav-logout:hover { background: #fbeaea; color: #8b1d1d; }
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

type NavActive = "clients" | "audit" | "api-keys" | "account" | "api-docs" | "guide";

const NAV_ITEMS: Array<{ href: string; label: string; key: NavActive }> = [
  { href: "/clients", label: "Müşteriler", key: "clients" },
  { href: "/audit", label: "Denetim İzi", key: "audit" },
  { href: "/settings/api-keys", label: "API Anahtarları", key: "api-keys" },
  { href: "/settings/account", label: "Hesap", key: "account" },
  { href: "/api/docs", label: "API Docs", key: "api-docs" },
  { href: "/rehber", label: "Rehber", key: "guide" },
];

function nav(active: NavActive): string {
  const links = NAV_ITEMS.map(
    (item) =>
      `<a href="${item.href}"${item.key === active ? ' aria-current="page"' : ""}>${item.label}</a>`,
  ).join("\n");
  return `<nav class="topnav" aria-label="Panel">
${links}
<a href="/logout" class="nav-logout">Çıkış</a>
</nav>`;
}

export const panelPage = (title: string, body: string, accent?: string | undefined, navActive?: NavActive): string =>
  `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" href="data:,">
<title>Veriform Panel — ${escapeHtml(title)}</title>
<style>:root { --accent: ${safeAccent(accent) ?? "#16161f"}; }
${STYLE}</style>
</head>
<body>
${navActive ? nav(navActive) : ""}
${body}
<footer>Veriform panel — izleyici ham veri saklamaz; kanıtlar kurcalama kanıtlı zincirde.</footer>
</body>
</html>`;

export interface ClientRow {
  id: string;
  name: string;
}

export interface OnboardingStatus {
  hasClient: boolean;
  hasSite: boolean;
  hasScan: boolean;
}

function setupStep(done: boolean, title: string, hint: string): string {
  return `<li${done ? ' class="setup-done"' : ""}>${done ? "✓" : "○"} <strong>${title}</strong> — <span class="setup-hint">${hint}</span></li>`;
}

export function renderClientsPage(input: {
  tenantName: string;
  clients: ClientRow[];
  demoSiteHref?: string | undefined;
  accent?: string | undefined;
  logoUrl?: string | undefined;
  onboarding?: OnboardingStatus | undefined;
  quota?: { label: string; used: number; limit: number | null } | undefined;
  emailVerified?: boolean | undefined;
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

  const ob = input.onboarding;
  const setupSection =
    ob && !(ob.hasClient && ob.hasSite && ob.hasScan)
      ? `<section class="setup" aria-label="Kurulum">
<h2>Kurulum</h2>
<ol>
${setupStep(ob.hasClient, "Müşteri ekle", "Aşağıdaki formla ilk müşterinizi kaydedin.")}
${setupStep(ob.hasSite, "Site ekle", "Müşteri sayfasından site URL'i girin; embed snippet'ini sitenizin &lt;head&gt; bölümüne kurun.")}
${setupStep(ob.hasScan, "İlk tarama", "Site sayfasındaki Sürekli İzleme çizelgesini açın — worker ilk taramayı yapar.")}
</ol>
<p class="setup-hint">Ayrıntılı anlatım: <a href="/rehber">Rehber</a></p>
</section>`
      : "";

  const q = input.quota;
  const quotaLine = q
    ? `<p class="empty">Paket: ${e(q.label)} — ${q.limit === null ? `${q.used} site (sınırsız)` : `${q.used}/${q.limit} site kullanıldı`}</p>`
    : "";

  const verifyNag =
    input.emailVerified === false
      ? `<p class="badge-warn">E-posta adresiniz doğrulanmadı — <a href="/settings/account">Hesap ayarları</a>ndan doğrulama bağlantısı gönderin.</p>`
      : "";

  return panelPage(
    input.tenantName,
    `<h1>${logo}Veriform Panel · ${e(input.tenantName)}</h1>
${verifyNag}
${quotaLine}
${demoLink}
${setupSection}
<h2>Müşteriler</h2>
<table>${rows}</table>
<form method="post" action="/clients">
  <input name="name" placeholder="Müşteri adı" required>
  <button type="submit">Müşteri ekle</button>
</form>`,
    input.accent,
    "clients",
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
  scanIntervalHours?: number | undefined;
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
    : '<tr><td colspan="4" class="empty">Henüz tarama yok — aşağıdaki Sürekli İzleme çizelgesini açın; worker vakti gelen siteleri tarar ve sonuçlar burada listelenir.</td></tr>';

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
  const scheduleLabel =
    input.scanIntervalHours === undefined || input.scanIntervalHours === 0
      ? "Kapalı"
      : `Her ${input.scanIntervalHours} saatte bir`;
  const bannerForm = `<h2>Rıza Bannerı Konfigürasyonu</h2>
<p class="empty">Bu ayarlar embed scripte <code>/api/embed/config</code> üzerinden akar; bannerVersion değişirse müşteri yeniden rıza verir.</p>
<form method="post" action="/sites/${e(input.siteId)}/banner">
  <input name="bannerVersion" placeholder="banner-2026-11" value="${e(bc?.bannerVersion ?? "")}" required>
  <input name="title" placeholder="Başlık" value="${e(bc?.texts.title ?? "Çerez Tercihleriniz")}" required>
  <input name="description" placeholder="Açıklama" value="${e(bc?.texts.description ?? "")}">
  <input name="acceptAll" placeholder="Kabul butonu" value="${e(bc?.texts.acceptAll ?? "Tümünü Kabul Et")}" required>
  <input name="rejectAll" placeholder="Reddet butonu" value="${e(bc?.texts.rejectAll ?? "Sadece Zorunlu")}" required>
  <button type="submit">Konfigürasyonu kaydet</button>
</form>
<h2>Sürekli İzleme</h2>
<p class="empty">Mevcut aralık: <strong>${e(scheduleLabel)}</strong> — site değişiklikleri sonraki taramada raporlanır.</p>
<form method="post" action="/sites/${e(input.siteId)}/schedule">
  <select name="intervalHours">
    <option value="0">Kapalı</option>
    <option value="24">Günlük (24 saat)</option>
    <option value="168">Haftalık (168 saat)</option>
    <option value="720">Aylık (720 saat)</option>
  </select>
  <button type="submit">Çizelgeyi kaydet</button>
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

  return panelPage(
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
    undefined,
    "clients",
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
  logoUrl?: string | undefined;
  /** Panelin kendi embed adresi — snippet'te gösterilir (varsayılan göreli yol). */
  embedSrc?: string | undefined;
  /** Paket kotası dolduysa yükseltme uyarısı gösterilir. */
  quotaFull?: boolean | undefined;
}): string {
  const e = escapeHtml;
  const rows = input.sites.length
    ? input.sites
        .map(
          (s) =>
            `<tr><td><a href="/sites/${e(s.id)}">${e(s.url)}</a></td><td><code>${e(s.ingestToken)}</code></td><td class="num"><a href="/sites/${e(s.id)}">Rapor →</a></td></tr>`,
        )
        .join("\n")
    : '<tr><td colspan="3" class="empty">Henüz site eklenmedi — aşağıdaki formla ekleyin, embed snippet\'ini kurun ve Sürekli İzleme\'yi açın; ilk tarama worker turunda gelir.</td></tr>';

  const logoUrl = safeLogoUrl(input.logoUrl);
  const logo = logoUrl
    ? `<img src="${e(logoUrl)}" alt="${e(input.clientName)}" style="height:30px;vertical-align:middle;margin-right:.5rem">`
    : "";

  const quotaWarning = input.quotaFull
    ? '<p class="badge-warn">Site kotası doldu — yeni site eklemek için paketinizi yükseltin: <a href="/#paketler">Paketler</a> · <a href="/#iletisim">İletişim</a></p>'
    : "";

  return panelPage(
    input.clientName,
    `<h1>${logo}${e(input.clientName)}</h1>
${quotaWarning}
<h2>Siteler</h2>
<p class="empty">Embed scriptini sitenizin <code>&lt;head&gt;</code> bölümüne ekleyin; <code>data-site-token</code> yerine aşağıdaki ingest token'ı yazın:</p>
<p><code>&lt;script src="${e(input.embedSrc ?? "/embed.js")}" data-site-token="…"&gt;&lt;/script&gt;</code></p>
<table>
<tr><th>Site</th><th>Ingest token</th><th class="num">Rapor</th></tr>
${rows}
</table>
<form method="post" action="${e(input.clientHref)}/sites">
  <input name="url" type="url" placeholder="https://musteri-sitesi.com" required>
  <button type="submit">Site ekle</button>
</form>
<h2>Marka (beyaz etiket)</h2>
<form method="post" action="${e(input.clientHref)}/branding">
  <input name="brandColor" placeholder="#rrggbb" pattern="#[0-9a-fA-F]{6}" value="">
  <input name="brandLogoUrl" type="url" placeholder="https://musteri.com/logo.png">
  <button type="submit">Markayı kaydet</button>
</form>
<h2>Tehlikeli Bölge</h2>
<p class="empty">Silmek kalıcıdır: müşterinin tüm siteleri, taramaları ve <strong>rıza kanıt zinciri</strong> birlikte silinir.</p>
<form method="post" action="${e(input.clientHref)}/delete">
  <button type="submit" class="danger">Müşteriyi kalıcı sil</button>
</form>`,
    input.accent,
    "clients",
  );
}

export function renderAuditPage(input: {
  entries: Array<{ id: string; action: string; detail: Record<string, unknown>; createdAt: string }>;
}): string {
  const e = escapeHtml;
  const rows = input.entries.length
    ? input.entries
        .map(
          (a) =>
            `<tr><td>${e(a.createdAt)}</td><td><code>${e(a.action)}</code></td><td>${e(JSON.stringify(a.detail))}</td></tr>`,
        )
        .join("\n")
    : '<tr><td colspan="3" class="empty">Denetim kaydı yok.</td></tr>';

  return panelPage(
    "Denetim İzi",
    `<h1>Denetim İzi (Audit Log)</h1>
<p class="empty">Panelde yapılan her mutasyon burada iz bırakır — KVKK m.12 kayıt yükümlülüğü zemin.</p>
<table>
<tr><th>Zaman</th><th>Eylem</th><th>Detay</th></tr>
${rows}
</table>`,
    undefined,
    "audit",
  );
}

export function renderApiKeysPage(input: {
  keys: Array<{ id: string; name: string; prefix: string; revokedAt?: string | undefined; lastUsedAt?: string | undefined }>;
  /** Yeni oluşturulan anahtarın düz değeri — yalnızca bu render'da gösterilir. */
  newKey?: string | undefined;
}): string {
  const e = escapeHtml;
  const newKeyBlock = input.newKey
    ? `<p class="badge-ok">Yeni anahtar oluşturuldu — <strong>bu değeri şimdi kopyalayın, bir daha gösterilmeyecek</strong>:</p>
<pre>${e(input.newKey)}</pre>`
    : "";

  const rows = input.keys.length
    ? input.keys
        .map(
          (k) =>
            `<tr><td>${e(k.name)}</td><td><code>${e(k.prefix)}…</code></td><td>${e(k.lastUsedAt ?? "hiç kullanılmadı")}</td><td>${
              k.revokedAt
                ? '<span class="badge-warn">İptal edildi</span>'
                : `<form method="post" action="/settings/api-keys/${e(k.id)}/revoke"><button type="submit" class="danger">İptal</button></form>`
            }</td></tr>`,
        )
        .join("\n")
    : '<tr><td colspan="4" class="empty">Henüz API anahtarı yok.</td></tr>';

  return panelPage(
    "API Anahtarları",
    `<h1>Headless API Anahtarları</h1>
${newKeyBlock}
<h2>Anahtarlar</h2>
<table>
<tr><th>Ad</th><th>Ön ek</th><th>Son kullanım</th><th>İşlem</th></tr>
${rows}
</table>
<form method="post" action="/settings/api-keys">
  <input name="name" placeholder="Anahtar adı (örn. CI, entegrasyon)" required>
  <button type="submit">Anahtar oluştur</button>
</form>
<h2>Dokümantasyon</h2>
<p><a href="/api/docs">Headless API dokümantasyonu →</a></p>`,
    undefined,
    "api-keys",
  );
}

export function renderLoginPage(
  options: { hasError?: boolean; notice?: "reset" | "deleted" | undefined } = {},
): string {
  const noticeText =
    options.notice === "reset"
      ? "Şifreniz güncellendi — yeni şifrenizle giriş yapın."
      : options.notice === "deleted"
        ? "Hesabınız ve tüm verileriniz silindi."
        : undefined;
  return panelPage(
    "Giriş",
    `<h1>Veriform Panel · Giriş</h1>
${noticeText ? `<p class="badge-ok">${noticeText}</p>` : ""}
${options.hasError ? `<p class="badge-warn">${LOGIN_ERROR_TEXT}</p>` : ""}
<form method="post" action="/login">
  <input name="email" type="email" placeholder="E-posta" required>
  <input name="password" type="password" placeholder="Şifre" required>
  <button type="submit">Giriş yap</button>
</form>
<p class="empty"><a href="/forgot-password">Şifreni mi unuttun?</a></p>
<p class="empty">Hesabın yok mu? <a href="/register">Ajansını kaydet</a></p>`,
  );
}

export function renderRegisterPage(options: { errorKind?: "duplicate" | "generic" } = {}): string {
  const errorText = options.errorKind ? REGISTER_ERRORS[options.errorKind] : undefined;
  return panelPage(
    "Kayıt",
    `<h1>Veriform Panel · Ajans Kaydı</h1>
${errorText ? `<p class="badge-warn">${errorText}</p>` : ""}
<form method="post" action="/register">
  <input name="name" placeholder="Ajans adı" required>
  <input name="email" type="email" placeholder="E-posta" required>
  <input name="password" type="password" placeholder="Şifre" minlength="8" required>
  <select name="package" aria-label="Paket">
    <option value="starter" selected>Starter — 3 site</option>
    <option value="pro">Pro — 15 site</option>
    <option value="ultimate">Ultimate — sınırsız site</option>
  </select>
  <button type="submit">Kaydol</button>
</form>
<p class="empty">Zaten hesabın var mı? <a href="/login">Giriş yap</a></p>`,
  );
}

export function renderForgotPasswordPage(options: { sent?: boolean } = {}): string {
  return panelPage(
    "Şifremi Unuttum",
    `<h1>Şifre Sıfırlama</h1>
${options.sent ? '<p class="badge-ok">Bu e-posta kayıtlıysa sıfırlama bağlantısı gönderildi. Gelen kutunuzu kontrol edin.</p>' : ""}
<form method="post" action="/forgot-password">
  <input name="email" type="email" placeholder="E-posta" required>
  <button type="submit">Sıfırlama bağlantısı gönder</button>
</form>
<p class="empty"><a href="/login">Girişe dön</a></p>`,
  );
}

const RESET_ERRORS = {
  short: "Şifre en az 8 karakter olmalı.",
  invalid: "Bağlantı geçersiz veya süresi dolmuş — yeni bir sıfırlama bağlantısı isteyin.",
} as const;

export function renderResetPasswordPage(input: {
  token: string;
  errorKind?: keyof typeof RESET_ERRORS;
}): string {
  const e = escapeHtml;
  return panelPage(
    "Yeni Şifre",
    `<h1>Yeni Şifre Belirle</h1>
${input.errorKind ? `<p class="badge-warn">${RESET_ERRORS[input.errorKind]}</p>` : ""}
<form method="post" action="/reset-password">
  <input type="hidden" name="token" value="${e(input.token)}">
  <input name="password" type="password" placeholder="Yeni şifre" minlength="8" required>
  <button type="submit">Şifreyi güncelle</button>
</form>
<p class="empty"><a href="/forgot-password">Yeni bağlantı iste</a> · <a href="/login">Girişe dön</a></p>`,
  );
}

export function renderVerifyEmailResultPage(input: { ok: boolean }): string {
  return panelPage(
    "E-posta Doğrulama",
    input.ok
      ? `<h1>E-posta Doğrulama</h1>
<p class="badge-ok">E-posta adresiniz doğrulandı.</p>
<p><a href="/clients">Panele devam et →</a></p>`
      : `<h1>E-posta Doğrulama</h1>
<p class="badge-warn">Bağlantı geçersiz veya süresi dolmuş.</p>
<p><a href="/settings/account">Hesap ayarları</a>ndan yeni doğrulama bağlantısı isteyebilirsiniz.</p>`,
  );
}

const ACCOUNT_NOTICES = {
  "verify-sent": "E-posta adresinize doğrulama bağlantısı gönderildi.",
  "password-changed": "Şifreniz güncellendi.",
} as const;

const ACCOUNT_ERRORS = {
  current: "Girdiğiniz mevcut şifre hatalı.",
  short: "Şifre en az 8 karakter olmalı.",
  mail: "E-posta gönderilemedi — daha sonra tekrar deneyin.",
} as const;

export function renderAccountSettingsPage(input: {
  email: string;
  emailVerified: boolean;
  notice?: keyof typeof ACCOUNT_NOTICES | undefined;
  errorKind?: keyof typeof ACCOUNT_ERRORS | undefined;
}): string {
  const e = escapeHtml;
  const verifyBlock = input.emailVerified
    ? '<p><span class="badge-ok">Doğrulandı</span></p>'
    : `<p><span class="badge-warn">E-posta doğrulanmadı</span></p>
<form method="post" action="/settings/account/resend-verification">
  <button type="submit">Doğrulama bağlantısı gönder</button>
</form>`;

  return panelPage(
    "Hesap Ayarları",
    `<h1>Hesap Ayarları</h1>
${input.notice ? `<p class="badge-ok">${ACCOUNT_NOTICES[input.notice]}</p>` : ""}
${input.errorKind ? `<p class="badge-warn">${ACCOUNT_ERRORS[input.errorKind]}</p>` : ""}
<h2>E-posta</h2>
<p>${e(input.email)}</p>
${verifyBlock}
<h2>Şifre değiştir</h2>
<form method="post" action="/settings/account/password">
  <input name="currentPassword" type="password" placeholder="Mevcut şifre" required>
  <input name="newPassword" type="password" placeholder="Yeni şifre" minlength="8" required>
  <button type="submit">Şifreyi güncelle</button>
</form>
<h2>Hesabı sil</h2>
<p class="empty">Hesabınız, müşterileriniz, siteleriniz ve tüm tarama/kanıt verileri kalıcı olarak silinir. Bu işlem geri alınamaz.</p>
<form method="post" action="/settings/account/delete">
  <label><input type="checkbox" name="confirm" required> Hesabımı ve tüm verilerimi kalıcı olarak silmeyi onaylıyorum</label>
  <button type="submit" class="danger">Hesabı kalıcı olarak sil</button>
</form>`,
    undefined,
    "account",
  );
}
