import { createServer } from "node:http";
import { createIngestApi, IngestError } from "./ingest.js";
import { createPanelService } from "./service.js";
import { createInMemoryPanelStore } from "./store.js";
import { createPostgresPanelStore } from "./store.pg.js";
import { renderClientsPage, renderSitePage } from "./render.js";

/**
 * Panel sunucusu (thin glue — tüm mantık service+render katmanlarında ve testlidir).
 * Depo seçimi ortamdan: DATABASE_URL verilirse gerçek Postgres (schema.sql uygulanmış
 * olmalı), yoksa in-memory (geliştirme). Rotalar service guard'larından geçer.
 */

const PORT = Number(process.env.PORT ?? 4620);
const store = process.env.DATABASE_URL
  ? createPostgresPanelStore(process.env.DATABASE_URL)
  : createInMemoryPanelStore();
const tenant = await store.createTenant({ name: "Demo Ajans", kind: "agency" });
const service = createPanelService(store, { tenantId: tenant.id });

// Demo verisi: pnpm panel açılışında hazır bir müşteri+site
const demoClient = await service.addClient("Örnek Müşteri");
const demoSite = await service.addSite(demoClient.id, "https://ornek-musteri.com");
const ingest = createIngestApi(store);

const html = (body: string, status = 200): { status: number; body: string } => ({
  status,
  body: body,
});

/** Glue katmanında da kaçırma ilkesi: sunucu kontrollü değerler dahi HTML'e kaçırılır. */
function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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

    if (req.method === "GET" && url.pathname === "/") {
      // Dev indeksi: demo kiracının site sayfasına doğrudan bağlantı
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(
        `<ul><li><a href="/sites/${escapeHtml(demoSite.id)}">${escapeHtml(demoSite.url)}</a></li></ul>`,
      );
      return;
    }

    if (req.method === "GET" && (url.pathname === "/clients")) {
      const clients = await service.getClientList();
      const body = renderClientsPage({ tenantName: tenant.name, clients });
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(body);
      return;
    }

    if (req.method === "POST" && url.pathname === "/clients") {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk as Buffer);
      const form = new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
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
      // Sahiplik guard'ları service üzerinden geçer — doğrudan store okunmaz
      const scans = await service.getSiteScans(siteId);
      const chainValid = await service.verifySite(siteId);
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(renderSitePage({ siteUrl: site.url, chainValid, scans }));
      return;
    }

    if (req.method === "POST" && url.pathname.startsWith("/api/ingest/")) {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk as Buffer);
      let body: Record<string, unknown>;
      try {
        body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
      } catch {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "geçersiz JSON" }));
        return;
      }
      try {
        if (url.pathname === "/api/ingest/scan") {
          const scan = await ingest.scan({
            token: String(body.token ?? ""),
            report: body.report as never,
            cookies: (body.cookies ?? []) as never,
            observedTargets: (body.observedTargets ?? []) as never,
          });
          res.writeHead(200, { "content-type": "application/json" });
          res.end(JSON.stringify({ id: scan.id }));
        } else {
          const entry = await ingest.receipt({
            token: String(body.token ?? ""),
            receipt: body.receipt as never,
          });
          res.writeHead(200, { "content-type": "application/json" });
          res.end(JSON.stringify({ id: entry.id, chainHash: entry.chainHash }));
        }
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
  console.log(`Veriform panel: http://127.0.0.1:${PORT}/clients`);
  console.log(`[DEV] demo site ingest token: ${demoSite.ingestToken}`);
});
