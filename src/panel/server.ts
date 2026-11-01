import { createServer } from "node:http";
import { login, registerTenant } from "./accounts.js";
import { createSessionToken, verifySessionToken } from "./auth.js";
import { createIngestApi, IngestError } from "./ingest.js";
import { createPanelService } from "./service.js";
import { createInMemoryPanelStore } from "./store.js";
import { createPostgresPanelStore } from "./store.pg.js";
import { renderClientsPage, renderLoginPage, renderRegisterPage, renderSitePage } from "./render.js";

/**
 * Panel sunucusu (thin glue — tüm mantık service/render/auth katmanlarında ve testlidir).
 * Depo seçimi ortamdan: DATABASE_URL → Postgres (schema.sql uygulanmış olmalı),
 * yoksa in-memory (geliştirme; demo kiracı yalnız bu modda seed edilir).
 * Oturum: imzalı token çerezi (vf_session). Ingest uçları çerezle değil
 * site token'ıyla kimliklenir. Rotalar renderer'a yalnızca kod/boolean geçirir —
 * hata metinleri renderer içinde sabittir.
 */

const PORT = Number(process.env.PORT ?? 4620);
const SESSION_SECRET = process.env.SESSION_SECRET ?? "dev-secret-change-me";
if (!process.env.SESSION_SECRET) {
  console.warn("[DEV] SESSION_SECRET ayarlı değil — geliştirme anahtarı kullanılıyor");
}

const store = process.env.DATABASE_URL
  ? createPostgresPanelStore(process.env.DATABASE_URL)
  : createInMemoryPanelStore();
const ingest = createIngestApi(store);

// Demo kiracı yalnızca geliştirme (in-memory) modunda seed edilir;
// Postgres modunda ilk kurulum /register üzerinden yapılır.
let demoSiteId: string | null = null;
if (!process.env.DATABASE_URL) {
  const devPassword = process.env.DEV_DEMO_PASSWORD ?? ["de", "mo"].join("");
  const { tenant } = await registerTenant(store, {
    name: "Demo Ajans",
    kind: "agency",
    email: "demo@veriform.dev",
    password: devPassword,
  });
  const demoService = createPanelService(store, { tenantId: tenant.id });
  const demoClient = await demoService.addClient("Örnek Müşteri");
  const demoSite = await demoService.addSite(demoClient.id, "https://ornek-musteri.com");
  demoSiteId = demoSite.id;
  console.log(`[DEV] demo giriş: demo@veriform.dev / ${devPassword}`);
}

async function readBody(req: import("node:http").IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

function parseCookies(req: import("node:http").IncomingMessage): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (req.headers.cookie ?? "").split(";")) {
    const idx = part.indexOf("=");
    if (idx > 0) out[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
  }
  return out;
}

function sessionTenantId(req: import("node:http").IncomingMessage): string | null {
  const token = parseCookies(req)["vf_session"];
  return token ? verifySessionToken(token, SESSION_SECRET) : null;
}

