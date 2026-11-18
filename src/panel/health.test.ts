import { describe, expect, it } from "vitest";
import { checkHealth } from "./health.js";
import { createInMemoryPanelStore } from "./store.js";

describe("checkHealth", () => {
  it("depoya gerçekten ping atar ve ok:true döner", async () => {
    let pings = 0;
    const store = {
      ping: async () => {
        pings += 1;
      },
    };
    const result = await checkHealth(store, "postgres");
    expect(pings).toBe(1);
    expect(result).toEqual({ ok: true, store: "postgres" });
  });

  it("ping başarısızsa ok:false döner — süreç ayakta olsa bile", async () => {
    const store = {
      ping: async () => {
        throw new Error("password authentication failed for user \"postgres\"");
      },
    };
    expect(await checkHealth(store, "postgres")).toEqual({ ok: false, store: "postgres" });
  });

  it("in-memory depoda ok:true ve store:memory döner", async () => {
    expect(await checkHealth(createInMemoryPanelStore(), "memory")).toEqual({
      ok: true,
      store: "memory",
    });
  });
});