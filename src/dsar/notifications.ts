import { DSAR_TYPE_LABELS } from "./render.js";
import type { DsarType } from "./types.js";

/**
 * DSAR başvuru bildirimi e-postasının saf üreticisi —
 * veri sahibi kamu formundan başvurduğunda veri sorumlusuna gönderilir.
 * 30 günlük yasal süre (KVKK m.13) konu satırında ve gövdede vurgulanır.
 */

export interface DsarNotificationInput {
  siteUrl: string;
  subjectName: string;
  type: DsarType;
  deadlineAt: string;
}

export interface DsarNotificationEmail {
  subject: string;
  text: string;
  html: string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildDsarNotificationEmail(
  input: DsarNotificationInput,
): DsarNotificationEmail {
  const typeLabel = DSAR_TYPE_LABELS[input.type] ?? input.type;
  const deadlineDate = input.deadlineAt.slice(0, 10);
  const subject = `Veriform: Yeni veri sahibi başvurusu — ${input.subjectName} (${typeLabel})`;

  const text = [
    `${input.siteUrl} sitesine yeni bir veri sahibi başvurusu geldi:`,
    "",
    `Başvuran: ${input.subjectName}`,
    `Talep: ${typeLabel}`,
    `Yanıt son tarihi: ${deadlineDate} (KVKK m.13 — 30 gün)`,
    "",
    "Panele gidip başvuruyu değerlendirmeye alın.",
  ].join("\n");

  const html = `<div style="font-family:system-ui,sans-serif;max-width:600px">
<h2 style="color:#16161f">Yeni veri sahibi başvurusu</h2>
<p><strong>${escapeHtml(input.subjectName)}</strong>,
<strong>${escapeHtml(input.siteUrl)}</strong> sitesi hakkında
<strong>${escapeHtml(typeLabel)}</strong> talebinde bulundu.</p>
<p style="color:#b45309;font-weight:600">Yanıt son tarihi: ${escapeHtml(deadlineDate)} (KVKK m.13 — 30 gün)</p>
<p style="color:#777;font-size:.85rem">Panele gidip başvuruyu değerlendirmeye alın.</p>
</div>`;

  return { subject, text, html };
}
