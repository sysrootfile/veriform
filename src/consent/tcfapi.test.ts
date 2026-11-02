import { describe, expect, it, vi } from "vitest";
import type { ConsentDecisions } from "./state.js";
import { installTcfApi, type TcfApiFunction, type TcfApiWindow } from "./tcfapi.js";

const DENY: ConsentDecisions = { analytics: false, marketing: false, personalization: false };
const GRANT: ConsentDecisions = { analytics: true, marketing: true, personalization: true };

describe("installTcfApi", () => {
  it("ping komutu TCF 2.2 biçiminde yanıt verir", () => {
    const win: TcfApiWindow = {};
    const install = installTcfApi(win, () => DENY);
    const cb = vi.fn();
    win.__tcfapi!("ping", 2, cb as never);
    expect(cb).toHaveBeenCalledOnce();
    const [data, success] = cb.mock.calls[0]!;
    expect(success).toBe(true);
    expect(data).toMatchObject({ cmpLoaded: true, cmpStatus: "loaded", apiVersion: "2.2" });
    install.detach();
  });

  it("getTCData kararları amaç dizisine çevirir; tcString IAB kaydına kadar boştur", () => {
    const win: TcfApiWindow = {};
    const install = installTcfApi(win, () => DENY);
    const cb = vi.fn();
    win.__tcfapi!("getTCData", 2, cb as never);
    const [data, success] = cb.mock.calls[0]! as [{ purpose: { consents: boolean[] } }, boolean];
    expect(success).toBe(true);
    expect(data.purpose.consents[0]).toBe(true);
    expect(data.purpose.consents.slice(1).every((c) => !c)).toBe(true);
    expect((cb.mock.calls[0]![0] as { tcString: string }).tcString).toBe("");
    install.detach();
  });

  it("karar değişince (notifyChange) dinleyiciler useractioncomplete ile tekrar çağrılır", () => {
    const win: TcfApiWindow = {};
    let current = DENY;
    const install = installTcfApi(win, () => current);

    const cb = vi.fn();
    win.__tcfapi!("addEventListener", 2, cb as never);
    expect(cb).toHaveBeenCalledTimes(1);
    const listenerId = (cb.mock.calls[0]![0] as { listenerId: number }).listenerId;

    current = GRANT;
    install.notifyChange();
    expect(cb).toHaveBeenCalledTimes(2);
    const second = cb.mock.calls[1]![0] as { eventStatus: string; purpose: { consents: boolean[] } };
    expect(second.eventStatus).toBe("useractioncomplete");
    expect(second.purpose.consents.every((c) => c)).toBe(true);

    win.__tcfapi!("removeEventListener", 2, (ok: unknown) => expect(ok).toBe(true), listenerId);
    install.notifyChange();
    expect(cb).toHaveBeenCalledTimes(2); // dinleyici söküldü
    install.detach();
  });

  it("bilinmeyen komut (null, false) döndürür", () => {
    const win: TcfApiWindow = {};
    const install = installTcfApi(win, () => DENY);
    const cb = vi.fn();
    win.__tcfapi!("bilinmeyen", 2, cb as never);
    expect(cb).toHaveBeenCalledWith(null, false);
    install.detach();
  });

  it("detach önceki __tcfapi'yi geri yükler", () => {
    const previous = vi.fn();
    const win: TcfApiWindow = { __tcfapi: previous };
    const install = installTcfApi(win, () => DENY);
    expect(win.__tcfapi).not.toBe(previous);
    install.detach();
    expect(win.__tcfapi).toBe(previous);
  });
});
