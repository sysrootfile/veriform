import { purposesFromDecisions } from "./tcf.js";
import type { ConsentDecisions } from "./state.js";

/**
 * TCF 2.2 __tcfapi sinyal yüzeyi — banner kararlarını sayfa geni API'ye köprüler.
 * Dürüst sınır: tcString, IAB Europe CMP kaydı ve GVL sürümü sonraki işte;
 * o zamana kadar boş döner ve consumers kayıtlı CMP olmadığını görür.
 */

export interface TcfApiWindow {
  __tcfapi?: TcfApiFunction | undefined;
}

export type TcfApiFunction = (
  command: string,
  version: number,
  callback: (data: unknown, success: boolean) => void,
  parameter?: unknown,
) => void;

export interface TcfApiInstall {
  /** Banner kararı değişince çağır — dinleyiciler useractioncomplete alır. */
  notifyChange(): void;
  detach(): void;
}

interface TcData {
  tcString: string;
  gdprApplies: boolean;
  eventStatus: "tcloaded" | "useractioncomplete";
  cmpStatus: "loaded";
  apiVersion: "2.2";
  listenerId?: number | undefined;
  purpose: { consents: boolean[]; legitimateInterests: boolean[] };
  purposeOneTreatment: boolean;
}

export function installTcfApi(
  win: TcfApiWindow,
  getDecisions: () => ConsentDecisions,
): TcfApiInstall {
  const previous = win.__tcfapi;
  const listeners = new Map<number, (data: TcData, success: boolean) => void>();
  let nextListenerId = 1;

  function buildTcData(eventStatus: TcData["eventStatus"], listenerId?: number): TcData {
    const { consents, legitimateInterests } = purposesFromDecisions(getDecisions());
    return {
      tcString: "", // IAB kaydı sonrası gerçek TC String üretimi
      gdprApplies: true,
      eventStatus,
      cmpStatus: "loaded",
      apiVersion: "2.2",
      ...(listenerId !== undefined ? { listenerId } : {}),
      purpose: { consents, legitimateInterests },
      purposeOneTreatment: true,
    };
  }

  const api: TcfApiFunction = (command, _version, callback, parameter) => {
    if (command === "ping") {
      callback(
        {
          gdprApplies: true,
          cmpLoaded: true,
          cmpStatus: "loaded",
          displayStatus: "hidden",
          apiVersion: "2.2",
          cmpId: 0,
          cmpVersion: 1,
          gvlVersion: 0,
          tcfPolicyVersion: 4,
        },
        true,
      );
      return;
    }
    if (command === "getTCData") {
      callback(buildTcData("tcloaded"), true);
      return;
    }
    if (command === "addEventListener") {
      const id = nextListenerId++;
      const listener = (data: TcData, success: boolean) => callback({ ...data, listenerId: id }, success);
      listeners.set(id, listener);
      listener(buildTcData("tcloaded"), true);
      return;
    }
    if (command === "removeEventListener") {
      const id = typeof parameter === "number" ? parameter : Number(parameter);
      const removed = listeners.delete(id);
      callback(removed, removed);
      return;
    }
    callback(null, false);
  };

  win.__tcfapi = api;

  return {
    notifyChange() {
      const data = buildTcData("useractioncomplete");
      for (const listener of listeners.values()) listener(data, true);
    },
    detach() {
      if (previous) win.__tcfapi = previous;
      else delete win.__tcfapi;
      listeners.clear();
    },
  };
}
