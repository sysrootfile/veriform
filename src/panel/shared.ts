/**
 * Panel adapter'ları için paylaşılan yardımcılar — drift önleme:
 * iki adapter'ın da aynı yardımcıları kullanması sözleşme birliğini korur.
 */

/** WebCrypto ile 64 hex karakter rastgele token (tarayıcı/Node uyumlu). */
export function randomIngestToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function deepClone<T>(value: T): T {
  return structuredClone(value);
}