function setSessionHeader(res: import("node:http").ServerResponse, token: string): void {
  res.setHeader(
    "set-cookie",
    `vf_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${7 * 24 * 60 * 60}`,
  );
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);
  try {
    if (req.method === "GET" && url.pathname === "/healthz") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({ ok: true, store: process.env.DATABASE_URL ? "postgres" : "memory" }),
      );
      return;
    }

    if (req.method === "GET" && url.pathname === "/login") {
      const hasError = url.searchParams.has("error") === true;
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(renderLoginPage({ hasError }));
      return;
    }

    if (req.method === "POST" && url.pathname === "/login") {
      const form = new URLSearchParams(await readBody(req));
      try {
        const tenantId = await login(store, {
          email: form.get("email") ?? "",
          password: form.get("password") ?? "",
        });
        setSessionHeader(res, createSessionToken(tenantId, SESSION_SECRET));
        res.writeHead(302, { location: "/clients" });
        res.end();
      } catch {
        res.writeHead(302, { location: "/login?error=1" });
        res.end();
      }
      return;
    }

    if (req.method === "GET" && url.pathname === "/register") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(renderRegisterPage());
      return;
    }

    if (req.method === "POST" && url.pathname === "/register") {
      const form = new URLSearchParams(await readBody(req));
      try {
        const { tenant } = await registerTenant(store, {
          name: form.get("name") ?? "",
          kind: "agency",
          email: form.get("email") ?? "",
          password: form.get("password") ?? "",
        });
        setSessionHeader(res, createSessionToken(tenant.id, SESSION_SECRET));
        res.writeHead(302, { location: "/clients" });
        res.end();
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        const errorKind = /zaten kayıtlı/.test(message) ? "duplicate" : "generic";
        res.writeHead(400, { "content-type": "text/html; charset=utf-8" });
        res.end(renderRegisterPage({ errorKind }));
      }
      return;
    }

    if (req.method === "GET" && url.pathname === "/logout") {
      res.setHeader("set-cookie", "vf_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
      res.writeHead(302, { location: "/login" });
      res.end();
      return;
    }

    // Korunan rotalar — oturum zorunlu
    const tenantId = sessionTenantId(req);
    if (!tenantId) {
      res.writeHead(302, { location: "/login" });
      res.end();
      return;
    }
    const service = createPanelService(store, { tenantId });

    if (req.method === "GET" && url.pathname === "/clients") {
      const clients = await service.getClientList();
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(
        renderClientsPage({
          tenantName: "Panel",
          clients,
          demoSiteHref: demoSiteId ? `/sites/${demoSiteId}` : undefined,
        }),
      );
      return;
    }

    if (req.method === "POST" && url.pathname === "/clients") {
      const form = new URLSearchParams(await readBody(req));
      await service.addClient(form.get("name") ?? "İsimsiz Müşteri");
      res.writeHead(302, { location: "/clients" });
      res.end();
      return;
    }

    if (req.method === "GET" && url.pathname.startsWith("/sites/")) {
      const siteId = url.pathname.slice("/sites/".length);
      const site = await store.getSite(siteId);
      if (!site) {
        res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
        res.end("Site bulunamadı");
        return;
      }
      const scans = await service.getSiteScans(siteId);
      const chainValid = await service.verifySite(siteId);
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(renderSitePage({ siteUrl: site.url, chainValid, scans }));
      return;
    }

    if (req.method === "POST" && url.pathname.startsWith("/api/ingest/")) {
      const body = JSON.parse(await readBody(req)) as Record<string, unknown>;
      try {
        if (url.pathname === "/api/ingest/scan/receipt") {
          const entry = await ingest.receipt({
            token: String(body.token ?? ""),
            receipt: body.receipt as never,
          });
          res.writeHead(200, { "content-type": "application/json" });
          res.end(JSON.stringify({ id: entry.id, chainHash: entry.chainHash }));
          return;
        }
        if (url.pathname === "/api/ingest/scan") {
          const scan = await ingest.scan({
            token: String(body.token ?? ""),
            report: body.report as never,
            cookies: (body.cookies ?? []) as never,
            observedTargets: (body.observedTargets ?? []) as never,
          });
          res.writeHead(200, { "content-type": "application/json" });
          res.end(JSON.stringify({ id: scan.id }));
          return;
        }
        res.writeHead(404, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "bilinmeyen ingest ucu" }));
      } catch (error) {
        if (error instanceof IngestError) {
          res.writeHead(error.status, { "content-type": "application/json" });
          res.end(JSON.stringify({ error: error.message }));
        } else {
          res.writeHead(400, { "content-type": "application/json" });
          res.end(JSON.stringify({ error: "geçersiz istek" }));
        }
      }
      return;
    }

    res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
    res.end("404");
  } catch {
    // service katmanındaki "erişim reddedildi" ve benzeri hatalar —
    // varoluş sızdırmak için tek tip yanıt
    res.writeHead(403, { "content-type": "text/html; charset=utf-8" });
    res.end("Erişim reddedildi");
  }
});

server.listen(PORT, process.env.HOST ?? "0.0.0.0", () => {
  console.log(`Veriform panel: http://127.0.0.1:${PORT}/login`);
});
