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

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

/** Uygunsa null, değilse kullanıcıya gösterilecek gerekçe. */
export function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return "şifre en az 8 karakter olmalı";
  if (password.length > PASSWORD_MAX_LENGTH) return "şifre en fazla 128 karakter olabilir";
  return null;
}

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
  const payload = `${tenantId}.${now}.${now + SESSION_TTL_MS}`;
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${Buffer.from(payload).toString("base64url")}.${signature}`;
}

export interface SessionClaims {
  tenantId: string;
  /** Veriliş anı (ms). Yeni üç parçalı olmayan eski tokenlarda 0.
   * sessionsValidAfter'dan küçükse oturum düşürülmüş demektir. */
  issuedAt: number;
}

function readClaims(token: string, secret: string, now: number): SessionClaims | null {
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

  const parts = payload.split(".");
  const exp = Number(parts.at(-1));
  // Eski token iki parçalıydı (kiracı.son); yeni format üç parçalı (kiracı.veriliş.son)
  const issuedAt = parts.length >= 3 ? Number(parts.at(-2)) : 0;
  const tenantId = (parts.length >= 3 ? parts.slice(0, -2) : parts.slice(0, 1)).join(".");
  if (!tenantId || !Number.isFinite(exp) || !Number.isFinite(issuedAt) || exp <= now) return null;
  return { tenantId, issuedAt };
}

export function verifySessionToken(token: string, secret: string, now = Date.now()): string | null {
  return readClaims(token, secret, now)?.tenantId ?? null;
}

/**
 * Anahtar rotasyonu: çerez tek bir anahtarla değil, kabul listesiyle doğrulanır.
 * Liste sıralıdır — yeni anahtar başta, devrede tutulan eski anahtar(lar) sonda.
 * Eski anahtar listeden çıkınca o anahtarla açılmış oturumlar düşer.
 */
export function verifySessionClaims(
  token: string,
  secrets: readonly string[],
  now = Date.now(),
): SessionClaims | null {
  for (const secret of secrets) {
    const claims = readClaims(token, secret, now);
    if (claims) return claims;
  }
  return null;
}

export function verifySessionTokenAny(
  token: string,
  secrets: readonly string[],
  now = Date.now(),
): string | null {
  return verifySessionClaims(token, secrets, now)?.tenantId ?? null;
}

/** Oturum düşürme: veriliş anı, kullanıcının şifre değiştirme/sıfırlama anından önceyse geçersiz. */
export function isSessionRevoked(claims: SessionClaims, sessionsValidAfter: string): boolean {
  return claims.issuedAt < Date.parse(sessionsValidAfter);
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
