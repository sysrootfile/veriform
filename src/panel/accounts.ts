import { hashPassword, passwordProblem, verifyPassword } from "./auth.js";
import { isContactPackage, TRIAL_DAYS } from "./plans.js";
import type { PanelStore } from "./store.js";
import type { PanelUser, Tenant, TenantKind } from "./types.js";

/**
 * Kiracı kaydı ve giriş akışı — HTTP handler'ların çağıracağı uygulama sözleşmesi.
 * Hata mesajları varlık sızdırmaz: bilinmeyen e-posta ile yanlış şifre aynı mesajı verir.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function registerTenant(
  store: PanelStore,
  input: { name: string; kind: TenantKind; email: string; password: string; package?: unknown },
): Promise<{ tenant: Tenant; user: PanelUser }> {
  const email = normalizeEmail(input.email);
  const name = input.name.trim();
  if (name.length < 2 || name.length > 120) throw new Error("ajans adı en az 2 karakter olmalı");
  if (email.length > 254 || !EMAIL_RE.test(email)) throw new Error("geçerli bir e-posta adresi girin");
  const problem = passwordProblem(input.password);
  if (problem) throw new Error(problem);

  if (await store.findUserByEmail(email)) {
    throw new Error("e-posta zaten kayıtlı");
  }
  const tenant = await store.createTenant({
    name,
    kind: input.kind,
    package: isContactPackage(input.package) ? input.package : "starter",
    trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 86400000).toISOString(),
  });
  const user = await store.createUser({
    tenantId: tenant.id,
    email,
    passwordHash: await hashPassword(input.password),
  });
  return { tenant, user };
}

export async function login(store: PanelStore, input: { email: string; password: string }): Promise<string> {
  const user = await store.findUserByEmail(normalizeEmail(input.email));
  if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
    throw new Error("e-posta veya şifre hatalı");
  }
  return user.tenantId;
}
