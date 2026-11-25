import type { ContactPackage, ContactRequest, SetupProgress, StoredScan, TenantKind } from "./types.js";
import { PLAN_LABELS, PLAN_LIMITS } from "./plans.js";
import { diffScans } from "../scanner/diff.js";
import { FONT_FACES, WORLD_TOKENS, WORLD_BASE, SHEET_CSS, PANEL_CSS, sheetOpen } from "./design.js";

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

const STYLE = `${FONT_FACES}
${WORLD_TOKENS}
${WORLD_BASE}
${SHEET_CSS}
${PANEL_CSS}`;

/** White-label vurgu rengi — yalnızca #rrggbb; başka her şey (CSS enjeksiyonu dahil) yoksayılır. */
function safeAccent(color?: string | undefined): string | undefined {
  return color && /^#[0-9a-fA-F]{6}$/.test(color) ? color : undefined;
}

/** White-label logosu — yalnızca http(s) URL; javascript:/data: engellenir. */
function safeLogoUrl(url?: string | undefined): string | undefined {
  return url && /^https?:\/\/\S+$/i.test(url) ? url : undefined;
}

type NavActive = "clients" | "audit" | "api-keys" | "account" | "api-docs" | "guide" | "plan";

const NAV_ITEMS: Array<{ href: string; label: string; key: NavActive }> = [
  { href: "/clients", label: "Müşteriler", key: "clients" },
  { href: "/settings/plan", label: "Plan", key: "plan" },
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

export const panelPage = (title: string, body: string, accent?: string | undefined, navActive?: NavActive, setup?: SetupProgress | undefined): string =>
  `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" href="data:,">
<title>Veriform Panel — ${escapeHtml(title)}</title>
<style>:root { --accent: ${safeAccent(accent) ?? "#1e7a46"}; --sheet-w: 1080px; }
${STYLE}</style>
</head>
<body>
${navActive ? nav(navActive) : ""}
${sheetOpen(escapeHtml(title))}
${setup ? setupStrip(setup) : ""}
${body}
<footer>Veriform panel — izleyici ham veri saklamaz; kanıtlar kurcalama kanıtlı zincirde.</footer>
</div>
</body>
</html>`;

export interface ClientRow {
  id: string;
  name: string;
}

/** Kalıcı kurulum şeridi: altı adım, tek sıradaki eylem; bitince kaşeye küçülür. */
function setupStrip(s: SetupProgress): string {
  const e = escapeHtml;
  const steps = [
    { done: s.hasClient, title: "Müşteri ekle", hint: "Ajansınızın müşterisini kaydedin.", href: "/clients#yeni-musteri", locked: false },
    { done: s.hasSite, title: "Site ekle", hint: "Müşteri sayfasından site adresini girin.", href: s.firstClientId ? `/clients/${e(s.firstClientId)}#yeni-site` : "/clients", locked: false },
    { done: s.hasScan, title: "İlk tarama", hint: "Site sayfasında Şimdi tara düğmesine basın.", href: s.firstSiteId ? `/sites/${e(s.firstSiteId)}#tarama` : "/clients", locked: false },
    { done: s.emailVerified, title: "E-postanı onayla", hint: "Gelen kutusundaki onay bağlantısına tıklayın.", href: "/settings/account", locked: false },
    { done: s.hasEmbed, title: "İzleme kodunu kur", hint: "Kodu sitenizin head bölümüne ekleyin; bağlantı otomatik doğrulanır.", href: s.firstClientId ? `/clients/${e(s.firstClientId)}#izleme-kodu` : "/clients", locked: !s.emailVerified },
    { done: s.hasBanner, title: "Banner'ı yayınla", hint: "Site sayfasında rıza bannerı metinlerini kaydedin.", href: s.firstSiteId ? `/sites/${e(s.firstSiteId)}#banner` : "/clients", locked: !s.emailVerified },
  ];
  if (steps.every((st) => st.done)) {
    return '<p class="setup-complete"><span class="badge-ok">Kurulum tamam ✓</span></p>';
  }
  const current = steps.findIndex((st) => !st.done);
  const items = steps
    .map((st, i) => {
      if (st.done) return `<li class="setup-done">✓ <strong>${st.title}</strong></li>`;
      if (i === current) {
        return `<li class="setup-current">○ <strong>${st.title}</strong> — <span class="setup-hint">${st.hint}</span> <a class="setup-cta" href="${st.href}">Yap →</a></li>`;
      }
      const lock = st.locked ? ' — <span class="setup-hint">e-posta onayı bekliyor</span>' : "";
      return `<li>○ <strong>${st.title}</strong>${lock}</li>`;
    })
    .join("\n");
  return `<section class="setup" aria-label="Kurulum">
<h2>Kurulum</h2>
<ol>
${items}
</ol>
<p class="setup-hint">Ayrıntılı anlatım: <a href="/rehber">Rehber</a></p>
</section>`;
}

export function renderClientsPage(input: {
  tenantName: string;
  clients: ClientRow[];
  demoSiteHref?: string | undefined;
  accent?: string | undefined;
  logoUrl?: string | undefined;
  setup?: SetupProgress | undefined;
  quota?: { label: string; used: number; limit: number | null } | undefined;
  emailVerified?: boolean | undefined;
  operator?: boolean | undefined;
  trial?: "none" | "active" | "expired" | undefined;
  trialDaysLeft?: number | undefined;
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
    : '<tr><td class="empty">Henüz müşteri eklenmedi. <a href="#yeni-musteri">İlk müşterinizi ekleyin →</a></td></tr>';

  const demoLink = input.demoSiteHref
    ? `<p class="empty">Demo: <a href="${e(input.demoSiteHref)}">örnek site sayfası</a></p>`
    : "";

  const q = input.quota;
  const quotaLine = q
    ? `<p class="empty">Paket: ${e(q.label)} — ${q.limit === null ? `${q.used} site (sınırsız)` : `${q.used}/${q.limit} site kullanıldı`}</p>`
    : "";

  const operatorLink = input.operator
    ? '<p class="empty"><a href="/operator/contacts">Operatör konsolu →</a></p>'
    : "";

  const verifyNag =
    input.emailVerified === false
      ? `<p class="badge-warn">E-posta adresiniz doğrulanmadı — <a href="/settings/account">Hesap ayarları</a>ndan doğrulama bağlantısı gönderin.</p>`
      : "";

  const trialBanner =
    input.trial === "active"
      ? `<p class="badge-ok">Deneme sürüyor — ${input.trialDaysLeft ?? 0} gün kaldı. <a href="/settings/plan">Plan ve kullanım</a></p>`
      : input.trial === "expired"
        ? `<p class="badge-warn">Deneme sona erdi — yeni site eklemek için planınızı etkinleştirin. <a href="/settings/plan">Plan →</a></p>`
        : "";

  return panelPage(
    input.tenantName,
    `<h1>${logo}Veriform Panel · ${e(input.tenantName)}</h1>
${verifyNag}
${trialBanner}
${operatorLink}
${quotaLine}
${demoLink}
<h2>Müşteriler</h2>
<div class="table-scroll">
<table>${rows}</table>
</div>
<form method="post" action="/clients" id="yeni-musteri">
  <input name="name" placeholder="Müşteri adı" required>
  <button type="submit">Müşteri ekle</button>
</form>`,
    input.accent,
    "clients",
    input.setup,
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
  embedLastSeenAt?: string | undefined;
  scanNotice?: "ok" | "error" | "limited" | undefined;
  emailVerified?: boolean | undefined;
  setup?: SetupProgress | undefined;
}): string {
  const e = escapeHtml;
  const badge = input.chainValid
    ? '<span class="badge-ok">Kanıt zinciri geçerli ✓</span>'
    : '<span class="badge-warn">⚠ Zincir doğrulaması başarısız — kurcalama şüphesi</span>';

  const embedBadge = input.embedLastSeenAt
    ? `<p><span class="badge-ok">Bağlantı doğrulandı ✓</span> <span class="empty">İzleme kodu son görülme: ${e(input.embedLastSeenAt)}</span></p>`
    : "";

  const scanNotice =
    input.scanNotice === "ok"
      ? '<p class="badge-ok">Tarama tamamlandı — sonuçlar aşağıda.</p>'
      : input.scanNotice === "error"
        ? '<p class="badge-warn">Tarama şu anda gerçekleştirilemedi — lütfen daha sonra tekrar deneyin.</p>'
        : input.scanNotice === "limited"
          ? '<p class="badge-warn">Çok fazla tarama isteği — bir dakika bekleyip tekrar deneyin.</p>'
          : "";

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
    : '<tr><td colspan="4" class="empty">Henüz tarama yok — ilk taramayı şimdi başlatın; sonuçlar burada listelenir.</td></tr>';

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
  const bannerForm =
    input.emailVerified === false
      ? `<h2 id="banner">Rıza Bannerı</h2>
<p class="badge-warn">Banner yayını için e-posta adresinizi onaylayın.</p>
<form method="post" action="/settings/account/resend-verification">
  <button type="submit">Onay bağlantısı gönder</button>
</form>`
      : `<h2 id="banner">Rıza Bannerı Konfigürasyonu</h2>
<p class="empty">Bu ayarlar izleme koduna <code>/api/embed/config</code> üzerinden akar; bannerVersion değişirse müşteri yeniden rıza verir.</p>
<form method="post" action="/sites/${e(input.siteId)}/banner">
  <input name="bannerVersion" placeholder="banner-2026-11" value="${e(bc?.bannerVersion ?? "")}" required>
  <input name="title" placeholder="Başlık" value="${e(bc?.texts.title ?? "Çerez Tercihleriniz")}" required>
  <input name="description" placeholder="Açıklama" value="${e(bc?.texts.description ?? "")}">
  <input name="acceptAll" placeholder="Kabul butonu" value="${e(bc?.texts.acceptAll ?? "Tümünü Kabul Et")}" required>
  <input name="rejectAll" placeholder="Reddet butonu" value="${e(bc?.texts.rejectAll ?? "Sadece Zorunlu")}" required>
  <button type="submit">Konfigürasyonu kaydet</button>
</form>`;
  const scheduleForm = `<details class="advanced">
<summary>Sürekli İzleme (gelişmiş)</summary>
<p class="empty">Mevcut aralık: <strong>${e(scheduleLabel)}</strong> — site değişiklikleri sonraki taramada raporlanır.</p>
<form method="post" action="/sites/${e(input.siteId)}/schedule">
  <select name="intervalHours">
    <option value="0">Kapalı</option>
    <option value="24">Günlük (24 saat)</option>
    <option value="168">Haftalık (168 saat)</option>
    <option value="720">Aylık (720 saat)</option>
  </select>
  <button type="submit">Çizelgeyi kaydet</button>
</form>
</details>`;

  const reviewSection =
    currScan && currScan.report.review.length
      ? `<h2>İnsan Onayı Bekleyen Sınıflandırmalar</h2>
<div class="table-scroll">
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
</table>
</div>`
      : "";

  return panelPage(
    input.siteUrl,
    `<h1>${e(input.siteUrl)}</h1>
<p>${badge}</p>
${embedBadge}
${scanNotice}
${draftSection}
${evidenceLink}
${alertSection}
${reviewSection}
<h2 id="tarama">Taramalar</h2>
<form method="post" action="/sites/${e(input.siteId)}/scan">
  <button type="submit">Şimdi tara</button>
</form>
${paginationNote}
<div class="table-scroll">
<table>
<tr><th>Tarih</th><th class="num">Form</th><th class="num">Risk</th><th class="num">Çerez ihlali</th></tr>
${rows}
</table>
</div>
${bannerForm}
${scheduleForm}`,
    undefined,
    "clients",
    input.setup,
  );
}

/** Giriş/kayıt hata metinleri — rota yalnızca kod/boolean geçirir, metin sabittir. */
export const LOGIN_ERROR_TEXT = "E-posta veya şifre hatalı";
export type RegisterErrorKind = "duplicate" | "generic" | "password" | "email" | "name";

export function registerErrorKind(message: string): RegisterErrorKind {
  if (/zaten kayıtlı/.test(message)) return "duplicate";
  if (/şifre/.test(message)) return "password";
  if (/e-posta adresi/.test(message)) return "email";
  if (/ajans adı/.test(message)) return "name";
  return "generic";
}

export const REGISTER_ERRORS: Record<RegisterErrorKind, string> = {
  duplicate: "Bu e-posta zaten kayıtlı — başka bir e-posta deneyin.",
  password: "Şifre en az 8, en fazla 128 karakter olmalı.",
  email: "Geçerli bir e-posta adresi girin.",
  name: "Ajans adı en az 2 karakter olmalı.",
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
  /** Eklenmek istenen site adresi reddedildiyse (özel ağ, http dışı protokol) uyarı gösterilir. */
  siteInvalid?: boolean | undefined;
  emailVerified?: boolean | undefined;
  setup?: SetupProgress | undefined;
}): string {
  const e = escapeHtml;
  const rows = input.sites.length
    ? input.sites
        .map(
          (s) =>
            `<tr><td><a href="/sites/${e(s.id)}">${e(s.url)}</a></td><td><code>${e(s.ingestToken)}</code></td><td class="num"><a href="/sites/${e(s.id)}">Rapor →</a></td></tr>`,
        )
        .join("\n")
    : '<tr><td colspan="3" class="empty">Henüz site eklenmedi — <a href="#yeni-site">ilk sitenizi ekleyin →</a>; ilk taramayı site sayfasından şimdi başlatabilirsiniz.</td></tr>';

  const logoUrl = safeLogoUrl(input.logoUrl);
  const logo = logoUrl
    ? `<img src="${e(logoUrl)}" alt="${e(input.clientName)}" style="height:30px;vertical-align:middle;margin-right:.5rem">`
    : "";

  const quotaWarning = input.quotaFull
    ? '<p class="badge-warn">Site kotası doldu — yeni site eklemek için paketinizi yükseltin: <a href="/#paketler">Paketler</a> · <a href="/#iletisim">İletişim</a></p>'
    : "";

  const siteWarning = input.siteInvalid
    ? '<p class="badge-warn">Site eklenmedi: yalnızca genel internetteki http(s) site adresleri eklenebilir.</p>'
    : "";

  const installSection =
    input.emailVerified === false
      ? `<p class="badge-warn">İzleme kodunu kurmak için e-posta adresinizi onaylayın — <a href="/settings/account">Hesap ayarları</a>.</p>`
      : `<p class="empty">İzleme kodunu sitenizin <code>&lt;head&gt;</code> bölümüne ekleyin; <code>data-site-token</code> yerine aşağıdaki site anahtarını yazın:</p>
<p><code>&lt;script src="${e(input.embedSrc ?? "/embed.js")}" data-site-token="…"&gt;&lt;/script&gt;</code></p>`;

  return panelPage(
    input.clientName,
    `<h1>${logo}${e(input.clientName)}</h1>
${quotaWarning}
${siteWarning}
<h2 id="izleme-kodu">Siteler</h2>
${installSection}
<div class="table-scroll">
<table>
<tr><th>Site</th><th>Site anahtarı</th><th class="num">Rapor</th></tr>
${rows}
</table>
</div>
<form method="post" action="${e(input.clientHref)}/sites" id="yeni-site">
  <input name="url" type="url" placeholder="https://musteri-sitesi.com" required>
  <button type="submit">Site ekle</button>
</form>
<details class="advanced">
<summary>Marka (beyaz etiket — gelişmiş)</summary>
<form method="post" action="${e(input.clientHref)}/branding">
  <input name="brandColor" placeholder="#rrggbb" pattern="#[0-9a-fA-F]{6}" value="">
  <input name="brandLogoUrl" type="url" placeholder="https://musteri.com/logo.png">
  <button type="submit">Markayı kaydet</button>
</form>
</details>
<h2>Tehlikeli Bölge</h2>
<p class="empty">Silmek kalıcıdır: müşterinin tüm siteleri, taramaları ve <strong>rıza kanıt zinciri</strong> birlikte silinir.</p>
<form method="post" action="${e(input.clientHref)}/delete">
  <button type="submit" class="danger">Müşteriyi kalıcı sil</button>
</form>`,
    input.accent,
    "clients",
    input.setup,
  );
}

export function renderAuditPage(input: {
  entries: Array<{ id: string; action: string; detail: Record<string, unknown>; createdAt: string }>;
  setup?: SetupProgress | undefined;
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
<div class="table-scroll">
<table>
<tr><th>Zaman</th><th>Eylem</th><th>Detay</th></tr>
${rows}
</table>
</div>`,
    undefined,
    "audit",
    input.setup,
  );
}

export function renderApiKeysPage(input: {
  keys: Array<{ id: string; name: string; prefix: string; revokedAt?: string | undefined; lastUsedAt?: string | undefined }>;
  /** Yeni oluşturulan anahtarın düz değeri — yalnızca bu render'da gösterilir. */
  newKey?: string | undefined;
  setup?: SetupProgress | undefined;
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
<div class="table-scroll">
<table>
<tr><th>Ad</th><th>Ön ek</th><th>Son kullanım</th><th>İşlem</th></tr>
${rows}
</table>
</div>
<form method="post" action="/settings/api-keys">
  <input name="name" placeholder="Anahtar adı (örn. CI, entegrasyon)" required>
  <button type="submit">Anahtar oluştur</button>
</form>
<h2>Dokümantasyon</h2>
<p><a href="/api/docs">Headless API dokümantasyonu →</a></p>`,
    undefined,
    "api-keys",
    input.setup,
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
  <input name="password" type="password" placeholder="Şifre" minlength="8" maxlength="128" required>
  <button type="submit">Giriş yap</button>
</form>
<p class="empty"><a href="/forgot-password">Şifreni mi unuttun?</a></p>
<p class="empty">Hesabın yok mu? <a href="/register">Ajansını kaydet</a></p>
<p class="empty"><a href="/kullanim-sartlari">Kullanım şartları</a> · <a href="/gizlilik">Gizlilik</a> · <a href="/cerez-politikasi">Çerez politikası</a></p>`,
  );
}

export function renderRegisterPage(options: { errorKind?: RegisterErrorKind } = {}): string {
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
<p class="empty">Zaten hesabın var mı? <a href="/login">Giriş yap</a></p>
<p class="empty"><a href="/kullanim-sartlari">Kullanım şartları</a> · <a href="/gizlilik">Gizlilik</a> · <a href="/cerez-politikasi">Çerez politikası</a></p>`,
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

/** GET bağlantısı token'ı tüketmez: posta tarayıcıları bağlantıyı ön okuyunca token yanmasın. */
export function renderVerifyEmailConfirmPage(token: string): string {
  return panelPage(
    "E-posta Doğrulama",
    `<h1>E-posta Doğrulama</h1>
<p>E-posta adresinizi doğrulamak için onaylayın. Bağlantı sizin tarafınızdan açılmadıysa bu sayfayı kapatın.</p>
<form method="post" action="/verify-email">
  <input type="hidden" name="token" value="${escapeHtml(token)}">
  <button type="submit">E-posta adresimi doğrula</button>
</form>`,
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
  setup?: SetupProgress | undefined;
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
    input.setup,
  );
}

function operatorNav(active: "contacts" | "tenants" | "plan-requests"): string {
  const link = (href: string, label: string, key: string) =>
    `<a href="${href}"${key === active ? ' aria-current="page"' : ""}>${label}</a>`;
  return `<nav class="topnav" aria-label="Operatör">
${link("/operator/contacts", "Gelen Kutusu", "contacts")}
${link("/operator/tenants", "Kiracılar", "tenants")}
${link("/operator/plan-requests", "Plan Talepleri", "plan-requests")}
<a href="/clients" class="nav-logout">Panele dön</a>
</nav>`;
}

export function renderOperatorContactsPage(input: { requests: ContactRequest[] }): string {
  const e = escapeHtml;
  const rows = input.requests.length
    ? input.requests
        .map((r) => {
          const status = r.handledAt
            ? '<span class="badge-ok">İşlendi</span>'
            : '<span class="badge-warn">Bekliyor</span>';
          const toggle = `<form method="post" action="/operator/contacts/${e(r.id)}/handled">
  <input type="hidden" name="handled" value="${r.handledAt ? "false" : "true"}">
  <button type="submit">${r.handledAt ? "Bekleyene al" : "İşlendi işaretle"}</button>
</form>`;
          return `<tr><td>${e(r.name)}<br><span class="empty">${e(r.email)}</span></td><td>${e(r.company ?? "—")}</td><td>${e(r.package ?? "—")}</td><td>${e(r.message)}</td><td>${e(r.createdAt)}</td><td>${status}<br>${toggle}</td></tr>`;
        })
        .join("\n")
    : '<tr><td colspan="6" class="empty">Henüz iletişim talebi yok.</td></tr>';

  return panelPage(
    "Operatör — Gelen Kutusu",
    `${operatorNav("contacts")}
<h1>İletişim Gelen Kutusu</h1>
<div class="table-scroll">
<table>
<tr><th>Ad / E-posta</th><th>Şirket</th><th>Paket</th><th>Mesaj</th><th>Tarih</th><th>Durum</th></tr>
${rows}
</table>
</div>`,
  );
}

export function renderOperatorTenantsPage(input: {
  tenants: Array<{ id: string; name: string; kind: TenantKind; package: ContactPackage; siteCount: number }>;
}): string {
  const e = escapeHtml;
  const rows = input.tenants.length
    ? input.tenants
        .map((t) => {
          const options = (Object.keys(PLAN_LABELS) as ContactPackage[])
            .map(
              (p) =>
                `<option value="${p}"${p === t.package ? " selected" : ""}>${e(PLAN_LABELS[p])}</option>`,
            )
            .join("");
          return `<tr><td>${e(t.name)}</td><td>${t.kind === "agency" ? "Ajans" : "Doğrudan"}</td><td class="num">${t.siteCount} site</td><td><form method="post" action="/operator/tenants/${e(t.id)}/package">
  <select name="package" aria-label="Paket">${options}</select>
  <button type="submit">Güncelle</button>
</form></td></tr>`;
        })
        .join("\n")
    : '<tr><td colspan="4" class="empty">Henüz kiracı yok.</td></tr>';

  return panelPage(
    "Operatör — Kiracılar",
    `${operatorNav("tenants")}
<h1>Kiracılar ve Paketler</h1>
<div class="table-scroll">
<table>
<tr><th>Kiracı</th><th>Tür</th><th>Kullanım</th><th>Paket</th></tr>
${rows}
</table>
</div>`,
  );
}

export function renderPlanPage(input: {
  package: ContactPackage;
  trial: "none" | "active" | "expired";
  trialDaysLeft: number;
  used: number;
  limit: number | null;
  clients: Array<{ name: string; siteCount: number }>;
  pendingTo?: ContactPackage | undefined;
  notice?: "requested" | undefined;
  errorKind?: "pending" | "same" | undefined;
  lastDecision?: "approved" | "rejected" | undefined;
  setup?: SetupProgress | undefined;
}): string {
  const e = escapeHtml;
  const trialBanner =
    input.trial === "active"
      ? `<p class="badge-ok">Deneme sürüyor — ${input.trialDaysLeft} gün kaldı.</p>`
      : input.trial === "expired"
        ? `<p class="badge-warn">Deneme sona erdi — kota Starter'a düştü. Yeni site için plan geçişi isteyin.</p>`
        : "";
  const notice =
    input.notice === "requested"
      ? '<p class="badge-ok">Geçiş talebiniz operatöre iletildi.</p>'
      : "";
  const error =
    input.errorKind === "pending"
      ? '<p class="badge-warn">Zaten bekleyen bir geçiş talebiniz var.</p>'
      : input.errorKind === "same"
        ? '<p class="badge-warn">Zaten bu pakettesiniz.</p>'
        : "";
  const lastDecision =
    input.lastDecision === "approved"
      ? '<p class="badge-ok">Son geçiş talebiniz onaylandı.</p>'
      : input.lastDecision === "rejected"
        ? '<p class="badge-warn">Son geçiş talebiniz reddedildi.</p>'
        : "";
  const pendingNote = input.pendingTo
    ? `<p class="empty">Operatör onayı bekleyen talep: <strong>${e(PLAN_LABELS[input.pendingTo])}</strong></p>`
    : "";

  const usage =
    input.limit === null
      ? `${input.used} site (sınırsız)`
      : `${input.used}/${input.limit} site`;

  const clientRows = input.clients.length
    ? input.clients
        .map((c) => `<tr><td>${e(c.name)}</td><td class="num">${c.siteCount}</td></tr>`)
        .join("\n")
    : '<tr><td colspan="2" class="empty">Henüz müşteri yok.</td></tr>';

  const planCards = (Object.keys(PLAN_LABELS) as ContactPackage[])
    .map((p) => {
      const limitText = PLAN_LIMITS[p] === null ? "sınırsız site" : `${PLAN_LIMITS[p]} site`;
      if (p === input.package) {
        return `<li><strong>${e(PLAN_LABELS[p])}</strong> — ${limitText} <span class="badge-ok">Mevcut</span></li>`;
      }
      const disabled = input.pendingTo ? " disabled" : "";
      return `<li><form method="post" action="/settings/plan">
  <input type="hidden" name="package" value="${p}">
  <button type="submit"${disabled}>${e(PLAN_LABELS[p])} — ${limitText} · Geçiş iste</button>
</form></li>`;
    })
    .join("\n");

  return panelPage(
    "Plan ve Kullanım",
    `<h1>Plan ve Kullanım</h1>
${trialBanner}
${notice}
${error}
${lastDecision}
${pendingNote}
<p>Paket: <strong>${e(PLAN_LABELS[input.package])}</strong> — ${usage}</p>
<h2>Müşteri kırılımı</h2>
<div class="table-scroll">
<table>
<tr><th>Müşteri</th><th>Site</th></tr>
${clientRows}
</table>
</div>
<h2>Plan geçişi</h2>
<p class="empty">Geçiş talebi operatör onayına düşer; ödeme adımı henüz yok.</p>
<ul class="plan-list">
${planCards}
</ul>`,
    undefined,
    "plan",
    input.setup,
  );
}

export function renderOperatorPlanRequestsPage(input: {
  requests: Array<{
    id: string;
    tenantName: string;
    fromPackage: ContactPackage;
    toPackage: ContactPackage;
    status: "pending" | "approved" | "rejected";
    createdAt: string;
  }>;
}): string {
  const e = escapeHtml;
  const rows = input.requests.length
    ? input.requests
        .map((r) => {
          const badge =
            r.status === "approved"
              ? '<span class="badge-ok">Onaylandı</span>'
              : r.status === "rejected"
                ? '<span class="badge-warn">Reddedildi</span>'
                : '<span class="badge-warn">Bekliyor</span>';
          const actions =
            r.status === "pending"
              ? `<form method="post" action="/operator/plan-requests/${e(r.id)}/decide">
  <input type="hidden" name="decision" value="approved">
  <button type="submit">Onayla</button>
</form>
<form method="post" action="/operator/plan-requests/${e(r.id)}/decide">
  <input type="hidden" name="decision" value="rejected">
  <button type="submit">Reddet</button>
</form>`
              : "";
          return `<tr><td>${e(r.tenantName)}</td><td>${e(PLAN_LABELS[r.fromPackage])} → ${e(PLAN_LABELS[r.toPackage])}</td><td>${e(r.createdAt)}</td><td>${badge}</td><td>${actions}</td></tr>`;
        })
        .join("\n")
    : '<tr><td colspan="5" class="empty">Henüz plan talebi yok.</td></tr>';

  return panelPage(
    "Operatör — Plan Talepleri",
    `${operatorNav("plan-requests")}
<h1>Plan Geçiş Talepleri</h1>
<div class="table-scroll">
<table>
<tr><th>Kiracı</th><th>Geçiş</th><th>Tarih</th><th>Durum</th><th>İşlem</th></tr>
${rows}
</table>
</div>`,
  );
}
