import { randomUUID } from "node:crypto";
import { once } from "node:events";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Panel sunucusu entegrasyon testi: gerçek süreç içi sunucu, gerçek HTTP istekleri.
 * Rota bağlantısı burada ölçülür (hız sınırları, çerez, mail bağlantısı kökü);
 * iş mantığı kendi modüllerinin testlerinde.
 */

const PORT = 20000 + Math.floor(Math.random() * 20000);
const BASE = `http://127.0.0.1:${PORT}`;
const PANEL = "https://panel.test";
const PASSWORD = "Probe-pass-16!";

let server: Server;
let logs: string[] = [];

async function boot(env: Record<string, string | undefined>): Promise<void> {
  for (const key of ["DATABASE_URL", "PANEL_URL", "ALLOW_CONSOLE_MAIL", "SMTP_HOST"]) delete process.env[key];
  Object.assign(process.env, env);
  vi.resetModules();
  const mod = (await import("./server.js")) as { server: Server };
  server = mod.server;
  if (!server.listening) await once(server, "listening");
}

beforeAll(async () => {
  logs = [];
  vi.spyOn(console, "log").mockImplementation((...parts: unknown[]) => {
    logs.push(parts.map(String).join(" "));
  });
  await boot({ SESSION_SECRET: "test-sirri-".repeat(4), PORT: String(PORT), PANEL_URL: PANEL, ALLOW_CONSOLE_MAIL: "1" });
}, 30_000);

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  vi.restoreAllMocks();
});

interface Reply {
  status: number;
  location: string;
  cookie: string;
  text: string;
}

async function call(
  path: string,
  init: { body?: BodyInit; cookie?: string; headers?: Record<string, string> } = {},
): Promise<Reply> {
  const posting = init.body !== undefined;
  const res = await fetch(`${BASE}${path}`, {
    method: posting ? "POST" : "GET",
    redirect: "manual",
    ...(posting ? { body: init.body } : {}),
    headers: {
      ...(posting ? { "content-type": "application/x-www-form-urlencoded" } : {}),
      ...(init.cookie ? { cookie: init.cookie } : {}),
      ...init.headers,
    },
  });
  const setCookie = res.headers.getSetCookie()[0];
  return {
    status: res.status,
    location: res.headers.get("location") ?? "",
    cookie: setCookie ? setCookie.split(";")[0]! : "",
    text: await res.text(),
  };
}

const form = (fields: Record<string, string>) => new URLSearchParams(fields).toString();

function lastMailLink(kind: "verify-email" | "reset-password"): string {
  const links = [...logs.join("\n").matchAll(new RegExp(`${PANEL}/${kind}\\?token=([0-9a-f]+)`, "g"))];
  const token = links.at(-1)?.[1];
  if (!token) throw new Error(`mail bağlantısı bulunamadı: ${kind}`);
  return token;
}

interface Session {
  cookie: string;
  email: string;
  password: string;
}

// Kayıt sınırı dakikada 5: hesaplar paylaşılır, her test yeni hesap açmaz
let shared: Promise<Session> | null = null;
const session = (): Promise<Session> => (shared ??= signUp());

async function signUp(): Promise<Session> {
  const email = `sunucu-${randomUUID()}@test.test`;
  const registered = await call("/register", {
    body: form({ name: "Test Ajansı", email, password: PASSWORD }),
  });
  expect(registered.status).toBe(302);
  expect(await call("/verify-email", { body: form({ token: lastMailLink("verify-email") }) })).toMatchObject({
    status: 200,
  });
  return { cookie: registered.cookie, email, password: PASSWORD };
}

async function siteTokenOf(cookie: string): Promise<string> {
  expect((await call("/clients", { body: form({ name: "Müşteri" }), cookie })).status).toBe(302);
  const list = await call("/clients", { cookie });
  const clientId = list.text.match(/\/clients\/([0-9a-f-]{36})/)?.[1];
  if (!clientId) throw new Error("müşteri kimliği bulunamadı");
  const added = await call(`/clients/${clientId}/sites`, {
    body: form({ url: "https://example.com" }),
    cookie,
  });
  expect(added.status).toBe(302);
  const detail = await call(`/clients/${clientId}`, { cookie });
  const token = detail.text.match(/example\.com<\/a><\/td><td><code>([^<]+)<\/code>/)?.[1];
  if (!token) throw new Error("site anahtarı bulunamadı");
  return token;
}

