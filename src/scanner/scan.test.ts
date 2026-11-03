import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { buildEmbedSource, scanSite } from "./scan.js";

const FIXTURE_HTML = `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><title>Mağaza</title></head><body>
<form action="/uye" method="post">
  <label for="ad">Ad Soyad</label><input id="ad" name="adsoyad">
  <label for="mail">E-Posta</label><input id="mail" name="email" type="email">
  <label for="tc">T.C. Kimlik No</label><input id="tc" name="tcno">
  <button type="submit">Kaydol</button>
</form>
<form action="/bulten" method="post">
  <label for="e2">E-Posta</label><input id="e2" name="email" type="email">
</form>
<script>
document.cookie = "PHPSESSID=abc123; path=/";
document.cookie = "_ga=GA1.1.123456789; path=/";
document.cookie = "_fbp=fb.1.1234567890; path=/";
fetch('/api/track', { method: 'POST' });
</script>
<script src="/vendor/widget.js"></script>
</body></html>`;

let server: Server;
let baseUrl = "";

beforeAll(async () => {
  server = createServer((req, res) => {
    if (req.url === "/") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(FIXTURE_HTML);
      return;
    }
    res.writeHead(204);
    res.end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  baseUrl = `http://127.0.0.1:${port}/`;
}, 30_000);

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  );
});

describe("scanSite (gerçek headless tarayıcı + yerel fixture)", () => {
  it(
    "embed'i enjekte eder; keşif, sınıflandırma ve canlı fetch hedefini toplar",
    async () => {
      const result = await scanSite(baseUrl, { embedSource: await buildEmbedSource() });

      expect(result.report.formCount).toBe(2);
      expect(result.report.fieldCount).toBe(4);
      expect(result.report.categoryCounts).toContainEqual({ category: "tckn", forms: 1 });
      expect(result.report.categoryCounts).toContainEqual({ category: "email", forms: 2 });
      expect(result.observedTargets).toContainEqual(
        expect.objectContaining({ path: "/api/track", via: "fetch", method: "POST" }),
      );
      // RIZA ÖNCESİ ÇEREZLER: tarayıcı rıza vermeden gezindi — bulunan her
      // zorunlu-olmayan çerez ihlal kanıtıdır
      expect(result.cookies).toContainEqual(
        expect.objectContaining({ name: "PHPSESSID", category: "necessary" }),
      );
      expect(result.cookies).toContainEqual(
        expect.objectContaining({ name: "_ga", category: "analytics" }),
      );
      expect(result.cookies).toContainEqual(
        expect.objectContaining({ name: "_fbp", category: "marketing" }),
      );
      // SCRIPT ENVANTERİ: aynı kaynak + üçüncü taraf ayrımı
      expect(result.scripts).toContainEqual(
        expect.objectContaining({ url: expect.stringContaining("/vendor/widget.js"), category: "first-party" }),
      );
      expect(result.scripts.filter((s) => s.category === "first-party").length).toBeGreaterThanOrEqual(1);
      // RAPOR SÖZLEŞMESİ: tarayıcıdan gelen her şey JSON-güvenli
      expect(JSON.parse(JSON.stringify(result)).report).toEqual(result.report);
    },
    90_000,
  );
});
