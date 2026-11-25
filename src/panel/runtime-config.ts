/**
 * Açılışta çözülen çalışma yapılandırması. Postgres modunda PANEL_URL zorunludur:
 * hesap maillerindeki bağlantılar istek Host başlığından türetilirse saldırgan
 * kendi adresini gösteren sıfırlama bağlantısı üretebilir.
 */
export function resolvePanelUrl(env: Record<string, string | undefined>): string | null {
  const raw = env.PANEL_URL?.trim();
  if (!raw) {
    if (env.DATABASE_URL) {
      throw new Error(
        "PANEL_URL zorunlu: Postgres modunda mail bağlantılarının kök adresi istek Host başlığından türetilemez",
      );
    }
    return null;
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("PANEL_URL geçersiz: http(s) kök adres olmalı (örn. https://panel.veriform.io)");
  }
  const isHttp = url.protocol === "http:" || url.protocol === "https:";
  const clean = !url.username && !url.password && !url.search && !url.hash;
  if (!isHttp || !url.hostname || !clean) {
    throw new Error("PANEL_URL geçersiz: http(s) kök adres olmalı (örn. https://panel.veriform.io)");
  }
  return url.origin + url.pathname.replace(/\/+$/, "");
}

/** İstekten (Host başlığından) hiçbir girdi almaz: bağlantı kökü yalnız yapılandırmadan gelir. */
export function mailBaseUrl(panelUrl: string | null, port: number): string {
  return panelUrl ?? `http://127.0.0.1:${port}`;
}
