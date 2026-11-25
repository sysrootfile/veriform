import { isIP } from "node:net";

/**
 * Limiter anahtarı: proxy arkasında soket adresi tünel konteynerinin IP'sidir ve
 * tüm ziyaretçiler tek kovayı paylaşır. Güven yalnızca soket adresi özel ağ/loopback
 * ise verilir — herkese açık istemcinin kendi X-Forwarded-For'u spoofing'dir.
 */

function isPrivateAddress(address: string | undefined): boolean {
  if (!address) return false;
  const mapped = address.startsWith("::ffff:") ? address.slice(7) : address;
  const version = isIP(mapped);
  if (version === 4) {
    const [a, b] = mapped.split(".").map(Number);
    return (
      a === 127 ||
      a === 10 ||
      (a === 172 && b !== undefined && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254)
    );
  }
  if (version === 6) {
    const lower = mapped.toLowerCase();
    return lower === "::1" || lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80");
  }
  return false;
}

export function resolveClientIp(
  remoteAddress: string | undefined,
  forwardedFor: string | string[] | undefined,
  trustProxy: boolean,
): string {
  const socketIp = remoteAddress ?? "bilinmeyen";
  if (!trustProxy || !isPrivateAddress(remoteAddress)) return socketIp;
  const header = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
  const first = header?.split(",")[0]?.trim();
  return first && isIP(first) !== 0 ? first : socketIp;
}