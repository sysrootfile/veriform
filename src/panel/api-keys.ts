import { createHash, randomBytes } from "node:crypto";
import type { PanelStore } from "./store.js";

/**
 * Headless API anahtarları — GitHub deseni: yüksek entropili düz anahtar
 * yalnızca oluşturma anında gösterilir, depoda yalnızca SHA-256 hash'i tutulur
 * (API anahtarları yüksek entropili olduğundan yavaş KDF gerekmez).
 */

export interface ApiKeySecret {
  id: string;
  /** Düz anahtar — yalnızca bu yanıtla bir kez görünür. */
  key: string;
  /** Kullanıcıya gösterilecek ön ek (ilk 12 karakter). */
  prefix: string;
}

export interface ApiKeyRecord {
  id: string;
  name: string;
  prefix: string;
  revokedAt?: string | undefined;
  lastUsedAt?: string | undefined;
  createdAt: string;
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

function generateApiKey(): string {
  return `vfk_${randomBytes(32).toString("base64url")}`;
}

export async function createApiKey(
  store: PanelStore,
  tenantId: string,
  input: { name: string },
): Promise<ApiKeySecret> {
  const key = generateApiKey();
  const prefix = key.slice(0, 12);
  const record = await store.saveApiKey(tenantId, {
    name: input.name,
    prefix,
    keyHash: hashApiKey(key),
  });
  return { id: record.id, key, prefix };
}
