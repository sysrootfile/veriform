import type { ConsentReceipt } from "../consent/receipt.js";

/**
 * Banner kararını panelin kanıt zincirine yazan köprü. Gönderim başarısızsa
 * kanıt bellekte bekler (sessizce kaybolmaz); sonraki push bekleyenleri de
 * tekrar dener, sayfa kapanırken beacon son şansı verir.
 */

const MAX_PENDING = 50;

export interface ReceiptPusherOptions {
  panelOrigin: string;
  token: string;
  fetchImpl?: (url: string, init: RequestInit) => Promise<Response>;
  beaconImpl?: (url: string, body: string) => boolean;
}

export interface ReceiptPusher {
  push(receipt: ConsentReceipt): Promise<void>;
  flushBeacon(): void;
  pendingCount(): number;
}

export function createReceiptPusher(options: ReceiptPusherOptions): ReceiptPusher {
  const doFetch = options.fetchImpl ?? ((url: string, init: RequestInit) => fetch(url, init));
  const beacon =
    options.beaconImpl ??
    ((url, body) => navigator.sendBeacon(url, new Blob([body], { type: "application/json" })));
  const url = `${options.panelOrigin}/api/ingest/scan/receipt`;
  const pending: ConsentReceipt[] = [];

  const send = async (receipt: ConsentReceipt): Promise<boolean> => {
    try {
      const res = await doFetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: options.token, receipt }),
      });
      return res.ok;
    } catch {
      return false;
    }
  };

  return {
    async push(receipt) {
      const queue = [...pending, receipt];
      pending.length = 0;
      for (const item of queue) {
        if (!(await send(item))) {
          pending.push(item);
        }
      }
      if (pending.length > MAX_PENDING) pending.splice(0, pending.length - MAX_PENDING);
    },
    flushBeacon() {
      while (pending.length > 0) {
        const item = pending.shift()!;
        beacon(url, JSON.stringify({ token: options.token, receipt: item }));
      }
    },
    pendingCount: () => pending.length,
  };
}