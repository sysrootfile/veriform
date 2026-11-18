/**
 * Self-host font serve ucu — yalnız beyaz listedeki woff2 adları okunur.
 * Dosya okuyucu enjekte edilir: testte gerçek build gerekmez.
 */

export const FONT_FILES = [
  "archivo-latin.woff2",
  "archivo-latin-ext.woff2",
  "spline-mono-latin.woff2",
  "spline-mono-latin-ext.woff2",
] as const;

export interface FontAssetResult {
  status: number;
  contentType: string;
  body?: Buffer;
  cacheControl?: string;
}

export async function handleFontAsset(
  name: string,
  read: (name: string) => Promise<Buffer>,
): Promise<FontAssetResult> {
  if (!(FONT_FILES as readonly string[]).includes(name)) {
    return { status: 404, contentType: "text/plain; charset=utf-8" };
  }
  try {
    const body = await read(name);
    return {
      status: 200,
      contentType: "font/woff2",
      body,
      cacheControl: "public, max-age=31536000, immutable",
    };
  } catch {
    return { status: 404, contentType: "text/plain; charset=utf-8" };
  }
}