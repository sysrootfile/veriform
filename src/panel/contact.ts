import type { EmailSender } from "./mailer.js";
import type { RateLimiter } from "./rate-limit.js";
import type { PanelStore } from "./store.js";
import type { ContactPackage, ContactRequest } from "./types.js";

/**
 * Landing iletişim formu — saf doğrulama + mail üreticisi + submit işleyici.
 * Talep operatöre gider (kiracı değil); mail hatası talebi düşürmez.
 */

export const CONTACT_PACKAGES: readonly ContactPackage[] = ["starter", "pro", "ultimate"];

export interface ContactInput {
  name: string;
  email: string;
  company?: string | undefined;
  package?: ContactPackage | undefined;
  message: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ContactValidation =
  | { ok: true; value: ContactInput }
  | { ok: false };

export function validateContactInput(form: URLSearchParams): ContactValidation {
  const name = (form.get("name") ?? "").trim();
  const email = (form.get("email") ?? "").trim();
  const company = (form.get("company") ?? "").trim();
  const pkg = (form.get("package") ?? "").trim();
  const message = (form.get("message") ?? "").trim();

  if (name.length < 2 || name.length > 120) return { ok: false };
  if (email.length > 254 || !EMAIL_RE.test(email)) return { ok: false };
  if (company.length > 120) return { ok: false };
  if (pkg && !CONTACT_PACKAGES.includes(pkg as ContactPackage)) return { ok: false };
  if (message.length < 10 || message.length > 2000) return { ok: false };

  return {
    ok: true,
    value: {
      name,
      email,
      ...(company ? { company } : {}),
      ...(pkg ? { package: pkg as ContactPackage } : {}),
      message,
    },
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildContactEmail(req: ContactRequest): { subject: string; text: string; html: string } {
  const subject = `Veriform iletişim talebi — ${req.name}${req.package ? ` (${req.package})` : ""}`;
  const text = [
    `Yeni iletişim talebi (${req.createdAt}):`,
    `Ad: ${req.name}`,
    `E-posta: ${req.email}`,
    ...(req.company ? [`Şirket: ${req.company}`] : []),
    ...(req.package ? [`Paket ilgisi: ${req.package}`] : []),
    "",
    req.message,
  ].join("\n");
  const html = `<div style="font-family:system-ui,sans-serif;max-width:600px">
<h2 style="color:#16161f">Yeni iletişim talebi</h2>
<p><strong>${escapeHtml(req.name)}</strong> &lt;${escapeHtml(req.email)}&gt;${req.company ? ` — ${escapeHtml(req.company)}` : ""}</p>
${req.package ? `<p>Paket ilgisi: <strong>${escapeHtml(req.package)}</strong></p>` : ""}
<p>${escapeHtml(req.message)}</p>
<p style="color:#777;font-size:.85rem">${escapeHtml(req.createdAt)}</p>
</div>`;
  return { subject, text, html };
}

export interface ContactResult {
  status: number;
  location?: string | undefined;
}

export async function handleContactSubmit(deps: {
  form: URLSearchParams;
  store: Pick<PanelStore, "createContactRequest">;
  mailSender: EmailSender;
  operatorEmail: string;
  limiter: RateLimiter;
  ip: string;
}): Promise<ContactResult> {
  if (!deps.limiter.allow(deps.ip)) return { status: 429 };
  const parsed = validateContactInput(deps.form);
  if (!parsed.ok) return { status: 400 };

  const req = await deps.store.createContactRequest(parsed.value);
  try {
    await deps.mailSender.send({ to: deps.operatorEmail, ...buildContactEmail(req) });
  } catch {
    // Mail hatası talebi düşürmez — kayıt DB'de durur.
  }
  return { status: 303, location: "/?contact=ok#iletisim" };
}