import { describe, expect, it } from "vitest";
import {
  buildLogoutCookie,
  buildSessionCookie,
  createSessionToken,
  hashPassword,
  SESSION_TTL_MS,
  verifyPassword,
  verifySessionToken,
  verifySessionTokenAny,
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

describe("verifySessionTokenAny (anahtar rotasyonu)", () => {
  const NEW = "rotated-secret";
  const OLD = "previous-secret";

  it("tek anahtarlı listede doğrular", () => {
    const token = createSessionToken("tenant-1", OLD);
    expect(verifySessionTokenAny(token, [OLD])).toBe("tenant-1");
  });

  it("eski anahtarla imzalı çerez rotasyon sonrası çalışmaya devam eder", () => {
    const token = createSessionToken("tenant-1", OLD);
    expect(verifySessionTokenAny(token, [NEW, OLD])).toBe("tenant-1");
  });

  it("yeni anahtarla imzalı çerez listede doğrulanır", () => {
    const token = createSessionToken("tenant-1", NEW);
    expect(verifySessionTokenAny(token, [NEW, OLD])).toBe("tenant-1");
  });

  it("eski anahtar listeden çıkınca oturum düşer", () => {
    const token = createSessionToken("tenant-1", OLD);
    expect(verifySessionTokenAny(token, [NEW])).toBeNull();
  });

  it("listede hiç tanıdık anahtar yoksa reddeder", () => {
    const token = createSessionToken("tenant-1", OLD);
    expect(verifySessionTokenAny(token, ["x", "y"])).toBeNull();
  });

  it("boş anahtar listesi ve çöp token reddedilir, throw etmez", () => {
    const token = createSessionToken("tenant-1", OLD);
    expect(verifySessionTokenAny(token, [])).toBeNull();
    expect(verifySessionTokenAny("", [NEW, OLD])).toBeNull();
    expect(verifySessionTokenAny("a.b", [NEW, OLD])).toBeNull();
  });

  it("süresi dolmuş token hiçbir anahtarda geçmez", () => {
    const token = createSessionToken("tenant-1", OLD, 1_000_000);
    expect(verifySessionTokenAny(token, [NEW, OLD], 1_000_000 + SESSION_TTL_MS + 1)).toBeNull();
  });
});

describe("oturum çerezi bayrakları", () => {
  it("varsayılan çerez HttpOnly/SameSite=Lax/Path=/ taşır, Secure taşımaz", () => {
    const cookie = buildSessionCookie("token-abc", false);
    expect(cookie).toContain("vf_session=token-abc");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain(`Max-Age=${SESSION_TTL_MS / 1000}`);
    expect(cookie).not.toContain("Secure");
  });

  it("secure=true çereze Secure bayrağı ekler, token'ı bozmaz", () => {
    const token = createSessionToken("tenant-1", SECRET);
    const cookie = buildSessionCookie(token, true);
    expect(cookie).toContain(`vf_session=${token}`);
    expect(cookie.endsWith("; Secure")).toBe(true);
    expect(cookie).toContain("HttpOnly");
  });

  it("logout çerezi değeri boşaltır ve Max-Age=0 verir; secure bayrağı taşınır", () => {
    expect(buildLogoutCookie(false)).toBe("vf_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
    expect(buildLogoutCookie(true)).toBe(
      "vf_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0; Secure",
    );
  });
});
