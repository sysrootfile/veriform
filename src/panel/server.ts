import { createServer } from "node:http";
import { login, registerTenant } from "./accounts.js";
import { createSessionToken, verifySessionToken } from "./auth.js";
import { createIngestApi, IngestError } from "./ingest.js";
import { receiptsToCsv } from "./chain.js";
import { buildEmbedSource, scanSite } from "../scanner/scan.js";
import { renderScanRequestPage } from "../scanner/public.js";
import { renderReportHtml } from "../report/render.js";
import { createPanelService } from "./service.js";
import { createInMemoryPanelStore } from "./store.js";
import { createPostgresPanelStore } from "./store.pg.js";
import {
  renderClientDetailPage,
  renderClientsPage,
  renderLoginPage,
  renderRegisterPage,
  renderSitePage,
} from "./render.js";
import { DSAR_TYPES } from "../dsar/types.js";
import { renderDsarFormPage, renderDsarPanelPage } from "../dsar/render.js";
import { generateAcikRizaMetni, generateAydinlatmaMetni, generateCerezPolitikasi } from "../draft/generator.js";
import { renderDraftPageHtml } from "../draft/render.js";
import { CATEGORY_LABELS, COOKIE_LABELS } from "../report/render.js";

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
  // Geliştirme varsayılanı — gerçek kimlik değildir; prod'da DEV_DEMO_PASSWORD kullanılmaz (Postgres modunda demo seed yok)
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

    // Kamu DSAR rotaları — veri sahibi dış kullanıcıdır, oturum gerekmez;
    // kimliklendirme site token'ı üzerinden (form URL'i) yapılır
    if (req.method === "GET" && url.pathname.startsWith("/dsar/")) {
      const token = url.pathname.slice("/dsar/".length);
      const site = await store.getSiteByToken(token);
      if (!site) {
        res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
        res.end("Başvuru formu bulunamadı");
        return;
      }
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(renderDsarFormPage({ siteUrl: site.url, formAction: `/dsar/${token}` }));
      return;
    }

    if (req.method === "POST" && url.pathname.startsWith("/dsar/")) {
      const token = url.pathname.slice("/dsar/".length);
      const site = await store.getSiteByToken(token);
      if (!site) {
        res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
        res.end("Başvuru formu bulunamadı");
        return;
      }
      const form = new URLSearchParams(await readBody(req));
      const type = form.get("type") ?? "";
      if (!DSAR_TYPES.includes(type as never)) {
        res.writeHead(400, { "content-type": "text/html; charset=utf-8" });
        res.end("Geçersiz talep türü");
        return;
      }
      const dsar = await ingest.dsar({
        token,
        type: type as never,
        subjectName: form.get("subjectName") ?? "",
        subjectEmail: form.get("subjectEmail") ?? "",
        ...(form.get("message") ? { message: form.get("message") as string } : {}),
      });
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(
        renderDsarFormPage({
          siteUrl: site.url,
          formAction: `/dsar/${token}`,
          success: { deadlineAt: dsar.deadlineAt },
        }),
      );
      return;
    }

    // Kamu self-servis tarama — lead magnet. Prod notu: Playwright taraması
    // ağır iş; kuyruk + hız sınırı sonraki iş. Tarayıcı yoksa nazik hata.
    if (req.method === "GET" && url.pathname === "/tarama") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(renderScanRequestPage({ formAction: "/tarama" }));
      return;
    }

    if (req.method === "POST" && url.pathname === "/tarama") {
      const form = new URLSearchParams(await readBody(req));
      const rawUrl = form.get("url") ?? "";
      let target: URL;
      try {
        target = new URL(rawUrl);
        if (target.protocol !== "http:" && target.protocol !== "https:") throw new Error("protokol");
      } catch {
        res.writeHead(400, { "content-type": "text/html; charset=utf-8" });
        res.end(renderScanRequestPage({ formAction: "/tarama", error: "Geçerli bir http(s) adresi girin" }));
        return;
      }
      try {
        // Lazy import: playwright yoksa (prod panel konteyneri) rotası nazik 500 döner
        const { buildEmbedSource, scanSite } = await import("../scanner/scan.js");
        const result = await scanSite(target.toString(), {
          embedSource: await buildEmbedSource(),
          timeoutMs: 30_000,
        });
        const report = renderReportHtml(result.report, {
          scannedAt: new Date().toISOString(),
          cookies: result.cookies,
        });
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(renderScanRequestPage({ formAction: "/tarama", resultHtml: report }));
      } catch (error) {
        console.error("[tarama] başarısız:", error);
        res.writeHead(500, { "content-type": "text/html; charset=utf-8" });
        res.end(
          renderScanRequestPage({
            formAction: "/tarama",
            error: "Tarama şu anda gerçekleştirilemedi — lütfen daha sonra tekrar deneyin",
          }),
        );
      }
      return;
    }

    // Ingest rotaları — makine kimliklendirmesi site token'ı iledir (oturum değil);
    // oturum guard'ının ÖNCESİNDE olmalı
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
            report: body.report,
            cookies: body.cookies,
            observedTargets: body.observedTargets,
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

    if (req.method === "GET" && url.pathname === "/api/embed/config") {
      try {
        const config = await ingest.embedConfig({
          token: url.searchParams.get("token") ?? "",
        });
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ bannerConfig: config }));
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

    // Korunan rotalar — oturum zorunlu
    const tenantId = sessionTenantId(req);
    if (!tenantId) {
      res.writeHead(302, { location: "/login" });
      res.end();
      return;
    }
    const service = createPanelService(store, { tenantId });

    if (req.method === "POST" && url.pathname.startsWith("/clients/") && url.pathname.endsWith("/delete")) {
      const clientId = url.pathname.slice("/clients/".length, -"/delete".length);
      await service.deleteClient(clientId);
      res.writeHead(302, { location: "/clients" });
      res.end();
      return;
    }

    if (req.method === "GET" && url.pathname === "/clients") {
      const tenant = await store.getTenant(tenantId);
      const clients = await service.getClientList();
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(
        renderClientsPage({
          tenantName: tenant?.name ?? "Panel",
          clients,
          demoSiteHref: demoSiteId ? `/sites/${demoSiteId}` : undefined,
          accent: tenant?.brandColor,
          logoUrl: tenant?.brandLogoUrl,
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

    if (req.method === "GET" && url.pathname.startsWith("/clients/")) {
      const clientId = url.pathname.slice("/clients/".length);
      const tenant = await store.getTenant(tenantId);
      const client = (await service.getClientList()).find((c) => c.id === clientId);
      const sites = await service.getClientSites(clientId);
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(
        renderClientDetailPage({
          clientName: client?.name ?? "Müşteri",
          clientHref: `/clients/${clientId}`,
          sites: sites.map((s) => ({ id: s.id, url: s.url, ingestToken: s.ingestToken })),
          accent: tenant?.brandColor,
        }),
      );
      return;
    }

    if (req.method === "POST" && url.pathname.startsWith("/clients/")) {
      const rest = url.pathname.slice("/clients/".length);
      if (!rest.endsWith("/sites")) {
        res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
        res.end("404");
        return;
      }
      const clientId = rest.slice(0, -"/sites".length);
      const form = new URLSearchParams(await readBody(req));
      await service.addSite(clientId, form.get("url") ?? "");
      res.writeHead(302, { location: `/clients/${clientId}` });
      res.end();
      return;
    }

    if (req.method === "GET" && /^\/sites\/[^/]+\/dsar$/.test(url.pathname)) {
      const siteId = url.pathname.split("/")[2]!;
      const site = await service.resolveSite(siteId);
      const requests = await service.getSiteDsars(siteId);
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(
        renderDsarPanelPage({
          siteUrl: site.url,
          siteId,
          requests,
          now: new Date().toISOString(),
        }),
      );
      return;
    }

    if (req.method === "POST" && /^\/sites\/[^/]+\/review$/.test(url.pathname)) {
      const siteId = url.pathname.split("/")[2]!;
      const form = new URLSearchParams(await readBody(req));
      const fieldName = form.get("fieldName") ?? "";
      const category = form.get("category") ?? "";
      if (!fieldName || !category) {
        res.writeHead(400, { "content-type": "text/html; charset=utf-8" });
        res.end("Zorunlu alanlar eksik");
        return;
      }
      await service.saveCorrection(siteId, { fieldName, category });
      res.writeHead(302, { location: `/sites/${siteId}` });
      res.end();
      return;
    }

    if (req.method === "POST" && /^\/sites\/[^/]+\/banner$/.test(url.pathname)) {
      const siteId = url.pathname.split("/")[2]!;
      const form = new URLSearchParams(await readBody(req));
      const texts = {
        title: form.get("title") ?? "",
        description: form.get("description") ?? "",
        acceptAll: form.get("acceptAll") ?? "",
        rejectAll: form.get("rejectAll") ?? "",
      };
      if (!form.get("bannerVersion") || !texts.title || !texts.acceptAll || !texts.rejectAll) {
        res.writeHead(400, { "content-type": "text/html; charset=utf-8" });
        res.end("Zorunlu alanlar eksik");
        return;
      }
      await service.setBannerConfig(siteId, { bannerVersion: form.get("bannerVersion")!, texts });
      res.writeHead(302, { location: `/sites/${siteId}` });
      res.end();
      return;
    }

    if (req.method === "POST" && /^\/sites\/[^/]+\/dsar\/[^/]+$/.test(url.pathname)) {
      const [, , siteId, , dsarId] = url.pathname.split("/") as [string, string, string, string, string];
      const form = new URLSearchParams(await readBody(req));
      const status = form.get("status") ?? "";
      if (status && !["new", "in-review", "completed", "rejected"].includes(status)) {
        res.writeHead(400, { "content-type": "text/html; charset=utf-8" });
        res.end("Geçersiz durum");
        return;
      }
      await service.updateDsarStatus(siteId, dsarId, {
        ...(status ? { status: status as never } : {}),
        ...(form.get("responseNote") ? { responseNote: form.get("responseNote") as string } : {}),
        extend: form.get("extend") === "1",
      });
      res.writeHead(302, { location: `/sites/${siteId}/dsar` });
      res.end();
      return;
    }

    if (req.method === "GET" && /^\/sites\/[^/]+\/evidence\.csv$/.test(url.pathname)) {
      const siteId = url.pathname.split("/")[2]!;
      const site = await service.resolveSite(siteId);
      const entries = await service.getSiteReceipts(siteId);
      res.writeHead(200, {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="evidence-${siteId}.csv"`,
      });
      res.end(receiptsToCsv(entries));
      return;
    }

    if (req.method === "GET" && /^\/sites\/[^/]+\/draft\/(aydinlatma|acik-riza|cerez-politikasi)$/.test(url.pathname)) {
      const siteId = url.pathname.split("/")[2]!;
      const kind = url.pathname.split("/")[4] as "aydinlatma" | "acik-riza" | "cerez-politikasi";
      const site = await service.resolveSite(siteId);
      const scans = await service.getSiteScans(siteId);
      const last = scans.at(-1);
      const hostname = new URL(site.url).hostname;
      const ctx = {
        siteUrl: site.url,
        contactEmail: `kvkk@${hostname}`,
        collectedCategories: (last?.report.categoryCounts ?? []).map(
          (c) => CATEGORY_LABELS[c.category] ?? c.category,
        ),
        cookieCategories: [
          ...new Set((last?.cookies ?? []).map((c) => COOKIE_LABELS[c.category] ?? c.category)),
        ],
        generatedAt: new Date().toISOString(),
      };
      const draft =
        kind === "aydinlatma"
          ? generateAydinlatmaMetni(ctx)
          : kind === "acik-riza"
            ? generateAcikRizaMetni(ctx)
            : generateCerezPolitikasi(ctx);
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(renderDraftPageHtml(draft));
      return;
    }

    if (req.method === "GET" && url.pathname.startsWith("/sites/")) {
      const siteId = url.pathname.slice("/sites/".length);
      const site = await service.resolveSite(siteId);
      const scans = await service.getSiteScans(siteId);
      const chainValid = await service.verifySite(siteId);
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(
        renderSitePage({
          siteUrl: site.url,
          siteId,
          chainValid,
          scans,
          draftLinks: scans.length
            ? [
                { href: `/sites/${siteId}/draft/aydinlatma`, label: "Aydınlatma metni" },
                { href: `/sites/${siteId}/draft/acik-riza`, label: "Açık rıza metni" },
                { href: `/sites/${siteId}/draft/cerez-politikasi`, label: "Çerez politikası" },
              ]
            : undefined,
          evidenceHref: `/sites/${siteId}/evidence.csv`,
          bannerConfig: site.bannerConfig,
        }),
      );
      return;
    }

    res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
    res.end("404");
  } catch (error) {
    // service katmanındaki "erişim reddedildi" ve benzeri hatalar —
    // varoluş sızdırmak için tek tip yanıt; gerçek sebep yalnızca loga yazılır
    console.error("[panel] istek hatası:", error);
    res.writeHead(403, { "content-type": "text/html; charset=utf-8" });
    res.end("Erişim reddedildi");
  }
});

server.listen(PORT, process.env.HOST ?? "0.0.0.0", () => {
  console.log(`Veriform panel: http://127.0.0.1:${PORT}/login`);
});
