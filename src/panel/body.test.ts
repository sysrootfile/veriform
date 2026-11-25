import type { IncomingMessage } from "node:http";
import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";
import { BodyTooLargeError, MAX_BODY_BYTES, readBody } from "./body.js";

function requestWith(body: string): IncomingMessage {
  const stream = new PassThrough();
  stream.end(body);
  return stream as unknown as IncomingMessage;
}

describe("readBody gövde sınırı", () => {
  it("sınırın altındaki gövde olduğu gibi okunur", async () => {
    await expect(readBody(requestWith("a=b&c=d"))).resolves.toBe("a=b&c=d");
  });

  it("varsayılan sınır 5 MiB", () => {
    expect(MAX_BODY_BYTES).toBe(5 * 1024 * 1024);
  });

  it("sınırı aşan gövde BodyTooLargeError fırlatır — sonsuz bellek tüketimi yok", async () => {
    await expect(readBody(requestWith("x".repeat(100)), 10)).rejects.toBeInstanceOf(BodyTooLargeError);
  });

  it("sınır tam olarak izin verir", async () => {
    await expect(readBody(requestWith("x".repeat(10)), 10)).resolves.toHaveLength(10);
  });

  it("akış hatası çağırana iletilir", async () => {
    const stream = new PassThrough();
    const pending = readBody(stream as unknown as IncomingMessage);
    stream.destroy(new Error("kopan bağlantı"));
    await expect(pending).rejects.toThrow(/kopan bağlantı/);
  });
});
