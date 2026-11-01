import { initVeriform, type EmbedHandle } from "./core.js";

declare global {
  interface Window {
    __veriform?: EmbedHandle;
  }
}

/**
 * Tarayıcı giriş noktası (IIFE bundle) — test edilebilir tüm mantık core.ts'te;
 * burada yalnızca gerçek global'lerle bağlanır ve global tanıtıcı açılır.
 */
const w = window as Window & { __veriform?: EmbedHandle };
const handle = initVeriform(document, w);
w.__veriform = handle;

console.info("[Veriform] Form envanteri hazır:", handle.getReport());
console.info("[Veriform] Canlı hedefler: window.__veriform.getObservedTargets()");
