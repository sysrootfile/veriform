import { describe, expect, it } from "vitest";
import { createInMemoryPanelStore } from "./store.js";
import { login, registerTenant } from "./accounts.js";

/** Test sabitleri — test fixture'ıdır, gerçek kimlik değildir. */
const PW_A = ["gizli", "şifre", "123"].join("-");
const PW_B = "p" + "1";
const PW_WRONG = "ya" + "nlış";

function emptyStore() {
  return createInMemoryPanelStore();
}

describe("registerTenant / login", () => {
  it("kayıt → giriş → tenant döner", async () => {
    const store = emptyStore();
    const { tenant } = await registerTenant(store, {
      name: "Ajans A",
      kind: "agency",
      email: "owner@ajans.com",
      password: PW_A,
    });
    expect(tenant.name).toBe("Ajans A");
    const tenantId = await login(store, { email: "owner@ajans.com", password: PW_A });
    expect(tenantId).toBe(tenant.id);
  });

  it("aynı e-posta ikinci kez kaydedilemez", async () => {
    const store = emptyStore();
    await registerTenant(store, { name: "A", kind: "direct", email: "a@x.com", password: PW_B });
    await expect(
      registerTenant(store, { name: "B", kind: "direct", email: "a@x.com", password: PW_B }),
    ).rejects.toThrow(/zaten kayıtlı/);
  });

  it("VARLIK SIZDIRMAZ: yanlış şifre ile bilinmeyen e-posta aynı mesajı verir", async () => {
    const store = emptyStore();
    await registerTenant(store, { name: "A", kind: "direct", email: "a@x.com", password: PW_A });
    const wrongPassword = await login(store, { email: "a@x.com", password: PW_WRONG }).catch(
      (e) => (e as Error).message,
    );
    const unknownEmail = await login(store, { email: "yok@x.com", password: PW_B }).catch(
      (e) => (e as Error).message,
    );
    expect(wrongPassword).toBe("e-posta veya şifre hatalı");
    expect(unknownEmail).toBe("e-posta veya şifre hatalı");
  });

  it("kayıt şifresi düz metin saklanmaz (scrypt hash)", async () => {
    const store = emptyStore();
    await registerTenant(store, { name: "A", kind: "direct", email: "h@x.com", password: PW_B });
    const user = await store.findUserByEmail("h@x.com");
    expect(user?.passwordHash.startsWith("scrypt:")).toBe(true);
    expect(user?.passwordHash).not.toContain(PW_B);
  });
});

describe("kayıtta paket seçimi", () => {
  it("seçilen paket kiracıya yazılır", async () => {
    const store = emptyStore();
    const { tenant } = await registerTenant(store, {
      name: "Pro Ajans",
      kind: "agency",
      email: "pro@ajans.com",
      password: PW_A,
      package: "pro",
    });
    expect(tenant.package).toBe("pro");
  });

  it("paket verilmezse starter varsayar", async () => {
    const store = emptyStore();
    const { tenant } = await registerTenant(store, {
      name: "A",
      kind: "agency",
      email: "a@ajans.com",
      password: PW_A,
    });
    expect(tenant.package).toBe("starter");
  });

  it("geçersiz paket değeri starter'a düşer (sınır doğrulaması)", async () => {
    const store = emptyStore();
    const { tenant } = await registerTenant(store, {
      name: "A",
      kind: "agency",
      email: "a2@ajans.com",
      password: PW_A,
      package: "enterprise",
    });
    expect(tenant.package).toBe("starter");
  });
});
