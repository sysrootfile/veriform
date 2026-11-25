import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { login, registerTenant } from "./accounts.js";
import {
  changePassword,
  deleteAccount,
  issueEmailVerification,
  requestPasswordReset,
  resetPassword,
  verifyEmail,
} from "./account-lifecycle.js";
import {
  buildLogoutCookie,
  buildSessionCookie,
  createSessionToken,
  isSessionRevoked,
  verifySessionClaims,
} from "./auth.js";
import { mailBaseUrl, resolvePanelUrl } from "./runtime-config.js";
import { BodyTooLargeError, readBody } from "./body.js";
import { UnsafeTargetError, assertPublicHttpUrl } from "../scanner/url-guard.js";
import { createIngestApi, IngestError } from "./ingest.js";
import { receiptsToCsv } from "./chain.js";
import { createApiKey } from "./api-keys.js";
import { createRateLimiter } from "./rate-limit.js";
import { buildEmbedSource, scanSite } from "../scanner/scan.js";
import { runScheduledScans } from "../scanner/scheduler-run.js";
import { renderScanRequestPage } from "../scanner/public.js";
import { handleApiRequest } from "./api.js";
import { renderApiDocsPage } from "./api-docs.js";
import { renderReportHtml } from "../report/render.js";
import { createPanelService } from "./service.js";
import { createInMemoryPanelStore } from "./store.js";
import { createPostgresPanelStore } from "./store.pg.js";
import { migrateDatabase } from "./migrate.js";
import { checkHealth } from "./health.js";
import {
  renderAccountSettingsPage,
  renderApiKeysPage,
  renderAuditPage,
  renderClientDetailPage,
  renderClientsPage,
  renderForgotPasswordPage,
  renderLoginPage,
  renderOperatorContactsPage,
  renderOperatorPlanRequestsPage,
  renderOperatorTenantsPage,
  renderPlanPage,
  registerErrorKind,
  renderRegisterPage,
  renderResetPasswordPage,
  renderSitePage,
  renderVerifyEmailConfirmPage,
  renderVerifyEmailResultPage,
} from "./render.js";
import { DSAR_TYPES } from "../dsar/types.js";
import { renderDsarFormPage, renderDsarPanelPage } from "../dsar/render.js";
import { generateAcikRizaMetni, generateAydinlatmaMetni, generateCerezPolitikasi } from "../draft/generator.js";
import { createMailSenderFromEnv } from "./mailer.js";
import { resolvePanelSecrets } from "./secrets.js";
import { handleWorkerRun } from "./worker.js";
import { handleEmbedJs } from "./embed.js";
import { handleFontAsset } from "./assets.js";
import { LANDING_SCRIPT_HASHES, renderLandingPage } from "./landing.js";
import { renderCookiePolicyPage, renderPrivacyPage, renderTermsPage } from "./legal.js";
import { buildSecurityHeaders } from "./security-headers.js";
import { renderGuidePage } from "./guide.js";
import { handleContactSubmit } from "./contact.js";
import { isOperator } from "./operator.js";
import { isContactPackage } from "./plans.js";
import { buildDsarNotificationEmail } from "../dsar/notifications.js";
import { renderDraftPageHtml } from "../draft/render.js";
import { CATEGORY_LABELS, COOKIE_LABELS } from "../report/render.js";

/**
 * Panel sunucusu (thin glue — tüm mantık service/render/auth katmanlarında ve testlidir).
 * Depo seçimi ortamdan: DATABASE_URL → Postgres (migration'lar açılışta otomatik uygulanır),
 * yoksa in-memory (geliştirme; demo kiracı yalnız bu modda seed edilir).
 * Oturum: imzalı token çerezi (vf_session). Ingest uçları çerezle değil
 * site token'ıyla kimliklenir. Rotalar renderer'a yalnızca kod/boolean geçirir —
 * hata metinleri renderer içinde sabittir.
 */

const PORT = Number(process.env.PORT ?? 4620);
const {
  sessionSecret: SESSION_SECRET,
  sessionSecrets: SESSION_SECRETS,
  workerToken: WORKER_TOKEN,
} = resolvePanelSecrets(
  process.env as Record<string, string | undefined>,
);
if (!WORKER_TOKEN) {
  console.warn("[DEV] WORKER_TOKEN ayarlı değil — /internal/run-scheduled her çağrıda 403 döner");
}

// Mail bağlantılarının ve embed adresinin kökü yapılandırmadan gelir; istek Host başlığına güvenilmez.
const PANEL_URL = resolvePanelUrl(process.env as Record<string, string | undefined>);
const panelBaseUrl = mailBaseUrl(PANEL_URL, PORT);
// Mail gönderici DB'ye bağlanmadan seçilir: https panelde SMTP yoksa açılış burada durur.
const mailSender = createMailSenderFromEnv(process.env as Record<string, string>);

// Şema güncelliği açılışta garanti edilir — başarısız migration süreci durdurur (fail-fast).
if (process.env.DATABASE_URL) {
  const migration = await migrateDatabase(process.env.DATABASE_URL);
  for (const file of migration.baselined) console.log(`[migrate] baseline (mevcut şema kaydedildi): ${file}`);
  for (const file of migration.applied) console.log(`[migrate] uygulandı: ${file}`);
}

