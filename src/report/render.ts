import type { FormInventoryReport } from "./types.js";

/**
 * PII haritası raporunu bağımsız HTML sayfasına render eder.
 * Dashboard önizlemesi, ajans demosu ve e-posta/PDF çıktılarının ortak
 * katmanıdır — saf fonksiyon, tüm rapor metinleri HTML'e kaçırılır.
 */

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export const CATEGORY_LABELS: Record<string, string> = {
  tckn: "TC Kimlik No",
  iban: "IBAN",
  card: "Kart Bilgisi",
  phone: "Telefon",
  email: "E-Posta",
  full_name: "Ad Soyad",
  birthdate: "Doğum Tarihi",
  address: "Adres",
  passport: "Pasaport",
  free_text: "Serbest Metin",
};

const label = (category: string): string => CATEGORY_LABELS[category] ?? category;

export const COOKIE_LABELS: Record<string, string> = {
  necessary: "Zorunlu",
  functional: "İşlevsel",
  analytics: "Analitik",
  marketing: "Pazarlama/Reklam",
  unknown: "Sınıflandırılamadı",
};

const RISK_LABELS: Record<string, string> = {
  "get-with-sensitive": "GET formunda hassas veri — URL sorgu sızıntısı riski",
  "cross-origin-target": "Farklı kaynağa (3. tarafa) veri gönderimi",
};

/** Taramadan gelen çerez envanteri — yapısal tip (scanner'a bağımlılık yok). */
export interface RenderCookie {
  name: string;
  domain: string;
  category: string;
}

export interface RenderOptions {
  scannedAt?: string;
  cookies?: ReadonlyArray<RenderCookie>;
}

export function renderReportHtml(
  report: FormInventoryReport,
  options: RenderOptions = {},
): string {
  const e = escapeHtml;
  const scannedAt = options.scannedAt
    ? `<p class="meta">Tarama zamanı: ${e(options.scannedAt)}</p>`
    : "";

  const categories = report.categoryCounts
    .map(
      (c) =>
        `<tr><td>${e(label(c.category))}</td><td class="num">${c.forms} form</td></tr>`,
    )
    .join("\n");

  const destinations = report.destinations
    .map(
      (d) =>
        `<tr><td>${e(d.origin)}</td><td class="num">${d.forms} form</td><td>${
          d.sameOrigin ? '<span class="ok">aynı kaynak</span>' : '<span class="warn">3. taraf</span>'
        }</td></tr>`,
    )
    .join("\n");

  const risks = report.riskFlags.length
    ? report.riskFlags
        .map(
          (r) =>
            `<li><strong>${e(RISK_LABELS[r.kind] ?? r.kind)}</strong> — ${e(r.detail)} <code>${e(r.formRef)}</code></li>`,
        )
        .join("\n")
    : "<li>Tespit edilen risk yok.</li>";

  const review = report.review.length
    ? report.review
        .map(
          (r) =>
            `<tr><td>${e(r.formRef)}</td><td>${e(r.fieldName ?? "—")}</td><td>${e(label(r.category))}</td><td class="num">${r.confidence}</td></tr>`,
        )
        .join("\n")
    : '<tr><td colspan="4">Onay bekleyen sınıflandırma yok.</td></tr>';

  // Rıza öncesi çerezler: tarama rıza vermeden gezindiği için zorunlu
  // olmayan her çerez kendiliğinden ihlal kanıtıdır. Zorunlular listelenmez.
  const scannedCookies = options.cookies ?? [];
  const violations = scannedCookies.filter((c) => c.category !== "necessary");
  const cookieSection = scannedCookies.length
    ? `
<h2>Rıza Öncesi Çerezler</h2>
<p class="meta">Tarama kullanıcı kararı alınmadan gezindi — aşağıdaki çerezler rıza alınmadan atıldı.</p>
<div class="cards">
  <div class="card"><b>${violations.length}</b> ihlal şüphesi</div>
  <div class="card"><b>${scannedCookies.length}</b> toplam çerez</div>
</div>
<table>${violations
        .map(
          (c) =>
            `<tr><td>${e(c.name)}</td><td>${e(c.domain)}</td><td>${e(COOKIE_LABELS[c.category] ?? c.category)}</td></tr>`,
        )
        .join("\n")}</table>`
    : "";

  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Veriform Raporu — ${e(report.siteOrigin)}</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 780px; margin: 2rem auto; padding: 0 1rem; color: #1a1a2e; }
  h1 { font-size: 1.4rem; } .meta { color: #666; font-size: .85rem; }
  .cards { display: flex; gap: 1rem; margin: 1rem 0; }
  .card { flex: 1; border: 1px solid #ddd; border-radius: 8px; padding: .8rem 1rem; }
  .card b { display: block; font-size: 1.6rem; }
  table { width: 100%; border-collapse: collapse; margin: .5rem 0 1.5rem; }
  td, th { border-bottom: 1px solid #eee; padding: .45rem .5rem; text-align: left; font-size: .92rem; }
  .num { text-align: right; }
  .ok { color: #127a3d; } .warn { color: #b45309; font-weight: 600; }
  code { background: #f4f4f5; padding: .1rem .35rem; border-radius: 4px; font-size: .8rem; }
  footer { color: #888; font-size: .8rem; border-top: 1px solid #eee; padding-top: .8rem; }
</style>
</head>
<body>
<h1>Veriform · Form Veri Envanteri</h1>
<p class="meta">${e(report.siteOrigin)}${scannedAt.slice(3)}</p>
<div class="cards">
  <div class="card"><b>${report.formCount}</b> form</div>
  <div class="card"><b>${report.fieldCount}</b> alan</div>
  <div class="card"><b>${report.riskFlags.length}</b> risk işareti</div>
  <div class="card"><b>${report.destinations.filter((d) => !d.sameOrigin).length}</b> 3. taraf hedef</div>
</div>
<h2>Toplanan Veri Kategorileri</h2>
<table>${categories || '<tr><td>Kategori bulunamadı.</td></tr>'}</table>
<h2>Veri Hedefleri</h2>
<table>${destinations || '<tr><td>Gözlemlenen hedef yok.</td></tr>'}</table>
${cookieSection}
<h2>Risk İşaretleri</h2>
<ul>${risks}</ul>
<h2>İnsan Onayı Bekleyen Sınıflandırmalar</h2>
<table>${review}</table>
<footer>Veriform v0 demo raporu — alan değerleri asla saklanmaz; yalnızca meta veri ve hedef origin+path kaydedilir.</footer>
</body>
</html>`;
}
