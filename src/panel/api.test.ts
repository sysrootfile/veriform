import { describe, expect, it } from "vitest";
import { createInMemoryPanelStore, type PanelStore } from "../panel/store.js";
import { createApiKey } from "../panel/api-keys.js";
import { handleApiRequest } from "./api.js";

async function setup() {
  const store = createInMemoryPanelStore();
  const tenant = await store.createTenant({ name: "API Ajans", kind: "agency" });
  const secret = await createApiKey(store, tenant.id, { name: "test" });
  return { store, tenant, key: secret.key };
}

describe("handleApiRequest (headless /api/v1)", () => {
  it("me / kimlikli kiracı bilgisini döndürür", async () => {
    const { store, tenant, key } = await setup();
    const res = await handleApiRequest(store, {
      method: "GET",
      path: "/api/v1/me",
      headers: { "x-api-key": key },
      body: undefined,
    });
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ tenantId: tenant.id, name: "API Ajans" });
  });

  it("anahtarsız istek 401 döner (varlık sızdırmaz)", async () => {
    const { store } = await setup();
    const res = await handleApiRequest(store, {
      method: "GET",
      path: "/api/v1/clients",
      headers: {},
      body: undefined,
    });
    expect(res.status).toBe(401);
    expect(res.json).toEqual({ error: "geçersiz API anahtarı" });
  });

  it("clients listesi ve oluşturma çalışır", async () => {
    const { store, key } = await setup();
    const created = await handleApiRequest(store, {
      method: "POST",
      path: "/api/v1/clients",
      headers: { "x-api-key": key },
      body: { name: "Müşteri X" },
    });
    expect(created.status).toBe(201);
    const list = await handleApiRequest(store, {
      method: "GET",
      path: "/api/v1/clients",
      headers: { "x-api-key": key },
      body: undefined,
    });
    expect(list.status).toBe(200);
    expect(JSON.stringify(list.json)).toContain("Müşteri X");
  });

  it("site oluşturma ingest token'ını döndürür (programatik provizyon)", async () => {
    const { store, key } = await setup();
    const client = await handleApiRequest(store, {
      method: "POST",
      path: "/api/v1/clients",
      headers: { "x-api-key": key },
      body: { name: "M" },
    });
    const clientId = (client.json as { id: string }).id;
    const site = await handleApiRequest(store, {
      method: "POST",
      path: `/api/v1/clients/${clientId}/sites`,
      headers: { "x-api-key": key },
      body: { url: "https://api-site.com" },
    });
    expect(site.status).toBe(201);
    const body = site.json as { ingestToken: string; url: string };
    expect(body.ingestToken).toMatch(/^[0-9a-f]{64}$/);
    expect(body.url).toBe("https://api-site.com");
  });

  it("bilinmeyen rota 404, JSON gövdesi bozuksa 400", async () => {
    const { store, key } = await setup();
    const notFound = await handleApiRequest(store, {
      method: "GET",
      path: "/api/v1/yok",
      headers: { "x-api-key": key },
      body: undefined,
    });
    expect(notFound.status).toBe(404);
    const bad = await handleApiRequest(store, {
      method: "POST",
      path: "/api/v1/clients",
      headers: { "x-api-key": key },
      body: "bozuk-json{",
    });
    expect(bad.status).toBe(400);
  });

  it("starter kotası dolunca site oluşturma 403 döner (yükseltme mesajı)", async () => {
    const { store, key } = await setup();
    const client = await handleApiRequest(store, {
      method: "POST",
      path: "/api/v1/clients",
      headers: { "x-api-key": key },
      body: { name: "M" },
    });
    const clientId = (client.json as { id: string }).id;
    for (let i = 1; i <= 3; i++) {
      const ok = await handleApiRequest(store, {
        method: "POST",
        path: `/api/v1/clients/${clientId}/sites`,
        headers: { "x-api-key": key },
        body: { url: `https://api-s${i}.com` },
      });
      expect(ok.status).toBe(201);
    }
    const full = await handleApiRequest(store, {
      method: "POST",
      path: `/api/v1/clients/${clientId}/sites`,
      headers: { "x-api-key": key },
      body: { url: "https://api-s4.com" },
    });
    expect(full.status).toBe(403);
    expect((full.json as { error: string }).error).toContain("site kotası doldu");
    expect((full.json as { error: string }).error).toContain("yükseltme");
  });
});
