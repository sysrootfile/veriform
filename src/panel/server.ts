import { createServer } from "node:http";
import { createPanelService } from "./service.js";
import { createInMemoryPanelStore } from "./store.js";
import { renderClientsPage, renderSitePage } from "./render.js";

/**
 * Panel dev sunucusu (thin glue — tüm mantık service+render katmanlarında ve testlidir).
 * Faz 0: tek demo kiracısı, in-memory store; gerçek kimlik doğrulama Faz 1'de
 * oturum katmanıyla gelir. Rotalar service katmanının sahiplik guard'larından geçer.
 */

const PORT = Number(process.env.PORT ?? 4620);
const store = createInMemoryPanelStore();
const tenant = await store.createTenant({ name: "Demo Ajans", kind: "agency" });
const service = createPanelService(store, { tenantId: tenant.id });

// Demo verisi: pnpm panel açılışında hazır bir müşteri+site
const demoClient = await service.addClient("Örnek Müşteri");
const demoSite = await service.addSite(demoClient.id, "https://ornek-musteri.com");

const html = (body: string, status = 200): { status: number; body: string } => ({
  status,
  body: body,
});

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);
  try {
    if (req.method === "GET" && url.pathname === "/") {
      // Dev indeksi: demo kiracının site sayfasına doğrudan bağlantı
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(
        `<ul><li><a href="/clients">Müşteriler</a></li><li><a href="/sites/${demoSite.id}">${demoSite.url}</a></li></ul>`,
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

    res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
    res.end("404");
  } catch {
    // service katmanındaki "erişim reddedildi" ve benzeri hatalar —
    // varoluş sızdırmak için tek tip yanıt
    res.writeHead(403, { "content-type": "text/html; charset=utf-8" });
    res.end("Erişim reddedildi");
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Veriform panel: http://127.0.0.1:${PORT}/clients`);
});
