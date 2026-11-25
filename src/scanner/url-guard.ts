import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * SSRF kalkanı: tarayıcı yalnızca genel internetteki http(s) adreslerini ziyaret eder.
 * Panelin ve bulut sağlayıcının kendi ağı (docker servisleri, metadata ucu) hedef alınamaz.
 */

type AddressRecord = { address: string; family: number };
type Resolver = (hostname: string) => Promise<AddressRecord[]>;

const dnsLookup: Resolver = (hostname) => lookup(hostname, { all: true, verbatim: true });

export class UnsafeTargetError extends Error {
  constructor(reason: string) {
    super(`adres taranamaz: ${reason}`);
    this.name = "UnsafeTargetError";
  }
}

// [a, b, c, d, bit] — RFC 1918, loopback, bağlantı yereli, paylaşılan adres alanı vb.
const V4_RANGES: ReadonlyArray<readonly [number, number, number, number, number]> = [
  [0, 0, 0, 0, 8],
  [10, 0, 0, 0, 8],
  [100, 64, 0, 0, 10],
  [127, 0, 0, 0, 8],
  [169, 254, 0, 0, 16],
  [172, 16, 0, 0, 12],
  [192, 168, 0, 0, 16],
  [198, 18, 0, 0, 15],
  [224, 0, 0, 0, 4],
  [240, 0, 0, 0, 4],
];

function isPublicIpv4(octets: number[]): boolean {
  const blocked = V4_RANGES.some(([a, b, c, d, bits]) => {
    const base = [a, b, c, d];
    let i = 0;
    for (let whole = bits; whole >= 8; whole -= 8, i++) {
      if (octets[i] !== base[i]) return false;
    }
    const rest = bits - i * 8;
    return rest === 0 || octets[i]! >> (8 - rest) === base[i]! >> (8 - rest);
  });
  return !blocked;
}

function octetsOfV4(value: number): number[] {
  return [value >>> 24, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
}

function parseIpv6(input: string): number[] {
  const withoutV4 = input.replace(
    /(\d+)\.(\d+)\.(\d+)\.(\d+)$/,
    (_m, a: string, b: string, c: string, d: string) =>
      (((Number(a) << 8) | Number(b)).toString(16)) + ":" + ((Number(c) << 8) | Number(d)).toString(16),
  );
  const [head = "", tail = ""] = withoutV4.split("::");
  const headGroups = head ? head.split(":") : [];
  const tailGroups = tail ? tail.split(":") : [];
  const middle = Array(8 - headGroups.length - tailGroups.length).fill("0");
  return [...headGroups, ...middle, ...tailGroups].map((group) => parseInt(group, 16));
}

export function isPublicAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) {
    return isPublicIpv4(address.split(".").map(Number));
  }
  if (version === 6) {
    const groups = parseIpv6(address.split("%")[0]!);
    const first = groups[0]!;
    if ((first & 0xfe00) === 0xfc00) return false; // fc00::/7 özel ağ
    if ((first & 0xffc0) === 0xfe80) return false; // fe80::/10 bağlantı yereli
    if ((first & 0xff00) === 0xff00) return false; // ff00::/8 çoklu yayın
    const embedsV4 =
      groups.slice(0, 5).every((group) => group === 0) &&
      (groups[5] === 0 || groups[5] === 0xffff);
    if (!embedsV4) return true;
    return isPublicIpv4(
      octetsOfV4((((groups[6]! << 16) | groups[7]!) >>> 0)),
    );
  }
  return false;
}

function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return host === "localhost" || host.endsWith(".localhost");
}

function assertLiteralHost(host: string): void {
  if (isBlockedHostname(host) || (isIP(host) !== 0 && !isPublicAddress(host))) {
    throw new UnsafeTargetError("adres özel ağda");
  }
}

/** Sözdizimi ve sabit adres denetimi; DNS çözümü yapılmaz. Site kaydı anında kullanılır. */
export function assertPublicHttpUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeTargetError("geçersiz adres");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsafeTargetError("yalnızca http ve https adresleri taranabilir");
  }
  if (!url.hostname || url.username || url.password) {
    throw new UnsafeTargetError("adres eksik ya da kullanıcı bilgisi içeriyor");
  }
  assertLiteralHost(url.hostname.replace(/^\[|\]$/g, ""));
  return url;
}

/** Alan adını çözer; herhangi bir kayıt özel ağdaysa reddeder. Taramadan hemen önce çağrılır. */
export async function assertPublicTarget(url: URL, resolve: Resolver = dnsLookup): Promise<void> {
  const host = url.hostname.replace(/^\[|\]$/g, "");
  assertLiteralHost(host);
  if (isIP(host) !== 0) return;
  const records = await resolve(host);
  if (records.length === 0) throw new UnsafeTargetError(`${host} çözülemiyor`);
  if (records.some((record) => !isPublicAddress(record.address))) {
    throw new UnsafeTargetError(`${host} özel ağ adresine çözülüyor`);
  }
}
