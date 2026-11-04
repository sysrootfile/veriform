import { createPanelService } from "./service.js";
import type { PanelStore } from "./store.js";

/**
 * Headless /api/v1 yüzeyi — X-API-Key kimlikli, JSON istek/yanıt.
 * Rota glue'u (server.ts) bu işleyiciye delege eder; burası tam testlidir.
 * Kimliklendirme üç katmandan ayrıdır: panel=oturum çerezi, site=machine token,
 * headless API=X-API-Key (kiracı anahtarı).
 */

export interface ApiRequestInput {
  method: "GET" | "POST";
  path: string;
  headers: Record<string, string | undefined>;
  body: unknown;
}

export interface ApiResponse {
  status: number;
  json: unknown;
}

function json(status: number, data: unknown): ApiResponse {
  return { status, json: data };
}

export async function handleApiRequest(
  store: PanelStore,
  input: ApiRequestInput,
): Promise<ApiResponse> {
  const key = input.headers["x-api-key"] ?? "";
  if (!key) return json(401, { error: "geçersiz API anahtarı" });

  const auth = await store.findTenantByApiKey(key);
  if (!auth) return json(401, { error: "geçersiz API anahtarı" });
  await store.touchApiKey(key);

  const service = createPanelService(store, {
    tenantId: auth.tenantId,
    role: "owner",
  });
  const segments = input.path.replace(/^\/api\/v1\/?/, "").split("/").filter(Boolean);

  try {
    // GET /api/v1/me
    if (input.method === "GET" && segments[0] === "me" && segments.length === 1) {
      const tenant = await store.getTenant(auth.tenantId);
      return json(200, {
        tenantId: auth.tenantId,
        name: tenant?.name ?? "Bilinmeyen",
        kind: tenant?.kind ?? "direct",
      });
    }

    // /api/v1/clients
    if (segments[0] === "clients") {
      if (input.method === "GET" && segments.length === 1) {
        return json(200, await service.getClientList());
      }
      if (input.method === "POST" && segments.length === 1) {
        const body = input.body as { name?: unknown };
        if (typeof body?.name !== "string" || !body.name) {
          return json(400, { error: "name zorunlu" });
        }
        const client = await service.addClient(body.name);
        return json(201, client);
      }
      const clientId = segments[1];
      if (clientId && segments.length === 2 && input.method === "GET") {
        const sites = await service.getClientSites(clientId);
        return json(200, sites);
      }
      if (clientId && segments[2] === "sites") {
        if (input.method === "GET" && segments.length === 3) {
          return json(200, await service.getClientSites(clientId));
        }
        if (input.method === "POST" && segments.length === 3) {
          const body = input.body as { url?: unknown };
          if (typeof body?.url !== "string" || !body.url) {
            return json(400, { error: "url zorunlu" });
          }
          const site = await service.addSite(clientId, body.url);
          return json(201, {
            id: site.id,
            url: site.url,
            ingestToken: site.ingestToken,
            createdAt: site.createdAt,
          });
        }
      }
    }

    // /api/v1/sites/:id/scans ve /report
    if (segments[0] === "sites" && segments[1]) {
      const siteId = segments[1];
      if (input.method === "GET" && segments[2] === "scans" && segments.length === 3) {
        return json(200, await service.getSiteScans(siteId));
      }
      if (input.method === "GET" && segments[2] === "report" && segments.length === 3) {
        const scans = await service.getSiteScans(siteId);
        const last = scans.at(-1);
        if (!last) return json(404, { error: "henüz tarama yok" });
        return json(200, last.report);
      }
    }

    return json(404, { error: "bilinmeyen API rotası" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "istek başarısız";
    if (message.includes("erişim reddedildi") || message.includes("bulunamadı")) {
      // varlık sızdırmaz: yok/başkasının kaydı aynı yanıt
      return json(403, { error: "erişim reddedildi" });
    }
    return json(400, { error: message });
  }
}
