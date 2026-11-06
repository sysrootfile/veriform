import { timingSafeEqual } from "node:crypto";

/**
 * Panel boot'unun gizli anahtar kapısı.
 * Default değer yok: eksik ya da geliştirme işareti olan anahtar boot'u durdurur.
 * Worker token'ı oturum anahtarından ayrıdır — imzalama anahtarı header'da
 * API anahtarı gibi dolaşmaz; iki anahtarın eşit olması da config hatası sayılır.
 */

/** Bu repoda dolaşan sabit geliştirme değerleri — gerçek anahtar olarak kabul edilmez. */
const PLACEHOLDER_SECRETS = new Set(["dev-secret-change-me", "veriform", "changeme", "secret"]);

export interface PanelSecrets {
  sessionSecret: string;
  /** null = HTTP worker tetikleyicisi kapalı demek (her çağrı 403). */
  workerToken: string | null;
}

function read(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function resolvePanelSecrets(env: Record<string, string | undefined>): PanelSecrets {
  const sessionSecret = read(env.SESSION_SECRET);
  if (!sessionSecret) {
    throw new Error("SESSION_SECRET ayarlı değil — güçlü bir değer ver (örn. `openssl rand -hex 32`)");
  }
  if (PLACEHOLDER_SECRETS.has(sessionSecret.toLowerCase())) {
    throw new Error("SESSION_SECRET hâlâ geliştirme işareti — gerçek bir anahtarla değiştir");
  }

  const workerToken = read(env.WORKER_TOKEN);
  if (workerToken && workerToken === sessionSecret) {
    throw new Error("WORKER_TOKEN, SESSION_SECRET ile aynı — tetikleyici anahtarını oturum anahtarından ayır");
  }
  return { sessionSecret, workerToken };
}

/** Zamanlamaya duyarsız token karşılaştırması; uzunluk farkı throw etmeden reddedilir. */
export function verifyWorkerToken(presented: string | undefined, expected: string | null): boolean {
  if (!expected) return false;
  const given = Buffer.from(presented ?? "", "utf8");
  const wanted = Buffer.from(expected, "utf8");
  return given.length === wanted.length && timingSafeEqual(given, wanted);
}
