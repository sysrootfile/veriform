import { daysLeft } from "./deadline.js";
import type { DsarRequest, DsarStatus, DsarType } from "./types.js";

/**
 * DSAR sayfa renderer'ları: site sahiplerinin gömülebilir başvuru formu
 * (kamu) + paneldeki takip listesi (oturumlu). Sayfa kabuğu panel render
 * katmanıyla aynı desen: saf fonksiyon, tüm girdi HTML'e kaçırılır.
 */

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export const DSAR_TYPE_LABELS: Record<DsarType, string> = {
  bilgi: "Bilgi talebi (m.11/1-4)",
  duzeltme: "Düzeltilmesini isteme (m.11/5)",
  silme: "Silinmesini/yok edilmesini isteme (m.11/6)",
  "aktarim-bildirimi": "3. kişilere bildirim (m.11/7)",
  itiraz: "Otomatik analize itiraz (m.11/8)",
  "zarar-giderimi": "Zararın giderilmesi (m.11/9)",
};

const STATUS_LABELS: Record<DsarStatus, string> = {
  new: "Yeni",
  "in-review": "İncelemede",
  completed: "Tamamlandı",
  rejected: "Reddedildi",
};

const STYLE = `
  body { font-family: system-ui, sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; }
  table { width: 100%; border-collapse: collapse; margin: .5rem 0 1rem; }
  td, th { border-bottom: 1px solid #eee; padding: .45rem .5rem; text-align: left; font-size: .92rem; }
  .badge-warn { color: #b45309; background: #fdf2e3; padding: .2rem .55rem; border-radius: 999px; font-size: .82rem; font-weight: 600; }
  .badge-ok { color: #127a3d; background: #e8f5ee; padding: .2rem .55rem; border-radius: 999px; font-size: .82rem; font-weight: 600; }
  .empty { color: #777; }
  form { margin: 1rem 0; display: grid; gap: .5rem; max-width: 480px; }
  input, select, textarea, button { padding: .45rem .7rem; border: 1px solid #ccc; border-radius: 6px; font-size: .92rem; font-family: inherit; }
  button { background: #16161f; color: #fff; border: none; cursor: pointer; }
  code { background: #f4f4f5; padding: .1rem .35rem; border-radius: 4px; font-size: .8rem; }
`;

function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Veriform — ${escapeHtml(title)}</title>
<style>${STYLE}</style>
</head>
<body>
${body}
</body>
</html>`;
}

export function renderDsarFormPage(input: {
  siteUrl: string;
  formAction: string;
  success?: { deadlineAt: string } | undefined;
}): string {
  const e = escapeHtml;
  const typeOptions = Object.entries(DSAR_TYPE_LABELS)
    .map(([value, label]) => `<option value="${e(value)}">${e(label)}</option>`)
    .join("\n");

  const body = input.success
    ? `<h1>Başvurunuz alındı</h1>
<p class="badge-ok">Yanıt süresi: en geç ${e(input.success.deadlineAt)} (KVKK m.13 — 30 gün)</p>
<p>Başvurunuzun durumunu veri sorumludan takip edebilirsiniz.</p>`
    : `<h1>Kişisel Veri Başvuru Formu</h1>
<p class="empty">Veri sorumlusu: ${e(input.siteUrl)} — KVKK m.11 kapsamındaki talebinizi buradan iletebilirsiniz.</p>
<form method="post" action="${e(input.formAction)}">
  <select name="type" required>${typeOptions}</select>
  <input name="subjectName" placeholder="Ad Soyad" required>
  <input name="subjectEmail" type="email" placeholder="E-posta" required>
  <textarea name="message" rows="4" placeholder="Talebinizle ilgili detaylar (isteğe bağlı)"></textarea>
  <button type="submit">Başvuruyu gönder</button>
</form>
<p class="empty">Kimlik doğrulaması veri sorumlusu tarafından yapılabilir; talebinizi değerlendirme süresi 30 gündür.</p>`;

  return page(input.success ? "Başvuru alındı" : "Kişisel Veri Başvurusu", body);
}

export function renderDsarPanelPage(input: {
  siteUrl: string;
  siteId: string;
  requests: DsarRequest[];
  now: string;
}): string {
  const e = escapeHtml;

  const rows = input.requests.length
    ? input.requests
        .map((r) => {
          const left = daysLeft(r.receivedAt, input.now);
          const overdue = left < 0 && r.status !== "completed" && r.status !== "rejected";
          const deadlineBadge = overdue
            ? '<span class="badge-warn">SÜRE GEÇTİ</span>'
            : `<span class="badge-ok">${left} gün</span>`;
          return `<tr>
<td>${e(r.subjectName)}<br><code>${e(r.subjectEmail)}</code></td>
<td>${e(DSAR_TYPE_LABELS[r.type] ?? r.type)}</td>
<td>${e(STATUS_LABELS[r.status])}</td>
<td>${deadlineBadge}</td>
<td>
  <form method="post" action="/sites/${e(input.siteId)}/dsar/${e(r.id)}">
    <select name="status">
      <option value="new">Yeni</option>
      <option value="in-review">İncelemede</option>
      <option value="completed">Tamamlandı</option>
      <option value="rejected">Reddedildi</option>
    </select>
    <input name="responseNote" placeholder="Yanıt notu">
    <label><input type="checkbox" name="extend" value="1"> +30 gün uzat</label>
    <button type="submit">Güncelle</button>
  </form>
</td>
</tr>`;
        })
        .join("\n")
    : '<tr><td colspan="5" class="empty">Henüz veri sahibi başvurusu yok — ziyaretçiler sitenin başvuru formundan gönderir; gelen taleplerin 30 günlük yanıt süresini burada izlersiniz.</td></tr>';

  return page(
    `DSAR — ${input.siteUrl}`,
    `<h1>Veri Sahibi Başvuruları</h1>
<p class="empty">${e(input.siteUrl)} · KVKK m.13 yanıt süresi: 30 gün</p>
<table>
<tr><th>Başvuran</th><th>Talep</th><th>Durum</th><th>Süre</th><th>İşlem</th></tr>
${rows}
</table>`,
  );
}