describe("sunucu rotaları", () => {
  it("mail bağlantısının kökü PANEL_URL'dir, istek Host başlığı değil", async () => {
    const { email } = await session();
    const res = await call("/forgot-password", {
      body: form({ email }),
      headers: { host: "evil.test" },
    });
    expect(res.status).toBe(303);
    const mail = logs.join("\n");
    expect(mail).toContain(`${PANEL}/reset-password?token=`);
    expect(mail).not.toContain("evil.test");
  });

  it("kayıt kısa şifreyi 400 ile reddeder", async () => {
    const res = await call("/register", {
      body: form({ name: "Test Ajansı", email: `kisa-${randomUUID()}@test.test`, password: "kisa" }),
    });
    expect(res.status).toBe(400);
    expect(res.text).toContain("en az 8");
  });

  it("e-posta onayı: GET token'ı tüketmez, POST tüketir", async () => {
    const email = `onay-${randomUUID()}@test.test`;
    expect(
      (await call("/register", { body: form({ name: "Test Ajansı", email, password: PASSWORD }) })).status,
    ).toBe(302);
    const token = lastMailLink("verify-email");
    const page = await call(`/verify-email?token=${token}`);
    expect(page.status).toBe(200);
    expect(page.text).toContain('action="/verify-email"');
    const confirmed = await call("/verify-email", { body: form({ token }) });
    expect(confirmed.status).toBe(200);
    expect(confirmed.text).toContain("doğrulandı");
    expect((await call("/verify-email", { body: form({ token }) })).text).toContain(
      "geçersiz veya süresi dolmuş",
    );
  });

  it("genel olmayan site adresi eklenmez", async () => {
    const { cookie } = await session();
    expect((await call("/clients", { body: form({ name: "Müşteri" }), cookie })).status).toBe(302);
    const clientId = (await call("/clients", { cookie })).text.match(/\/clients\/([0-9a-f-]{36})/)?.[1];
    const res = await call(`/clients/${clientId}/sites`, {
      body: form({ url: "http://127.0.0.1:4620/" }),
      cookie,
    });
    expect(res.status).toBe(302);
    expect(res.location).toBe(`/clients/${clientId}?site=invalid`);
  });

  it("/tarama yerel adresi taranamaz", async () => {
    const { cookie } = await session();
    const res = await call("/tarama", { body: form({ url: "http://localhost/" }), cookie });
    expect(res.status).toBe(400);
    expect(res.text).toContain("Geçerli bir http(s) adresi girin");
  });

  it("API anahtarı yalnız üretim yanıtının gövdesinde taşınır", async () => {
    const { cookie } = await session();
    const created = await call("/settings/api-keys", { body: form({ name: "test-anahtarı" }), cookie });
    expect(created.status).toBe(200);
    expect(created.location).toBe("");
    const key = created.text.match(/<pre>([^<]+)<\/pre>/)?.[1];
    expect(key).toBeTruthy();
    const page = await call("/settings/api-keys", { cookie });
    expect(page.status).toBe(200);
    expect(page.text).not.toContain(key!);
  });

  it("şifre değişince eski çerez düşer", async () => {
    const current = await session();
    const changed = await call("/settings/account/password", {
      body: form({ currentPassword: current.password, newPassword: "Probe-yeni-16!" }),
      cookie: current.cookie,
    });
    expect(changed.status).toBe(303);
    shared = Promise.resolve({ ...current, cookie: changed.cookie, password: "Probe-yeni-16!" });
    const old = await call("/clients", { cookie: current.cookie });
    expect(old.status).toBe(302);
    expect(old.location).toBe("/login");
    expect((await call("/clients", { cookie: changed.cookie })).status).toBe(200);
  });

  it("5 MB üstü gövde 413 döner ve yanıt istemciye ulaşır", async () => {
    const res = await call("/login", { body: `a=${"a".repeat(6 * 1024 * 1024)}` });
    expect(res.status).toBe(413);
    expect(res.text).toContain("çok büyük");
  });

  it("DSAR göndermesi dakikada 20 ile sınırlıdır", async () => {
    const token = await siteTokenOf((await session()).cookie);
    const statuses: number[] = [];
    for (let i = 0; i < 21; i++) {
      statuses.push((await call(`/dsar/${token}`, { body: form({ type: "bozuk" }) })).status);
    }
    expect(statuses.filter((s) => s === 400)).toHaveLength(20);
    expect(statuses.filter((s) => s === 429)).toHaveLength(1);
  }, 30_000);

  it("ingest scan dakikada 60 ile sınırlıdır", async () => {
    const token = await siteTokenOf((await session()).cookie);
    const statuses: number[] = [];
    for (let i = 0; i < 61; i++) {
      const res = await fetch(`${BASE}/api/ingest/scan`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, report: {} }),
      });
      statuses.push(res.status);
      await res.text();
    }
    expect(statuses.filter((s) => s === 400)).toHaveLength(60);
    expect(statuses.filter((s) => s === 429)).toHaveLength(1);
  }, 30_000);
});

