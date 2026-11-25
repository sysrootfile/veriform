import type { IncomingMessage } from "node:http";

/** Panel uçları için gövde üst sınırı — tanımsız büyüklükte istek belleği tüketemesin. */
export const MAX_BODY_BYTES = 5 * 1024 * 1024;

export class BodyTooLargeError extends Error {
  constructor(maxBytes: number) {
    super(`istek gövdesi ${maxBytes} bayt sınırını aşıyor`);
    this.name = "BodyTooLargeError";
  }
}

/** Gövdeyi sınır içinde okur; aşırsa okumayı bırakır (yanıt 413 + connection: close verilir). */
export function readBody(req: IncomingMessage, maxBytes = MAX_BODY_BYTES): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    const cleanup = () => {
      req.off("data", onData);
      req.off("end", onEnd);
      req.off("error", onError);
      req.off("aborted", onAborted);
    };
    const fail = (error: Error) => {
      cleanup();
      req.pause();
      reject(error);
    };
    const onData = (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxBytes) return fail(new BodyTooLargeError(maxBytes));
      chunks.push(chunk);
    };
    const onEnd = () => {
      cleanup();
      resolve(Buffer.concat(chunks).toString("utf8"));
    };
    const onError = (error: Error) => fail(error);
    const onAborted = () => fail(new Error("istek yarıda kesildi"));
    req.on("data", onData);
    req.on("end", onEnd);
    req.on("error", onError);
    req.on("aborted", onAborted);
  });
}
