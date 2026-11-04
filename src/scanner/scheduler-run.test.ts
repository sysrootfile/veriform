import { describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { createInMemoryPanelStore } from "../panel/store.js";
import { runScheduledScans } from "./scheduler-run.js";

const fixture = `<!doctype html><html lang="tr"><head><title>T</title></head>
<body><form action="/uye" method="post"><label>E-Posta</label><input name="email" type="email"></form></body></html>`;

function fixtureServer(): { server: Server; url: Promise<string> } {
  const server = createServer((req, res) => {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(fixture);
  });
  return {
    server,
    url: new Promise<string>((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        const addr = server.address();
        const port = typeof addr === "object" && addr ? addr.port : 0;
        resolve(`http://127.0.0.1:${port}/`);
      });
    }),
  };
}

describe("runScheduledScans (worker döngüsü)", () => {
  it("çizelgesi açık ve vakti gelen siteleri tarayıp kaydeder; ikinci tur atlar", async () => {
    const { server, url: urlPromise } = fixtureServer();
    const url = await urlPromise;
    const store = createInMemoryPanelStore();
    const tenant = await store.createTenant({ name: "A", kind: "direct" });
    const client = await store.createClient({ tenantId: tenant.id, name: "M" });
    const site = await store.createSite({ clientId: client.id, url });
    await store.setScanSchedule(site.id, 24);

    try {
      const first = await runScheduledScans(store);
      if (first.scanned.length !== 1) {
        console.log("DEBUG first:", JSON.stringify(first, null, 2));
      }
      expect(first.scanned, JSON.stringify(first.failed)).toHaveLength(1);
      expect(first.scanned[0]!.siteId).toBe(site.id);
      expect(first.scanned[0]!.report.formCount).toBe(1);

      // ikinci tur: az önce tarandı, 24 saat dolmadı → vakti yok
      const second = await runScheduledScans(store);
      expect(second.scanned).toHaveLength(0);
      expect((await store.listScans(site.id))).toHaveLength(1);
    } finally {
      server.close();
    }
  }, 60_000);

  it("çizelgesi kapalı siteler atlanır", async () => {
    const { server, url: urlPromise } = fixtureServer();
    const url = await urlPromise;
    const store = createInMemoryPanelStore();
    const tenant = await store.createTenant({ name: "A", kind: "direct" });
    const client = await store.createClient({ tenantId: tenant.id, name: "M" });
    await store.createSite({ clientId: client.id, url });

    try {
      const result = await runScheduledScans(store);
      expect(result.scanned).toHaveLength(0);
    } finally {
      server.close();
    }
  }, 30_000);

  it("tarama hatası sonucu düşürür ve diğer siteleri engellemez", async () => {
    const { server, url: urlPromise } = fixtureServer();
    const url = await urlPromise;
    const store = createInMemoryPanelStore();
    const tenant = await store.createTenant({ name: "A", kind: "direct" });
    const client = await store.createClient({ tenantId: tenant.id, name: "M" });
    // çizelge açık ama ölü port + sağlıklı fixture sitesi
    const dead = await store.createSite({ clientId: client.id, url: "http://127.0.0.1:1/" });
    await store.setScanSchedule(dead.id, 24);
    const good = await store.createSite({ clientId: client.id, url });
    await store.setScanSchedule(good.id, 24);

    try {
      const result = await runScheduledScans(store);
      expect(result.failed.length).toBeGreaterThanOrEqual(1);
      expect(result.scanned.map((s) => s.siteId)).toContain(good.id);
    } finally {
      server.close();
    }
  }, 60_000);
});
