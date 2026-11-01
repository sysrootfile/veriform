import { hashPassword, verifyPassword } from "./auth.js";
import type { PanelStore } from "./store.js";
import type { Tenant, TenantKind } from "./types.js";

/**
 * Kiracı kaydı ve giriş akışı — HTTP handler'ların çağıracağı uygulama sözleşmesi.
 * Hata mesajları varlık sızdırmaz: bilinmeyen e-posta ile yanlış şifre aynı mesajı verir.
 */

export async function registerTenant(
  store: PanelStore,
  input: { name: string; kind: TenantKind; email: string; password: string },
): Promise<{ tenant: Tenant }> {
  if (await store.findUserByEmail(input.email)) {
    throw new Error(`e-posta zaten kayıtlı: ${input.email}`);
  }
  const tenant = await store.createTenant({ name: input.name, kind: input.kind });
  await store.createUser({
    tenantId: tenant.id,
    email: input.email,
    passwordHash: await hashPassword(input.password),
  });
  return { tenant };
}

export async function login(store: PanelStore, input: { email: string; password: string }): Promise<string> {
  const user = await store.findUserByEmail(input.email);
  if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
    throw new Error("e-posta veya şifre hatalı");
  }
  return user.tenantId;
}
