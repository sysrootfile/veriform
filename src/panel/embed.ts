/**
 * Embed script serve ucu — build çıktısı (dist/veriform-embed.js) panelin
 * kendi adresinden sunulur; müşterinin sitesine takılan snippet bu adresi gösterir.
 * Dosya okuyucu enjekte edilir: testte gerçek build gerekmez.
 */

export interface EmbedJsResult {
  status: number;
  contentType: string;
  body: string;
  cacheControl?: string;
}

export async function handleEmbedJs(read: () => Promise<string>): Promise<EmbedJsResult> {
  try {
    const body = await read();
    return {
      status: 200,
      contentType: "application/javascript; charset=utf-8",
      body,
      cacheControl: "public, max-age=3600",
    };
  } catch {
    return {
      status: 404,
      contentType: "text/plain; charset=utf-8",
      body: "embed build bulunamadı — pnpm build:embed ile üretin",
    };
  }
}