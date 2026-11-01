/**
 * Ağ/form hedefi çözümleme — GİZLİLİK-KRİTİK saf fonksiyon.
 * Çıktı yalnızca origin + path içerir; query string ve hash BURADA atılır,
 * çünkü GET form gönderimlerinde kişisel değerler query'de yaşar.
 */
export interface RequestTarget {
  origin: string;
  path: string;
  /** Kaynağı belirtir: form submit / fetch / XHR. */
  method?: string | undefined;
  via?: "form" | "fetch" | "xhr" | undefined;
}

export function parseRequestTarget(url: string, base?: string): RequestTarget | undefined {
  try {
    const u = new URL(url, base);
    return { origin: u.origin, path: u.pathname };
  } catch {
    return undefined;
  }
}
