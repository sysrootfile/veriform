import { describe, expect, it } from "vitest";
import { handleEmbedJs } from "./embed.js";

describe("handleEmbedJs", () => {
  it("build dosyasını JS content-type ile serve eder", async () => {
    const result = await handleEmbedJs(async () => "console.log('veriform');");
    expect(result.status).toBe(200);
    expect(result.contentType).toBe("application/javascript; charset=utf-8");
    expect(result.body).toBe("console.log('veriform');");
    expect(result.cacheControl).toBe("public, max-age=3600");
  });

  it("dosya okunamazsa 404 döner, throw etmez", async () => {
    const result = await handleEmbedJs(async () => {
      throw new Error("ENOENT");
    });
    expect(result.status).toBe(404);
    expect(result.body).toContain("pnpm build:embed");
  });
});