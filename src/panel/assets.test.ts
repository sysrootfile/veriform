import { describe, expect, it, vi } from "vitest";
import { FONT_FILES, handleFontAsset } from "./assets.js";

describe("handleFontAsset", () => {
  it("beyaz listedeki fontu woff2 olarak sunar", async () => {
    const read = vi.fn(async () => Buffer.from("font-bytes"));
    const result = await handleFontAsset("archivo-latin.woff2", read);
    expect(result.status).toBe(200);
    expect(result.contentType).toBe("font/woff2");
    expect(result.cacheControl).toContain("max-age=");
    expect(result.body?.toString()).toBe("font-bytes");
    expect(read).toHaveBeenCalledWith("archivo-latin.woff2");
  });

  it("beyaz liste dışındaki adı reddeder — path traversal okumaz", async () => {
    const read = vi.fn(async () => Buffer.from("x"));
    for (const name of ["../server.mjs", "..%2Fsecrets", "package.json", "archivo-latin.woff2.exe", ""]) {
      const result = await handleFontAsset(name, read);
      expect(result.status).toBe(404);
    }
    expect(read).not.toHaveBeenCalled();
  });

  it("dosya okunamazsa 404 döner", async () => {
    const result = await handleFontAsset("archivo-latin.woff2", async () => {
      throw new Error("ENOENT");
    });
    expect(result.status).toBe(404);
  });

  it("beyaz liste dört self-host woff2 dosyasıdır", () => {
    expect([...FONT_FILES].sort()).toEqual([
      "archivo-latin-ext.woff2",
      "archivo-latin.woff2",
      "spline-mono-latin-ext.woff2",
      "spline-mono-latin.woff2",
    ]);
  });
});