const store = process.env.DATABASE_URL
  ? createPostgresPanelStore(process.env.DATABASE_URL)
  : createInMemoryPanelStore();
const ingest = createIngestApi(store);

// Sürekli izleme döngüsü — ENABLE_SCAN_SCHEDULER=1 ile açılır (compose scanner imajı).
// Her turda isDue kontrolü yapılır: yalnızca vakti gelen siteler taranır.
const SCAN_CHECK_INTERVAL_MS = Number(process.env.SCAN_CHECK_INTERVAL_MS ?? 300_000); // 5 dk
if (process.env.ENABLE_SCAN_SCHEDULER === "1") {
  let running = false;
  setInterval(async () => {
    if (running) return; // önceki tur bitmediyse atla
    running = true;
    try {
      const result = await runScheduledScans(store, {
        notifier: async (email) => {
          await mailSender.send(email);
        },
      });
      if (result.scanned.length || result.notified.length) {
        console.log(
          `[sched] ${result.scanned.length} tarama, ${result.notified.length} uyarı e-postası`,
        );
      }
    } catch (error) {
      console.error("[sched] tur hatası:", error);
    } finally {
      running = false;
    }
  }, SCAN_CHECK_INTERVAL_MS);
  console.log(`[sched] sürekli izleme döngüsü: ${SCAN_CHECK_INTERVAL_MS}ms aralıkla`);
}
// Kamu /tarama POST için IP başına hız sınırı (5 istek / dakika)
const scanLimiter = createRateLimiter({ max: 5, windowMs: 60_000 });
// Auth POST'ları için IP başına hız sınırı — kaba kuvvet ve kayıt spam'ine karşı
const loginLimiter = createRateLimiter({ max: 10, windowMs: 60_000 });
const registerLimiter = createRateLimiter({ max: 5, windowMs: 60_000 });
// Şifre sıfırlama istekleri: IP başına 3 / dakika (mail bombası ve token taramasına karşı)
const resetLimiter = createRateLimiter({ max: 3, windowMs: 60_000 });
// Landing iletişim formu: IP başına 3 talep / dakika
const contactLimiter = createRateLimiter({ max: 3, windowMs: 60_000 });
// DSAR ve ingest: anahtar site kimliği (token doğrulandıktan sonra) — proxy arkasında IP tek balta olur,
// ziyaretçi IP'sine göre sınırlamak köklü kullanımı yanlışlıkla düşürür
const dsarLimiter = createRateLimiter({ max: 20, windowMs: 60_000 });
const ingestLimiter = createRateLimiter({ max: 60, windowMs: 60_000 });
const OPERATOR_EMAIL = process.env.CONTACT_OPERATOR_EMAIL ?? "iletisim@veriform.io";
// Operatör konsolu yetkisi: owner e-postası bu listede olan kiracılar /operator/* görebilir.
const OPERATOR_EMAILS = process.env.OPERATOR_EMAILS;
// TLS sonlandıran proxy arkasında SESSION_COOKIE_SECURE=1 ver; düz HTTP'de Secure çerezi düşürür
const COOKIE_SECURE = process.env.SESSION_COOKIE_SECURE === "1";

// Demo kiracı yalnızca geliştirme (in-memory) modunda seed edilir;
// Postgres modunda ilk kurulum /register üzerinden yapılır.
let demoSiteId: string | null = null;
if (!process.env.DATABASE_URL) {
  // Geliştirme varsayılanı — gerçek kimlik değildir; prod'da DEV_DEMO_PASSWORD kullanılmaz (Postgres modunda demo seed yok)
  const devPassword = process.env.DEV_DEMO_PASSWORD ?? "demo-giris";
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


function parseCookies(req: import("node:http").IncomingMessage): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (req.headers.cookie ?? "").split(";")) {
    const idx = part.indexOf("=");
    if (idx > 0) out[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
  }
  return out;
}

async function resolveSessionTenant(req: import("node:http").IncomingMessage): Promise<string | null> {
  const token = parseCookies(req)["vf_session"];
  if (!token) return null;
  const claims = verifySessionClaims(token, SESSION_SECRETS);
  if (!claims) return null;
  // Şifresi değişen ya da silinen hesabın eski çerezi geçersiz sayılır
  const user = await store.findUserByTenant(claims.tenantId);
  if (!user || isSessionRevoked(claims, user.sessionsValidAfter)) return null;
  return claims.tenantId;
}

function setSessionHeader(res: import("node:http").ServerResponse, token: string): void {
  res.setHeader("set-cookie", buildSessionCookie(token, COOKIE_SECURE));
}

/** Embed snippet'inde gösterilen mutlak adres — proxy arkasında x-forwarded-proto esas alınır. */
function embedUrl(req: import("node:http").IncomingMessage): string {
  if (PANEL_URL) return `${PANEL_URL}/embed.js`;
  const host = req.headers.host;
  if (!host) return "/embed.js";
  const forwarded = req.headers["x-forwarded-proto"];
  const proto = (typeof forwarded === "string" ? forwarded.split(",")[0]!.trim() : "") || "http";
  return `${proto}://${host}/embed.js`;
}

/** JSON yanıtları için standart başlıklar — nosniff MIME-sniffing ile HTML render'ı engeller. */
function jsonRes(
  res: import("node:http").ServerResponse,
  status: number,
  data: unknown,
): void {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "x-content-type-options": "nosniff",
  });
  res.end(JSON.stringify(data));
}

