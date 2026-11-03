import { describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { postScanToPanel } from "./ingest.js";

function panelServer(status: number, body: unknown): { server: Server; received: Array<{ path: string; body: unknown }> } {
  const received: Array<{ path: string; body: unknown }> = [];
  const server = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      received.push({ path: req.url ?? "", body: JSON.parse(raw) });
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    });
  });
  return { server, received };
}

// not: base, dinlemeden sonra doldurulur
async function listen(server: Server): Promise<string> {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  return `http://127.0.0.1:${port}`;
}

const sampleResult = {
  report: { siteOrigin: "https://x.com", formCount: 1, fieldCount: 2, categoryCounts: [], destinations: [], riskFlags: [], review: [], forms: [] },
  cookies: [],
  observedTargets: [],
};

describe("postScanToPanel", () => {
  it("tarama sonucunu /api/ingest/scan ucuna token'la POST'lar", async () => {
    const { server, received } = panelServer(200, { id: "scan-1" });
    const base = await listen(server);
    try {
      const result = await postScanToPanel(base, "TOKEN123", sampleResult);
      expect(result.id).toBe("scan-1");
      expect(received[0]!.path).toBe("/api/ingest/scan");
      expect(received[0]!.body).toMatchObject({ token: "TOKEN123", report: { formCount: 1 } });
    } finally {
      server.close();
    }
  });

  it("panel reddini hata olarak yansıtır (401)", async () => {
    const { server } = panelServer(401, { error: "geçersiz ingest token'ı" });
    const base = await listen(server);
    try {
      await expect(postScanToPanel(base, "YANLIS", sampleResult)).rejects.toThrow(
        /geçersiz ingest token'ı/,
      );
    } finally {
      server.close();
    }
  });
});
