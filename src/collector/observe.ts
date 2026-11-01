import { parseRequestTarget, type RequestTarget } from "./targets.js";

/**
 * Gönderim ve ağ hedefi gözlemcileri.
 * MİMARİ İLKE: gözlemciler yalnızca parseRequestTarget çıktısını (origin+path)
 * bildirir — gövde/payload/parametre değeri hiçbir noktada okunmaz veya
 * saklanmaz. XHR/fetch sarmalayıcıları orijinal çağrıyı değiştirmeden geçirir.
 */

export interface SubmissionNotice {
  form: HTMLFormElement;
  target: RequestTarget;
}

/** Form submit'lerini yakalar (capture); detach fonksiyonu döner. */
export function observeSubmissions(
  doc: Document,
  onSubmission: (n: SubmissionNotice) => void,
): () => void {
  const handler = (e: Event) => {
    const form = e.target;
    if (!(form instanceof HTMLFormElement)) return;
    const base = doc.defaultView?.location.href;
    const action = form.getAttribute("action") || base || "";
    const target = parseRequestTarget(action, base);
    if (!target) return;
    target.via = "form";
    target.method = (form.getAttribute("method") ?? "get").toUpperCase();
    onSubmission({ form, target });
  };
  doc.addEventListener("submit", handler, true);
  return () => doc.removeEventListener("submit", handler, true);
}
