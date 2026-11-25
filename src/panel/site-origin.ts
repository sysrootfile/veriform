/**
 * Site anahtarı domain bağı — anahtar sayfa kaynağında görünür olduğu için
 * tek başına secret değildir; sunucu, tarayıcının bildirdiği origin'i kayıtlı
 * site adresiyle karşılaştırır (Turnstile/hCaptcha sitekey normu).
 * Origin tarayıcıda taklit edilemez; header'sız istekler tarayıcı dışıdır.
 */

function hostOf(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host.startsWith("www.") ? host.slice(4) : host;
  } catch {
    return null;
  }
}

export function siteHostOf(siteUrl: string): string | null {
  return hostOf(siteUrl);
}

/** Kayıtlı host'un kendisi veya alt domainleri (www her iki tarafta soyulur). */
export function requestOriginAllowed(
  siteUrl: string,
  origin: string | undefined,
  referer: string | undefined,
): boolean {
  const registered = siteHostOf(siteUrl);
  if (!registered) return false;
  const requester = hostOf(origin) ?? hostOf(referer);
  if (!requester) return false;
  return requester === registered || requester.endsWith(`.${registered}`);
}