import type { PanelStore } from "./store.js";

/** Canlılık kontrolü: depo ping'i başarısızsa ok:false — süreç ayakta olsa bile DB kırık demektir. */

export interface HealthStatus {
  ok: boolean;
  store: "postgres" | "memory";
}

export async function checkHealth(
  store: Pick<PanelStore, "ping">,
  kind: HealthStatus["store"],
): Promise<HealthStatus> {
  try {
    await store.ping();
    return { ok: true, store: kind };
  } catch {
    return { ok: false, store: kind };
  }
}