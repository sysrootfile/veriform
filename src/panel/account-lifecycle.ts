import { createHash, randomBytes } from "node:crypto";
import { hashPassword, verifyPassword } from "./auth.js";
import type { EmailSender } from "./mailer.js";
import type { PanelStore } from "./store.js";
import type { AccountTokenPurpose, PanelUser } from "./types.js";

/**
 * Hesap yaşam döngüsü — e-posta doğrulama, şifre sıfırlama/değiştirme, hesap silme.
 * Token'lar düz metin saklanmaz (sha256), tek kullanımlık ve amaç-izoleli.
 */

const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;
const INVALID_LINK = "bağlantı geçersiz veya süresi dolmuş";

export function hashAccountToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function escapeText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function issueToken(
  store: PanelStore,
  userId: string,
  purpose: AccountTokenPurpose,
  ttlMs: number,
): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await store.createAccountToken({
    userId,
    purpose,
    tokenHash: hashAccountToken(token),
    expiresAt: new Date(Date.now() + ttlMs).toISOString(),
  });
  return token;
}

function linkEmail(subject: string, intro: string, link: string, validity: string): {
  subject: string;
  text: string;
  html: string;
} {
  return {
    subject,
    text: `${intro}\n\n${link}\n\nBağlantı ${validity} geçerlidir. Bu isteği siz yapmadıysanız bu e-postayı yok sayın.`,
    html: `<p>${escapeText(intro)}</p><p><a href="${escapeText(link)}">${escapeText(link)}</a></p><p>Bağlantı ${escapeText(validity)} geçerlidir. Bu isteği siz yapmadıysanız bu e-postayı yok sayın.</p>`,
  };
}

export async function issueEmailVerification(
  store: PanelStore,
  mailer: EmailSender,
  user: Pick<PanelUser, "id" | "email">,
  baseUrl: string,
): Promise<void> {
  const token = await issueToken(store, user.id, "verify-email", VERIFY_TTL_MS);
  const link = `${baseUrl}/verify-email?token=${token}`;
  await mailer.send({
    to: user.email,
    ...linkEmail(
      "Veriform — e-posta adresinizi doğrulayın",
      "Veriform hesabınızın e-posta adresini doğrulamak için aşağıdaki bağlantıya tıklayın:",
      link,
      "24 saat",
    ),
  });
}

export async function verifyEmail(store: PanelStore, token: string): Promise<void> {
  const consumed = await store.consumeAccountToken(hashAccountToken(token), "verify-email");
  if (!consumed) throw new Error(INVALID_LINK);
  await store.setUserEmailVerified(consumed.userId);
}

export async function requestPasswordReset(
  store: PanelStore,
  mailer: EmailSender,
  email: string,
  baseUrl: string,
): Promise<void> {
  const user = await store.findUserByEmail(email);
  if (!user) return;
  const token = await issueToken(store, user.id, "reset-password", RESET_TTL_MS);
  const link = `${baseUrl}/reset-password?token=${token}`;
  await mailer.send({
    to: user.email,
    ...linkEmail(
      "Veriform — şifre sıfırlama",
      "Veriform hesabınızın şifresini sıfırlamak için aşağıdaki bağlantıya tıklayın:",
      link,
      "1 saat",
    ),
  });
}

export async function resetPassword(store: PanelStore, token: string, newPassword: string): Promise<void> {
  if (newPassword.length < 8) throw new Error("şifre en az 8 karakter olmalı");
  const consumed = await store.consumeAccountToken(hashAccountToken(token), "reset-password");
  if (!consumed) throw new Error(INVALID_LINK);
  await store.updateUserPassword(consumed.userId, await hashPassword(newPassword));
}

export async function changePassword(
  store: PanelStore,
  tenantId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = await store.findUserByTenant(tenantId);
  if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
    throw new Error("mevcut şifre hatalı");
  }
  if (newPassword.length < 8) throw new Error("şifre en az 8 karakter olmalı");
  await store.updateUserPassword(user.id, await hashPassword(newPassword));
}

export async function deleteAccount(store: PanelStore, tenantId: string): Promise<void> {
  await store.deleteTenant(tenantId);
}