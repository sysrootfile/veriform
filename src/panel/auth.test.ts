import { describe, expect, it } from "vitest";
import {
  createSessionToken,
  hashPassword,
  SESSION_TTL_MS,
  verifyPassword,
  verifySessionToken,
} from "./auth.js";

const SECRET = "test-secret";

describe("hashPassword / verifyPassword", () => {
  it("doğru şifre doğrulanır", async () => {
    const stored = await hashPassword("gizli-şifre-123");
    expect(stored.startsWith("scrypt:")).toBe(true);
    expect(await verifyPassword("gizli-şifre-123", stored)).toBe(true);
  });

  it("yanlış şifre reddedilir", async () => {
    const stored = await hashPassword("gizli-şifre-123");
    expect(await verifyPassword("yanlış", stored)).toBe(false);
  });

  it("aynı şifrenin iki hash'i farklıdır (tuz)", async () => {
    const a = await hashPassword("aynı");
    const b = await hashPassword("aynı");
    expect(a).not.toBe(b);
    expect(await verifyPassword("aynı", a)).toBe(true);
    expect(await verifyPassword("aynı", b)).toBe(true);
  });

  it("bozuk saklanmış değer false döner (çökmez)", async () => {
    expect(await verifyPassword("x", "")).toBe(false);
    expect(await verifyPassword("x", "md5:aa:bb")).toBe(false);
    expect(await verifyPassword("x", "scrypt:zz:yy")).toBe(false);
  });
});

describe("createSessionToken / verifySessionToken", () => {
  it("token geri çözümlenir ve tenant döner", () => {
    const token = createSessionToken("tenant-1", SECRET, 1_000_000);
    expect(verifySessionToken(token, SECRET, 1_000_000)).toBe("tenant-1");
  });

  it("TTL 7 gündür ve süre dolunca reddedilir", () => {
    const now = 1_000_000;
    expect(SESSION_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000);
    const token = createSessionToken("tenant-1", SECRET, now);
    expect(verifySessionToken(token, SECRET, now + SESSION_TTL_MS - 1)).toBe("tenant-1");
    expect(verifySessionToken(token, SECRET, now + SESSION_TTL_MS)).toBeNull();
  });

  it("imza kurcalanınca reddedilir", () => {
    const token = createSessionToken("tenant-1", SECRET, 1_000_000);
    const forged = token.slice(0, -4) + "AAAA";
    expect(verifySessionToken(forged, SECRET, 1_000_000)).toBeNull();
  });

  it("farklı gizli anahtar reddedilir", () => {
    const token = createSessionToken("tenant-1", SECRET, 1_000_000);
    expect(verifySessionToken(token, "başka-secret", 1_000_000)).toBeNull();
  });

  it("tenant değiştirilip imza eski tutulursa reddedilir", () => {
    const token = createSessionToken("tenant-1", SECRET, 1_000_000);
    const [payloadB64] = token.split(".");
    const payload = Buffer.from(payloadB64!, "base64url").toString("utf8").replace("tenant-1", "tenant-2");
    const evil = `${Buffer.from(payload).toString("base64url")}.${token.split(".")[1]}`;
    expect(verifySessionToken(evil, SECRET, 1_000_000)).toBeNull();
  });

  it("çöp girişler çökmez", () => {
    expect(verifySessionToken("", SECRET)).toBeNull();
    expect(verifySessionToken("abc", SECRET)).toBeNull();
    expect(verifySessionToken("a.b", SECRET)).toBeNull();
  });
});
