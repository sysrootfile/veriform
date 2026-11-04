import { describe, expect, it } from "vitest";
import { createInMemoryPanelStore } from "../panel/store.js";
import { createApiKey, hashApiKey, type ApiKeySecret } from "./api-keys.js";

describe("hashApiKey", () => {
  it("aynı anahtar aynı hash'i üretir", () => {
    expect(hashApiKey("vfk_abc")).toBe(hashApiKey("vfk_abc"));
    expect(hashApiKey("vfk_abc")).not.toBe(hashApiKey("vfk_abd"));
  });

  it("64 hex SHA-256 üretir", () => {
    expect(hashApiKey("vfk_abc")).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("API anahtar deposu", () => {
  async function setup() {
    const store = createInMemoryPanelStore();
    const tenant = await store.createTenant({ name: "A", kind: "agency" });
    return { store, tenant };
  }

  it("anahtar oluşturur: düz değer bir kez döner, depoda yalnız hash kalır", async () => {
    const { store, tenant } = await setup();
    const secret: ApiKeySecret = await createApiKey(store, tenant.id, { name: "CI anahtarı" });
    expect(secret.key).toMatch(/^vfk_[0-9a-zA-Z_-]{43}$/);
    expect(secret.prefix).toBe(secret.key.slice(0, 12));
    const keys = await store.listApiKeys(tenant.id);
    expect(keys).toHaveLength(1);
    expect(keys[0]!.name).toBe("CI anahtarı");
    expect(keys[0]!.id).toBe(secret.id);
    expect(JSON.stringify(keys)).not.toContain(secret.key); // düz anahtar saklanmaz
  });

  it("anahtarla kiracıyı kimlikler; yanlış anahtar null", async () => {
    const { store, tenant } = await setup();
    const secret = await createApiKey(store, tenant.id, { name: "k" });
    const resolved = await store.findTenantByApiKey(secret.key);
    expect(resolved?.tenantId).toBe(tenant.id);
    expect(await store.findTenantByApiKey("vfk_yanlis")).toBeNull();
  });

  it("anahtar listelenebilir ve iptal edilebilir", async () => {
    const { store, tenant } = await setup();
    const secret = await createApiKey(store, tenant.id, { name: "k1" });
    await store.revokeApiKey(tenant.id, secret.id);
    const keys = await store.listApiKeys(tenant.id);
    expect(keys[0]!.revokedAt).toBeDefined();
    expect(await store.findTenantByApiKey(secret.key)).toBeNull();
  });

  it("son kullanım zamanı güncellenir", async () => {
    const { store, tenant } = await setup();
    const secret = await createApiKey(store, tenant.id, { name: "k" });
    await store.touchApiKey(secret.key);
    const keys = await store.listApiKeys(tenant.id);
    expect(keys[0]!.lastUsedAt).toBeDefined();
  });
});