describe("site anahtarı domain bağı — rota kapısı", () => {
  // Tek taze hesap (kayıt limiter kovası dakika başına 5); her çağrı ayrı site
  // açar, ingest limiter kovası site kimliğiyle anahtarlı olduğundan bölünmez.
  let gateCookie: Promise<string> | null = null;
  const gateToken = (): Promise<string> =>
    (gateCookie ??= signUp().then((s) => s.cookie)).then((cookie) => siteTokenOf(cookie));
  it("embed config yanlış Origin'de 403, kayıtlı domainde 200", async () => {
    const token = await gateToken();
    const bad = await call(`/api/embed/config?token=${token}`, { headers: { origin: "https://evil.com" } });
    expect(bad.status).toBe(403);
    const ok = await call(`/api/embed/config?token=${token}`, { headers: { origin: "https://example.com" } });
    expect(ok.status).toBe(200);
  });

  it("ingest POST'ları tarayıcı CORS'unu geçer: preflight 204, yanıt ACAO *", async () => {
    const pre = await fetch(`${BASE}/api/ingest/scan/receipt`, {
      method: "OPTIONS",
      headers: {
        origin: "https://example.com",
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type",
      },
    });
    expect(pre.status).toBe(204);
    expect(pre.headers.get("access-control-allow-origin")).toBe("*");
    expect(pre.headers.get("access-control-allow-methods")).toContain("POST");
    const token = await gateToken();
    const res = await fetch(`${BASE}/api/ingest/scan/receipt`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://example.com" },
      body: JSON.stringify({ token, receipt: {} }),
    });
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    await res.text();
  });

  it("kanıt ve tarama POST'u yanlış Origin'de 403", async () => {
    const token = await gateToken();
    const receipt = await call("/api/ingest/scan/receipt", {
      body: JSON.stringify({ token, receipt: {} }),
      headers: { "content-type": "application/json", origin: "https://evil.com" },
    });
    expect(receipt.status).toBe(403);
    const scan = await call("/api/ingest/scan", {
      body: JSON.stringify({ token, report: { siteOrigin: "https://example.com", formCount: 0, categoryCounts: [] } }),
      headers: { "content-type": "application/json", origin: "https://evil.com" },
    });
    expect(scan.status).toBe(403);
  });
});

describe("açılış kapıları", () => {
  it("Postgres modunda PANEL_URL yoksa açılış DB'ye bağlanmadan durur", async () => {
    await expect(
      boot({ SESSION_SECRET: "test-sirri-".repeat(4), PORT: String(PORT), DATABASE_URL: "postgresql://u:p@127.0.0.1:1/x" }),
    ).rejects.toThrow(/PANEL_URL zorunlu/);
  });

  it("https panelde SMTP yoksa açılış durur", async () => {
    await expect(
      boot({ SESSION_SECRET: "test-sirri-".repeat(4), PORT: String(PORT), PANEL_URL: PANEL, DATABASE_URL: "postgresql://u:p@127.0.0.1:1/x" }),
    ).rejects.toThrow(/SMTP_HOST zorunlu/);
  });
});