const LEGAL_PAGES: Record<string, () => string> = {
  "/kullanim-sartlari": renderTermsPage,
  "/gizlilik": renderPrivacyPage,
  "/cerez-politikasi": renderCookiePolicyPage,
};

export const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);
  const forwardedProto = req.headers["x-forwarded-proto"];
  const isHttps =
    (typeof forwardedProto === "string" ? forwardedProto.split(",")[0]!.trim() : "") === "https";
  for (const [name, value] of Object.entries(
    buildSecurityHeaders({ https: isHttps, scriptHashes: LANDING_SCRIPT_HASHES }),
  )) {
    res.setHeader(name, value);
  }
  try {
    if (req.method === "GET" && url.pathname in LEGAL_PAGES) {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(LEGAL_PAGES[url.pathname]!());
      return;
    }

    if (req.method === "GET" && url.pathname === "/healthz") {
      const health = await checkHealth(store, process.env.DATABASE_URL ? "postgres" : "memory");
      res.writeHead(health.ok ? 200 : 503, { "content-type": "application/json" });
      res.end(JSON.stringify(health));
      return;
    }

    // Embed scripti panelin kendi adresinden sunulur — müşteri snippet'i bu adresi kullanır.
    if (req.method === "GET" && url.pathname === "/embed.js") {
      const result = await handleEmbedJs(buildEmbedSource);
      const headers: Record<string, string> = {
        "content-type": result.contentType,
        "x-content-type-options": "nosniff",
      };
      if (result.cacheControl) headers["cache-control"] = result.cacheControl;
      res.writeHead(result.status, headers);
      res.end(result.body);
      return;
    }

    // Self-host fontlar — yalnız beyaz listedeki woff2 adları (path traversal kapalı).
    if (req.method === "GET" && url.pathname.startsWith("/assets/fonts/")) {
      const name = url.pathname.slice("/assets/fonts/".length);
      const result = await handleFontAsset(name, async (file) =>
        readFile(new URL(`./assets/fonts/${file}`, import.meta.url)),
      );
      const headers: Record<string, string> = {
        "content-type": result.contentType,
        "x-content-type-options": "nosniff",
      };
      if (result.cacheControl) headers["cache-control"] = result.cacheControl;
      res.writeHead(result.status, headers);
      res.end(result.body ?? "font bulunamadı");
      return;
    }

    // Kamu landing — auth kapısının önünde; contact dönüşü query ile durum basar.
    if (req.method === "GET" && url.pathname === "/") {
      const contactParam = url.searchParams.get("contact");
      const contactStatus = contactParam === "ok" || contactParam === "invalid" ? contactParam : undefined;
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(renderLandingPage({ contactStatus }));
      return;
    }

    // Landing iletişim formu — kamu ucu, operatöre mail + DB kaydı.
    if (req.method === "POST" && url.pathname === "/contact") {
      const result = await handleContactSubmit({
        form: new URLSearchParams(await readBody(req)),
        store,
        mailSender,
        operatorEmail: OPERATOR_EMAIL,
        limiter: contactLimiter,
        ip: req.socket.remoteAddress ?? "bilinmeyen",
      });
      if (result.status === 303) {
        res.writeHead(303, { location: result.location ?? "/" });
        res.end();
        return;
      }
      if (result.status === 400) {
        res.writeHead(303, { location: "/?contact=invalid#iletisim" });
        res.end();
        return;
      }
      res.writeHead(429, { "content-type": "text/plain; charset=utf-8" });
      res.end("Çok fazla talep — bir dakika bekleyip tekrar deneyin");
      return;
    }

    if (req.method === "GET" && url.pathname === "/login") {
      const hasError = url.searchParams.has("error") === true;
      const noticeParam = url.searchParams.get("notice");
      const notice = noticeParam === "reset" || noticeParam === "deleted" ? noticeParam : undefined;
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(renderLoginPage({ hasError, notice }));
      return;
    }

    if (req.method === "POST" && url.pathname === "/login") {
      if (!loginLimiter.allow(req.socket.remoteAddress ?? "bilinmeyen")) {
        res.writeHead(429, { "content-type": "text/plain; charset=utf-8" });
        res.end("Çok fazla giriş denemesi — bir dakika bekleyip tekrar deneyin");
        return;
      }
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
      if (!registerLimiter.allow(req.socket.remoteAddress ?? "bilinmeyen")) {
        res.writeHead(429, { "content-type": "text/plain; charset=utf-8" });
        res.end("Çok fazla kayıt denemesi — bir dakika bekleyip tekrar deneyin");
        return;
      }
      const form = new URLSearchParams(await readBody(req));
      try {
        const { tenant, user } = await registerTenant(store, {
          name: form.get("name") ?? "",
          kind: "agency",
          email: form.get("email") ?? "",
          password: form.get("password") ?? "",
          package: form.get("package"),
        });
        // Doğrulama maili hatası kaydı düşürmez — bağlantı panelden yeniden istenebilir.
        try {
          await issueEmailVerification(store, mailSender, user, panelBaseUrl);
        } catch (error) {
          console.error("[account] doğrulama maili gönderilemedi:", error);
        }
        setSessionHeader(res, createSessionToken(tenant.id, SESSION_SECRET));
        res.writeHead(302, { location: "/clients" });
        res.end();
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        const errorKind = registerErrorKind(message);
        res.writeHead(400, { "content-type": "text/html; charset=utf-8" });
        res.end(renderRegisterPage({ errorKind }));
      }
      return;
    }

    if (req.method === "GET" && url.pathname === "/logout") {
      res.setHeader("set-cookie", buildLogoutCookie(COOKIE_SECURE));
      res.writeHead(302, { location: "/login" });
      res.end();
      return;
    }

    if (req.method === "GET" && url.pathname === "/forgot-password") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(renderForgotPasswordPage({ sent: url.searchParams.has("sent") }));
      return;
    }

    if (req.method === "POST" && url.pathname === "/forgot-password") {
      if (!resetLimiter.allow(req.socket.remoteAddress ?? "bilinmeyen")) {
        res.writeHead(429, { "content-type": "text/plain; charset=utf-8" });
        res.end("Çok fazla istek — bir dakika bekleyip tekrar deneyin");
        return;
      }
      const form = new URLSearchParams(await readBody(req));
      // Yanıt varlık sızdırmaz: mail hatası da dahil her durumda aynı yönlendirme.
      try {
        await requestPasswordReset(store, mailSender, form.get("email") ?? "", panelBaseUrl);
      } catch (error) {
        console.error("[account] sıfırlama maili gönderilemedi:", error);
      }
      res.writeHead(303, { location: "/forgot-password?sent=1" });
      res.end();
      return;
    }

    if (req.method === "GET" && url.pathname === "/reset-password") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(renderResetPasswordPage({ token: url.searchParams.get("token") ?? "" }));
      return;
    }

    if (req.method === "POST" && url.pathname === "/reset-password") {
      if (!resetLimiter.allow(req.socket.remoteAddress ?? "bilinmeyen")) {
        res.writeHead(429, { "content-type": "text/plain; charset=utf-8" });
        res.end("Çok fazla istek — bir dakika bekleyip tekrar deneyin");
        return;
      }
      const form = new URLSearchParams(await readBody(req));
      const token = form.get("token") ?? "";
      try {
        await resetPassword(store, token, form.get("password") ?? "");
        res.writeHead(303, { location: "/login?notice=reset" });
        res.end();
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        const errorKind = /en az 8/.test(message) ? "short" : "invalid";
        res.writeHead(400, { "content-type": "text/html; charset=utf-8" });
        res.end(renderResetPasswordPage({ token, errorKind }));
      }
      return;
    }

    // GET yalnızca onay sayfası gösterir: posta güvenlik tarayıcıları bağlantıyı ön okur,
    // tek kullanımlık token'ı GET'te tüketmek doğrulamayı sessizce bozar.
    if (req.method === "GET" && url.pathname === "/verify-email") {
      const token = url.searchParams.get("token") ?? "";
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(token ? renderVerifyEmailConfirmPage(token) : renderVerifyEmailResultPage({ ok: false }));
      return;
    }

    if (req.method === "POST" && url.pathname === "/verify-email") {
      const form = new URLSearchParams(await readBody(req));
      let ok = false;
      try {
        await verifyEmail(store, form.get("token") ?? "");
        ok = true;
      } catch {
        ok = false;
      }
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(renderVerifyEmailResultPage({ ok }));
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
      if (!dsarLimiter.allow(site.id)) {
        res.writeHead(429, { "content-type": "text/html; charset=utf-8" });
        res.end("Çok fazla başvuru denemesi — bir dakika sonra tekrar deneyin");
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
      if (!dsarLimiter.allow(site.id)) {
        res.writeHead(429, { "content-type": "text/html; charset=utf-8" });
        res.end("Çok fazla başvuru denemesi — bir dakika sonra tekrar deneyin");
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
      // Veri sorumlusuna bildirim — hata taramayı/başvuruyu engellemez
      try {
        const alert = await store.getSiteAlertContext(site.id);
        if (alert) {
          const notification = buildDsarNotificationEmail({
            siteUrl: site.url,
            subjectName: dsar.subjectName,
            type: dsar.type,
            deadlineAt: dsar.deadlineAt,
          });
          await mailSender.send({ to: alert.ownerEmail, ...notification });
        }
      } catch (error) {
        console.error("[dsar] bildirim e-postası gönderilemedi:", error);
      }
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

    // Headless API — X-API-Key kimlikli, JSON istek/yanıt; oturumdan bağımsız
    if (url.pathname === "/api/v1" || url.pathname.startsWith("/api/v1/")) {
      const chunks: Buffer[] = [];
      if (req.method === "POST") {
        for await (const chunk of req) chunks.push(chunk as Buffer);
      }
      const raw = Buffer.concat(chunks).toString("utf8");
      let body: unknown;
      try {
        body = raw ? JSON.parse(raw) : undefined;
      } catch {
        jsonRes(res, 400, { error: "geçersiz JSON" });
        return;
      }
      const apiRes = await handleApiRequest(store, {
        method: req.method === "POST" ? "POST" : "GET",
        path: url.pathname,
        headers: { "x-api-key": req.headers["x-api-key"] as string | undefined },
        body,
      });
      jsonRes(res, apiRes.status, apiRes.json);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/docs") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(renderApiDocsPage());
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
        target = assertPublicHttpUrl(rawUrl);
      } catch {
        res.writeHead(400, { "content-type": "text/html; charset=utf-8" });
        res.end(renderScanRequestPage({ formAction: "/tarama", error: "Geçerli bir http(s) adresi girin" }));
        return;
      }
      try {
        const ip = req.socket.remoteAddress ?? "bilinmeyen";
        if (!scanLimiter.allow(ip)) {
          res.writeHead(429, { "content-type": "text/html; charset=utf-8" });
          res.end(
            renderScanRequestPage({
              formAction: "/tarama",
              error: "Çok fazla tarama isteği — bir dakika bekleyip tekrar deneyin",
            }),
          );
          return;
        }
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
        if (error instanceof UnsafeTargetError) {
          res.writeHead(400, { "content-type": "text/html; charset=utf-8" });
          res.end(
            renderScanRequestPage({
              formAction: "/tarama",
              error: "Bu adres taranamıyor: yalnızca genel internetteki http(s) siteleri taranır",
            }),
          );
          return;
        }
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
      let body: Record<string, unknown>;
      try {
        body = JSON.parse(await readBody(req)) as Record<string, unknown>;
      } catch (error) {
        if (error instanceof BodyTooLargeError) throw error;
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "geçersiz istek" }));
        return;
      }
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
          const site = await store.getSiteByToken(String(body.token ?? ""));
          if (site && !ingestLimiter.allow(site.id)) {
            res.writeHead(429, { "content-type": "application/json" });
            res.end(JSON.stringify({ error: "çok fazla istek — bir dakika sonra tekrar deneyin" }));
            return;
          }
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
      // Embed müşteri sitesinde (farklı origin) çalışır; config çerezsiz,
      // token-kapsamlı salt-okunur bir uç olduğundan ACAO * güvenli.
      const cors = { "access-control-allow-origin": "*" };
      try {
        const config = await ingest.embedConfig({
          token: url.searchParams.get("token") ?? "",
        });
        res.writeHead(200, { "content-type": "application/json", ...cors });
        res.end(JSON.stringify({ bannerConfig: config }));
      } catch (error) {
        if (error instanceof IngestError) {
          res.writeHead(error.status, { "content-type": "application/json", ...cors });
          res.end(JSON.stringify({ error: error.message }));
        } else {
          res.writeHead(400, { "content-type": "application/json", ...cors });
          res.end(JSON.stringify({ error: "geçersiz istek" }));
        }
      }
      return;
    }

    // Worker tetikleyicisi — cron/CI'dan çağrılır (WORKER_TOKEN ayrı bir anahtardır,
    // oturum imza anahtarı header'a sızmaz; token tanımsızsa kapı fail-closed)
    if (req.method === "POST" && url.pathname === "/internal/run-scheduled") {
      const header = req.headers["x-worker-token"];
      const presented = Array.isArray(header) ? header[0] : header;
      const result = await handleWorkerRun(
        { store, workerToken: WORKER_TOKEN, mailSender },
        presented,
      );
      res.writeHead(result.status, { "content-type": "application/json" });
      res.end(JSON.stringify(result.json));
      return;
    }

    // Korunan rotalar — oturum zorunlu
    const tenantId = await resolveSessionTenant(req);
    if (!tenantId) {
      res.writeHead(302, { location: "/login" });
      res.end();
      return;
    }
    const service = createPanelService(store, { tenantId });

    // Operatör konsolu — yetkisiz kiracıya varlık sızdırılmaz (404).
    if (url.pathname === "/operator" || url.pathname.startsWith("/operator/")) {
      const opUser = await store.findUserByTenant(tenantId);
      if (!isOperator(opUser?.email ?? "", OPERATOR_EMAILS)) {
        res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
        res.end("Sayfa bulunamadı");
        return;
      }

      if (req.method === "GET" && (url.pathname === "/operator" || url.pathname === "/operator/contacts")) {
        const requests = await store.listContactRequests();
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(renderOperatorContactsPage({ requests }));
        return;
      }

      if (req.method === "POST" && /^\/operator\/contacts\/[^/]+\/handled$/.test(url.pathname)) {
        const id = url.pathname.split("/")[3]!;
        const form = new URLSearchParams(await readBody(req));
        await store.setContactHandled(id, form.get("handled") === "true");
        res.writeHead(303, { location: "/operator/contacts" });
        res.end();
        return;
      }

      if (req.method === "GET" && url.pathname === "/operator/tenants") {
        const tenants = await store.listTenants();
        const rows = await Promise.all(
          tenants.map(async (t) => ({
            id: t.id,
            name: t.name,
            kind: t.kind,
            package: t.package,
            siteCount: await store.countSitesByTenant(t.id),
          })),
        );
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(renderOperatorTenantsPage({ tenants: rows }));
        return;
      }

      if (req.method === "POST" && /^\/operator\/tenants\/[^/]+\/package$/.test(url.pathname)) {
        const id = url.pathname.split("/")[3]!;
        const form = new URLSearchParams(await readBody(req));
        const pkg = form.get("package");
        if (!isContactPackage(pkg)) {
          res.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
          res.end("Geçersiz paket");
          return;
        }
        await store.setTenantPackage(id, pkg);
        await store.recordAudit(id, "operator.package_changed", { package: pkg });
        res.writeHead(303, { location: "/operator/tenants" });
        res.end();
        return;
      }

      if (req.method === "GET" && url.pathname === "/operator/plan-requests") {
        const [requests, tenants] = await Promise.all([
          store.listPlanChangeRequests(),
          store.listTenants(),
        ]);
        const names = new Map(tenants.map((t) => [t.id, t.name]));
        const rows = requests.map((r) => ({
          id: r.id,
          tenantName: names.get(r.tenantId) ?? "(silinmiş kiracı)",
          fromPackage: r.fromPackage,
          toPackage: r.toPackage,
          status: r.status,
          createdAt: r.createdAt,
        }));
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(renderOperatorPlanRequestsPage({ requests: rows }));
        return;
      }

      if (req.method === "POST" && /^\/operator\/plan-requests\/[^/]+\/decide$/.test(url.pathname)) {
        const id = url.pathname.split("/")[3]!;
        const form = new URLSearchParams(await readBody(req));
        const decision = form.get("decision");
        if (decision !== "approved" && decision !== "rejected") {
          res.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
          res.end("Geçersiz karar");
          return;
        }
        const reqRow = await store.decidePlanChangeRequest(id, decision);
        await store.recordAudit(reqRow.tenantId, `operator.plan_${decision}`, {
          requestId: id,
          toPackage: reqRow.toPackage,
        });
        res.writeHead(303, { location: "/operator/plan-requests" });
        res.end();
        return;
      }

      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("Sayfa bulunamadı");
      return;
    }

    if (req.method === "POST" && url.pathname.startsWith("/clients/") && url.pathname.endsWith("/delete")) {
      const clientId = url.pathname.slice("/clients/".length, -"/delete".length);
      await service.deleteClient(clientId);
      res.writeHead(302, { location: "/clients" });
      res.end();
      return;
    }

    if (req.method === "GET" && url.pathname === "/audit") {
      const entries = await store.listAudit(tenantId);
      const setup = await service.getOnboardingStatus();
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(renderAuditPage({ entries, setup }));
      return;
    }

    if (req.method === "GET" && url.pathname === "/rehber") {
      const setup = await service.getOnboardingStatus();
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(renderGuidePage(setup));
      return;
    }

    // API anahtar yönetimi (panel)
    if (req.method === "GET" && url.pathname === "/settings/api-keys") {
      const keys = await store.listApiKeys(tenantId);
      const setup = await service.getOnboardingStatus();
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(
        renderApiKeysPage({ keys, setup }),
      );
      return;
    }

    if (req.method === "POST" && url.pathname === "/settings/api-keys") {
      const form = new URLSearchParams(await readBody(req));
      const secret = await createApiKey(store, tenantId, { name: form.get("name") ?? "anahtar" });
      await store.recordAudit(tenantId, "apikey.created", { keyId: secret.id, name: form.get("name") });
      // Anahtar yalnız bu yanıtta gösterilir; adres çubuğuna, tarayıcı geçmişine ve erişim loglarına düşmez
      const keys = await store.listApiKeys(tenantId);
      const setup = await service.getOnboardingStatus();
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(renderApiKeysPage({ keys, newKey: secret.key, setup }));
      return;
    }

    if (req.method === "POST" && /^\/settings\/api-keys\/[^/]+\/revoke$/.test(url.pathname)) {
      const keyId = url.pathname.split("/")[3]!;
      await store.revokeApiKey(tenantId, keyId);
      await store.recordAudit(tenantId, "apikey.revoked", { keyId });
      res.writeHead(302, { location: "/settings/api-keys" });
      res.end();
      return;
    }

    // Plan ve kullanım — deneme durumu, kota kırılımı, self-servis geçiş talebi
    if (req.method === "GET" && url.pathname === "/settings/plan") {
      const tenant = await store.getTenant(tenantId);
      const quota = await service.getSiteQuota();
      const clients = await store.listClients(tenantId);
      const breakdown = await Promise.all(
        clients.map(async (c) => ({ name: c.name, siteCount: (await store.listSites(c.id)).length })),
      );
      const requests = await store.listPlanChangeRequests(tenantId);
      const pending = requests.find((r) => r.status === "pending");
      const lastDecided = requests.find((r) => r.status !== "pending");
      const noticeParam = url.searchParams.get("notice");
      const errorParam = url.searchParams.get("error");
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(
        renderPlanPage({
          package: tenant?.package ?? "starter",
          trial: quota.trial,
          trialDaysLeft: quota.trialDaysLeft,
          used: quota.used,
          limit: quota.limit,
          clients: breakdown,
          pendingTo: pending?.toPackage,
          notice: noticeParam === "requested" ? "requested" : undefined,
          errorKind: errorParam === "pending" || errorParam === "same" ? errorParam : undefined,
          lastDecision:
            lastDecided?.status === "approved" || lastDecided?.status === "rejected"
              ? lastDecided.status
              : undefined,
          setup: await service.getOnboardingStatus(),
        }),
      );
      return;
    }

    if (req.method === "POST" && url.pathname === "/settings/plan") {
      const form = new URLSearchParams(await readBody(req));
      const pkg = form.get("package");
      if (!isContactPackage(pkg)) {
        res.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
        res.end("Geçersiz paket");
        return;
      }
      try {
        await store.createPlanChangeRequest({ tenantId, toPackage: pkg });
        await store.recordAudit(tenantId, "plan.requested", { toPackage: pkg });
        res.writeHead(303, { location: "/settings/plan?notice=requested" });
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (message.includes("bekleyen")) {
          res.writeHead(303, { location: "/settings/plan?error=pending" });
        } else if (message.includes("zaten bu pakettesiniz")) {
          res.writeHead(303, { location: "/settings/plan?error=same" });
        } else {
          throw error;
        }
      }
      res.end();
      return;
    }

    // Hesap ayarları — doğrulama, şifre değiştirme, hesap silme
    if (req.method === "GET" && url.pathname === "/settings/account") {
      const user = await store.findUserByTenant(tenantId);
      const noticeParam = url.searchParams.get("notice");
      const errorParam = url.searchParams.get("error");
      const notice = noticeParam === "verify-sent" || noticeParam === "password-changed" ? noticeParam : undefined;
      const errorKind =
        errorParam === "current" || errorParam === "short" || errorParam === "mail" ? errorParam : undefined;
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(
        renderAccountSettingsPage({
          email: user?.email ?? "",
          emailVerified: Boolean(user?.emailVerifiedAt),
          notice,
          errorKind,
          setup: await service.getOnboardingStatus(),
        }),
      );
      return;
    }

    if (req.method === "POST" && url.pathname === "/settings/account/resend-verification") {
      const user = await store.findUserByTenant(tenantId);
      if (user && !user.emailVerifiedAt) {
        try {
          await issueEmailVerification(store, mailSender, user, panelBaseUrl);
          res.writeHead(303, { location: "/settings/account?notice=verify-sent" });
        } catch (error) {
          console.error("[account] doğrulama maili gönderilemedi:", error);
          res.writeHead(303, { location: "/settings/account?error=mail" });
        }
      } else {
        res.writeHead(303, { location: "/settings/account" });
      }
      res.end();
      return;
    }

    if (req.method === "POST" && url.pathname === "/settings/account/password") {
      const form = new URLSearchParams(await readBody(req));
      try {
        await changePassword(store, tenantId, form.get("currentPassword") ?? "", form.get("newPassword") ?? "");
        await store.recordAudit(tenantId, "account.password_changed", {});
        // Eski oturumlar düştü; bu tarayıcıya yeni çerez verilir
        setSessionHeader(res, createSessionToken(tenantId, SESSION_SECRET));
        res.writeHead(303, { location: "/settings/account?notice=password-changed" });
        res.end();
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (/mevcut şifre/.test(message)) {
          res.writeHead(303, { location: "/settings/account?error=current" });
          res.end();
          return;
        }
        if (/en az 8/.test(message)) {
          res.writeHead(303, { location: "/settings/account?error=short" });
          res.end();
          return;
        }
        throw error;
      }
      return;
    }

    if (req.method === "POST" && url.pathname === "/settings/account/delete") {
      const form = new URLSearchParams(await readBody(req));
      if (form.get("confirm") !== "on") {
        res.writeHead(303, { location: "/settings/account" });
        res.end();
        return;
      }
      await deleteAccount(store, tenantId);
      res.setHeader("set-cookie", buildLogoutCookie(COOKIE_SECURE));
      res.writeHead(303, { location: "/login?notice=deleted" });
      res.end();
      return;
    }

    if (req.method === "GET" && url.pathname === "/clients") {
      const tenant = await store.getTenant(tenantId);
      const user = await store.findUserByTenant(tenantId);
      const clients = await service.getClientList();
      const setup = await service.getOnboardingStatus();
      const quota = await service.getSiteQuota();
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(
        renderClientsPage({
          tenantName: tenant?.name ?? "Panel",
          clients,
          demoSiteHref: demoSiteId ? `/sites/${demoSiteId}` : undefined,
          accent: tenant?.brandColor,
          logoUrl: tenant?.brandLogoUrl,
          setup,
          quota,
          emailVerified: Boolean(user?.emailVerifiedAt),
          operator: isOperator(user?.email ?? "", OPERATOR_EMAILS),
          trial: quota.trial,
          trialDaysLeft: quota.trialDaysLeft,
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
      const client = (await service.getClientList()).find((c) => c.id === clientId);
      const sites = await service.getClientSites(clientId);
      const detailUser = await store.findUserByTenant(tenantId);
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(
        renderClientDetailPage({
          clientName: client?.name ?? "Müşteri",
          clientHref: `/clients/${clientId}`,
          sites: sites.map((s) => ({ id: s.id, url: s.url, ingestToken: s.ingestToken })),
          accent: client?.brandColor,
          logoUrl: client?.brandLogoUrl,
          embedSrc: embedUrl(req),
          quotaFull: url.searchParams.get("quota") === "full",
          emailVerified: Boolean(detailUser?.emailVerifiedAt),
          siteInvalid: url.searchParams.get("site") === "invalid",
          setup: await service.getOnboardingStatus(),
        }),
      );
      return;
    }

    if (req.method === "POST" && url.pathname.startsWith("/clients/")) {
      const rest = url.pathname.slice("/clients/".length);
      if (rest.endsWith("/branding")) {
        const clientId = rest.slice(0, -"/branding".length);
        const form = new URLSearchParams(await readBody(req));
        const color = form.get("brandColor");
        const logoUrl = form.get("brandLogoUrl");
        await service.setClientBranding(clientId, {
          ...(color ? { brandColor: color } : {}),
          ...(logoUrl ? { brandLogoUrl: logoUrl } : {}),
        });
        res.writeHead(302, { location: `/clients/${clientId}` });
        res.end();
        return;
      }
      if (!rest.endsWith("/sites")) {
        res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
        res.end("404");
        return;
      }
      const clientId = rest.slice(0, -"/sites".length);
      const form = new URLSearchParams(await readBody(req));
      try {
        await service.addSite(clientId, form.get("url") ?? "");
      } catch (error) {
        if (error instanceof Error && /site kotası doldu/.test(error.message)) {
          res.writeHead(302, { location: `/clients/${clientId}?quota=full` });
          res.end();
          return;
        }
        if (error instanceof UnsafeTargetError) {
          res.writeHead(302, { location: `/clients/${clientId}?site=invalid` });
          res.end();
          return;
        }
        throw error;
      }
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

    if (req.method === "POST" && /^\/sites\/[^/]+\/schedule$/.test(url.pathname)) {
      const siteId = url.pathname.split("/")[2]!;
      const form = new URLSearchParams(await readBody(req));
      const hours = Number(form.get("intervalHours") ?? "0");
      if (!Number.isInteger(hours) || hours < 0 || hours > 720) {
        res.writeHead(400, { "content-type": "text/html; charset=utf-8" });
        res.end("Geçersiz aralık (0–720 saat)");
        return;
      }
      await service.setScanSchedule(siteId, hours);
      res.writeHead(302, { location: `/sites/${siteId}` });
      res.end();
      return;
    }

    if (req.method === "POST" && /^\/sites\/[^/]+\/banner$/.test(url.pathname)) {
      const siteId = url.pathname.split("/")[2]!;
      // Yumuşak kapı: banner yayını üretim işidir — e-posta onayı olmadan yazılmaz.
      const bannerUser = await store.findUserByTenant(tenantId);
      if (!bannerUser?.emailVerifiedAt) {
        res.writeHead(303, { location: `/sites/${siteId}` });
        res.end();
        return;
      }
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

    if (req.method === "POST" && /^\/sites\/[^/]+\/scan$/.test(url.pathname)) {
      const siteId = url.pathname.split("/")[2]!;
      const site = await service.resolveSite(siteId);
      const ip = req.socket.remoteAddress ?? "bilinmeyen";
      if (!scanLimiter.allow(ip)) {
        res.writeHead(303, { location: `/sites/${siteId}?scan=limited` });
        res.end();
        return;
      }
      try {
        // Lazy import: playwright yoksa (prod panel konteyneri) nazik hata bildirimi
        const { buildEmbedSource, scanSite } = await import("../scanner/scan.js");
        const result = await scanSite(site.url, {
          embedSource: await buildEmbedSource(),
          timeoutMs: 30_000,
        });
        await service.ingestScan({
          siteId,
          report: result.report,
          cookies: result.cookies,
          observedTargets: result.observedTargets,
          scripts: result.scripts,
        });
        await store.recordAudit(tenantId, "scan.manual", { siteId });
        res.writeHead(303, { location: `/sites/${siteId}?scan=ok` });
      } catch (error) {
        console.error("[scan-now] başarısız:", error);
        res.writeHead(303, { location: `/sites/${siteId}?scan=error` });
      }
      res.end();
      return;
    }

    if (req.method === "GET" && url.pathname.startsWith("/sites/")) {
      const siteId = url.pathname.slice("/sites/".length);
      const site = await service.resolveSite(siteId);
      const scans = await service.getSiteScans(siteId);
      const chainValid = await service.verifySite(siteId);
      const siteUser = await store.findUserByTenant(tenantId);
      const scanParam = url.searchParams.get("scan");
      const scanNotice =
        scanParam === "ok" || scanParam === "error" || scanParam === "limited" ? scanParam : undefined;
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
          scanIntervalHours: site.scanIntervalHours,
          embedLastSeenAt: site.embedLastSeenAt,
          scanNotice,
          emailVerified: Boolean(siteUser?.emailVerifiedAt),
          setup: await service.getOnboardingStatus(),
        }),
      );
      return;
    }

    res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
    res.end("404");
  } catch (error) {
    // service katmanındaki "erişim reddedildi" ve benzeri hatalar —
    // varoluş sızdırmak için tek tip yanıt; gerçek sebep yalnızca loga yazılır
    if (error instanceof BodyTooLargeError) {
      // Gövde okumayı bıraktık; kalan baytları boşuna almadan bağlantıyı kapat
      res.setHeader("connection", "close");
      res.writeHead(413, { "content-type": "text/plain; charset=utf-8" });
      res.end("İstek gövdesi çok büyük (en fazla 5 MB)");
      return;
    }
    console.error("[panel] istek hatası:", error);
    res.writeHead(403, { "content-type": "text/html; charset=utf-8" });
    res.end("Erişim reddedildi");
  }
});

server.listen(PORT, process.env.HOST ?? "0.0.0.0", () => {
  console.log(`Veriform panel: http://127.0.0.1:${PORT}/login`);
});
