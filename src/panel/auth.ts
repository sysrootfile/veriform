import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

/**
 * Panel kimlik doğrulama temeli:
 * - Şifreler scrypt (tuzlu) ile saklanır — düz metin veya tersine döndürülebilir form yok.
 * - Oturum, sunucuda depolanmayan imzalı token'dır (HMAC-SHA256): kiracı kimliği +
 *   bitiş zamanı imzalanır; 7 gün geçerli. Gizli anahtar SESSION_SECRET ortam değişkenidir.
 */

export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 32);
  return `scrypt:${salt.toString("hex")}:${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltHex, keyHex] = stored.split(":");
  if (scheme !== "scrypt" || !saltHex || !keyHex) return false;
  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(saltHex, "hex");
    expected = Buffer.from(keyHex, "hex");
  } catch {
    return false;
  }
  let key: Buffer;
  try {
    key = await scrypt(password, salt, 32);
  } catch {
    return false;
  }
  return key.length === expected.length && timingSafeEqual(key, expected);
}

export function createSessionToken(tenantId: string, secret: string, now = Date.now()): string {
  const payload = `${tenantId}.${now + SESSION_TTL_MS}`;
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${Buffer.from(payload).toString("base64url")}.${signature}`;
}

export function verifySessionToken(token: string, secret: string, now = Date.now()): string | null {
  const [payloadB64, signature] = token.split(".");
  if (!payloadB64 || !signature) return null;
  let payload: string;
  try {
    payload = Buffer.from(payloadB64, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  const given = Buffer.from(signature);
  const wanted = Buffer.from(expected);
  if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) return null;

  const [tenantId, expRaw] = payload.split(".");
  const exp = Number(expRaw);
  if (!tenantId || !Number.isFinite(exp) || exp <= now) return null;
  return tenantId;
}

/**
 * Anahtar rotasyonu: çerez tek bir anahtarla değil, kabul listesiyle doğrulanır.
 * Liste sıralıdır — yeni anahtar başta, devrede tutulan eski anahtar(lar) sonda.
 * Eski anahtar listeden çıkınca o anahtarla açılmış oturumlar düşer.
 */
export function verifySessionTokenAny(
  token: string,
  secrets: readonly string[],
  now = Date.now(),
): string | null {
  for (const secret of secrets) {
    const tenantId = verifySessionToken(token, secret, now);
    if (tenantId) return tenantId;
  }
  return null;
}

/** Secure bayrağı yalnız TLS arkasında anlamlıdır; düz HTTP'de çerezi tamamen düşürür. */
export function buildSessionCookie(token: string, secure: boolean): string {
  const base = `vf_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_MS / 1000}`;
  return secure ? `${base}; Secure` : base;
}

export function buildLogoutCookie(secure: boolean): string {
  const base = "vf_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0";
  return secure ? `${base}; Secure` : base;
}
