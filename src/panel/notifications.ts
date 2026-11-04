import type { ScanDiff } from "../scanner/diff.js";

/**
 * Değişiklik uyarısı e-postasının saf üreticisi.
 * Değişiklik yoksa null döner — boş mail gönderilmez (kullanıcı güveni).
 */

export interface ChangeAlertInput {
  siteUrl: string;
  diff: ScanDiff;
  scannedAt: string;
  panelUrl?: string | undefined;
}

export interface ChangeAlertEmail {
  subject: string;
  text: string;
  html: string;
}

export function shouldNotifyChange(diff: ScanDiff): boolean {
  return (
    diff.newForms.length > 0 ||
    diff.removedFormRefs.length > 0 ||
    diff.newCookieCategories.length > 0
  );
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildChangeAlertEmail(input: ChangeAlertInput): ChangeAlertEmail | null {
  if (!shouldNotifyChange(input.diff)) return null;

  const { diff } = input;
  const changeCount =
    diff.newForms.length + diff.removedFormRefs.length + diff.newCookieCategories.length;
  const subject = `Veriform uyarısı: ${input.siteUrl} — ${changeCount} değişiklik tespit edildi`;

  const lines: string[] = [];
  for (const nf of diff.newForms) {
    lines.push(
      `• Yeni form/alan (${nf.formRef}): ${nf.newFieldNames.join(", ")}`,
    );
  }
  for (const ref of diff.removedFormRefs) {
    lines.push(`• Kaldırılan form: ${ref}`);
  }
  for (const category of diff.newCookieCategories) {
    lines.push(`• Yeni çerez kategorisi: ${category}`);
  }

  const panelLine = input.panelUrl
    ? `\nPanele gitmek için: ${input.panelUrl}`
    : "";

  const text = [
    `Veriform ${input.siteUrl} taraması (${input.scannedAt}) ${changeCount} değişiklik tespit etti:`,
    "",
    ...lines,
    "",
    "Değişiklikler bir sonraki raporda otomatik olarak yer alır.",
    panelLine,
  ].join("\n");

  const htmlLines = [
    ...diff.newForms.map(
      (nf) =>
        `<li>Yeni form/alan <strong>${escapeHtml(nf.formRef)}</strong>: ${escapeHtml(nf.newFieldNames.join(", "))}</li>`,
    ),
    ...diff.removedFormRefs.map(
      (ref) => `<li>Kaldırılan form: <strong>${escapeHtml(ref)}</strong></li>`,
    ),
    ...diff.newCookieCategories.map(
      (category) => `<li>Yeni çerez kategorisi: <strong>${escapeHtml(category)}</strong></li>`,
    ),
  ];

  const html = `<div style="font-family:system-ui,sans-serif;max-width:600px">
<h2 style="color:#16161f">Veriform değişiklik uyarısı</h2>
<p><strong>${escapeHtml(input.siteUrl)}</strong> taraması (${escapeHtml(input.scannedAt)})
${changeCount} değişiklik tespit etti:</p>
<ul>${htmlLines.join("\n")}</ul>
<p style="color:#777;font-size:.85rem">Değişiklikler bir sonraki raporda otomatik olarak yer alır.${escapeHtml(panelLine)}</p>
</div>`;

  return { subject, text, html };
}
