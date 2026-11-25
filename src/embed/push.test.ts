import { describe, expect, it, vi } from "vitest";
import { buildConsentReceipt, type ConsentReceipt } from "../consent/receipt.js";
import { createReceiptPusher } from "./push.js";

/**
 * Banner kararı tarayıcıda kalırsa kanıt zinciri boş kalır; sektör normu
 * (CMP'ler) seçimin anında sunucuya yazılmasıdır. Gönderim başarısızsa
 * kanıt bellekte bekler, sonraki denemede tekrar gider, sayfa kapanırken
 * beacon ile son şansını kullanır.
 */

const receipt = (n: number): Promise<ConsentReceipt> =>
  buildConsentReceipt({
    site: "https://musteri1.com",
    bannerVersion: "banner-2026-11",
    textsHash: "aaa111",
    decisions: { analytics: true, marketing: false, personalization: false },
    timestamp: `2026-11-01T10:00:0${n}.000Z`,
  });

function fetchStub(ok: boolean) {
  return vi.fn(async (_url: string, _init?: RequestInit) => ({ ok }) as Response);
}

describe("createReceiptPusher", () => {
  it("kanıtı token'la receipt ucuna POST'lar", async () => {
    const fetchImpl = fetchStub(true);
    const pusher = createReceiptPusher({
      panelOrigin: "https://panel.test",
      token: "TOKEN",
      fetchImpl,
    });
    const r = await receipt(1);
    await pusher.push(r);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toBe("https://panel.test/api/ingest/scan/receipt");
    expect(init!.method).toBe("POST");
    expect(JSON.parse(String(init!.body))).toMatchObject({ token: "TOKEN", receipt: { selfHash: r.selfHash } });
    expect(pusher.pendingCount()).toBe(0);
  });

  it("başarısız gönderim kanıtı düşürmez; sonraki push bekleyenleri de giderir", async () => {
    const fetchImpl = vi
      .fn<() => Promise<Response>>()
      .mockResolvedValueOnce({ ok: false } as Response)
      .mockResolvedValue({ ok: true } as Response);
    const pusher = createReceiptPusher({ panelOrigin: "https://panel.test", token: "T", fetchImpl });
    const r1 = await receipt(1);
    const r2 = await receipt(2);
    await pusher.push(r1);
    expect(pusher.pendingCount()).toBe(1);
    await pusher.push(r2);
    expect(pusher.pendingCount()).toBe(0);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("ağ hatası da beklemeye düşer, sessizce kaybolmaz", async () => {
    const fetchImpl = vi.fn<() => Promise<Response>>().mockRejectedValue(new Error("ağ yok"));
    const pusher = createReceiptPusher({ panelOrigin: "https://panel.test", token: "T", fetchImpl });
    await pusher.push(await receipt(1));
    expect(pusher.pendingCount()).toBe(1);
  });

  it("beacon bekleyen kanıtları tek tek son kez gönderir", async () => {
    const fetchImpl = fetchStub(false);
    const beacon = vi.fn((_url: string, _body: string) => true);
    const pusher = createReceiptPusher({
      panelOrigin: "https://panel.test",
      token: "T",
      fetchImpl,
      beaconImpl: beacon,
    });
    await pusher.push(await receipt(1));
    await pusher.push(await receipt(2));
    expect(pusher.pendingCount()).toBe(2);
    pusher.flushBeacon();
    expect(beacon).toHaveBeenCalledTimes(2);
    for (const [url, body] of beacon.mock.calls) {
      expect(String(url)).toBe("https://panel.test/api/ingest/scan/receipt");
      expect(JSON.parse(String(body))).toMatchObject({ token: "T" });
    }
    expect(pusher.pendingCount()).toBe(0);
  });

  it("bekleyen yoksa beacon çağırmaz", () => {
    const beacon = vi.fn((_url: string, _body: string) => true);
    const pusher = createReceiptPusher({
      panelOrigin: "https://panel.test",
      token: "T",
      fetchImpl: fetchStub(true),
      beaconImpl: beacon,
    });
    pusher.flushBeacon();
    expect(beacon).not.toHaveBeenCalled();
  });
});