describe("proxy arkası limiter kovası", () => {
  async function bootProxy(port: number, trustProxy: boolean): Promise<Server> {
    for (const key of ["DATABASE_URL", "SMTP_HOST", "TRUST_PROXY"]) delete process.env[key];
    Object.assign(process.env, {
      SESSION_SECRET: "test-sirri-".repeat(4),
      PORT: String(port),
      PANEL_URL: PANEL,
      ALLOW_CONSOLE_MAIL: "1",
      ...(trustProxy ? { TRUST_PROXY: "1" } : {}),
    });
    vi.resetModules();
    const mod = (await import("./server.js")) as { server: Server };
    if (!mod.server.listening) await once(mod.server, "listening");
    return mod.server;
  }

  async function contactStatus(port: number, forwardedFor: string): Promise<number> {
    const res = await fetch(`http://127.0.0.1:${port}/contact`, {
      method: "POST",
      redirect: "manual",
      headers: { "content-type": "application/x-www-form-urlencoded", "x-forwarded-for": forwardedFor },
      body: form({ name: "", email: "" }),
    });
    await res.text();
    return res.status;
  }

  it("TRUST_PROXY=1: her ziyaretçi IP'si kendi kovasını kullanır", async () => {
    const port = PORT + 1;
    const srv = await bootProxy(port, true);
    try {
      const a = [await contactStatus(port, "198.51.100.1"), await contactStatus(port, "198.51.100.1"), await contactStatus(port, "198.51.100.1"), await contactStatus(port, "198.51.100.1")];
      expect(a.filter((s) => s === 429)).toHaveLength(1);
      // Başka ziyaretçi aynı tünel IP'sinden gelse de kendi kovası boş
      expect(await contactStatus(port, "198.51.100.2")).toBe(303);
      expect(await contactStatus(port, "203.0.113.9")).toBe(303);
    } finally {
      await new Promise<void>((resolve) => srv.close(() => resolve()));
    }
  }, 30_000);

  it("TRUST_PROXY kapalı: XFF spoofing kovayı bölmez, soket adresi tek kova kalır", async () => {
    const port = PORT + 2;
    const srv = await bootProxy(port, false);
    try {
      const statuses = [
        await contactStatus(port, "198.51.100.1"),
        await contactStatus(port, "198.51.100.2"),
        await contactStatus(port, "198.51.100.3"),
        await contactStatus(port, "198.51.100.4"),
      ];
      expect(statuses.filter((s) => s === 429)).toHaveLength(1);
    } finally {
      await new Promise<void>((resolve) => srv.close(() => resolve()));
    }
  }, 30_000);
});

describe("kayıt maili arka planda", () => {
  it("SMTP erişilemezken kayıt hemen döner; mail hatası yeniden denemelerden sonra loglanır", async () => {
    const port = PORT + 3;
    for (const key of ["DATABASE_URL", "ALLOW_CONSOLE_MAIL", "TRUST_PROXY"]) delete process.env[key];
    Object.assign(process.env, {
      SESSION_SECRET: "test-sirri-".repeat(4),
      PORT: String(port),
      PANEL_URL: PANEL,
      SMTP_HOST: "127.0.0.1",
      SMTP_PORT: "1",
    });
    vi.resetModules();
    const mod = (await import("./server.js")) as { server: Server };
    if (!mod.server.listening) await once(mod.server, "listening");
    const errors: string[] = [];
    const spy = vi.spyOn(console, "error").mockImplementation((...parts: unknown[]) => {
      errors.push(parts.map(String).join(" "));
    });
    const started = Date.now();
    try {
      const res = await fetch(`http://127.0.0.1:${port}/register`, {
        method: "POST",
        redirect: "manual",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: form({
          name: "Arka Plan Ajans",
          email: `arka-plan-${randomUUID()}@probe.test`,
          password: PASSWORD,
          package: "starter",
        }),
      });
      await res.text();
      const registerMs = Date.now() - started;
      expect(res.status).toBe(302);
      expect(registerMs).toBeLessThan(1500);

      await vi.waitFor(
        () => expect(errors.some((line) => line.includes("arka planda"))).toBe(true),
        { timeout: 15_000 },
      );
      // Mail hatası kayıttan sonra geldi: istek maili beklemedi
      expect(Date.now() - started).toBeGreaterThan(1500);
    } finally {
      spy.mockRestore();
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_PORT;
      await new Promise<void>((resolve) => mod.server.close(() => resolve()));
    }
  }, 30_000);
});
