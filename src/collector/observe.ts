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

/**
 * Gözlemlenen pencere — gerçek Window'la yapısal uyum; testte happy-dom
 * penceresi bu arayüze doğrudan uyar. lib.dom'a bağlanmadan test edilebilir.
 */
export interface NetworkWindow {
  location: { href: string };
  fetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<unknown>;
  XMLHttpRequest: typeof XMLHttpRequest;
}

/** fetch ve XHR açılış hedeflerini gözlemler; detach orijinalleri restore eder. */
export function observeNetwork(
  win: NetworkWindow,
  onRequest: (t: RequestTarget) => void,
): () => void {
  const base = win.location.href;

  const origFetch = win.fetch;
  if (origFetch) {
    win.fetch = (input, init) => {
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const target = parseRequestTarget(url, base);
      if (target) {
        target.method = (init?.method ?? "GET").toUpperCase();
        target.via = "fetch";
        onRequest(target);
      }
      return origFetch(input, init);
    };
  }

  const xhrProto = win.XMLHttpRequest.prototype;
  const origOpen = xhrProto.open;
  xhrProto.open = function (this: XMLHttpRequest, method: string, url: string | URL) {
    const target = parseRequestTarget(String(url), base);
    if (target) {
      target.method = String(method).toUpperCase();
      target.via = "xhr";
      onRequest(target);
    }
    // v0: bildirim open anında; send/gövde ile ilgilenmiyoruz.
    return (origOpen as (m: string, u: string | URL) => void).apply(this, [
      method,
      url,
    ]);
  } as typeof xhrProto.open;

  return () => {
    if (origFetch) win.fetch = origFetch;
    xhrProto.open = origOpen;
  };
}
