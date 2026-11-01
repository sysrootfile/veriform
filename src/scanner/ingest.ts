import type { RequestTarget } from "../collector/targets.js";
import type { ScanCookie } from "../panel/types.js";
import type { FormInventoryReport } from "../report/types.js";

/**
 * Tarayıcı → panel köprüsü: tarama sonucunu panelin /api/ingest/scan
 * ucuna site token'ıyla POST'lar. Panel reddi (401/422) hata olarak yansır.
 */

export interface ScanIngestPayload {
  report: FormInventoryReport;
  cookies: ScanCookie[];
  observedTargets: RequestTarget[];
}

export async function postScanToPanel(
  panelUrl: string,
  token: string,
  payload: ScanIngestPayload,
): Promise<{ id: string }> {
  const response = await fetch(new URL("/api/ingest/scan", panelUrl), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token, ...payload }),
  });
  const body = (await response.json().catch(() => ({}))) as { id?: string; error?: string };
  if (!response.ok) {
    throw new Error(body.error ?? `panel reddetti: HTTP ${response.status}`);
  }
  return { id: body.id! };
}
