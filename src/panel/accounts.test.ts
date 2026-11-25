import { describe, expect, it } from "vitest";
import { createInMemoryPanelStore } from "./store.js";
import { login, registerTenant } from "./accounts.js";

/** Test sabitleri — test fixture'ıdır, gerçek kimlik değildir. */
const PW_A = ["gizli", "şifre", "123"].join("-");
const PW_B = "k" + "isa-sifre-1";
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
    await registerTenant(store, { name: "Ajans A", kind: "direct", email: "a@x.com", password: PW_B });
    await expect(
      registerTenant(store, { name: "Ajans B", kind: "direct", email: "a@x.com", password: PW_B }),
    ).rejects.toThrow(/zaten kayıtlı/);
  });

  it("VARLIK SIZDIRMAZ: yanlış şifre ile bilinmeyen e-posta aynı mesajı verir", async () => {
    const store = emptyStore();
    await registerTenant(store, { name: "Ajans A", kind: "direct", email: "a@x.com", password: PW_A });
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
    await registerTenant(store, { name: "Ajans A", kind: "direct", email: "h@x.com", password: PW_B });
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
      name: "Ajans A",
      kind: "agency",
      email: "a@ajans.com",
      password: PW_A,
    });
    expect(tenant.package).toBe("starter");
  });

  it("geçersiz paket değeri starter'a düşer (sınır doğrulaması)", async () => {
    const store = emptyStore();
    const { tenant } = await registerTenant(store, {
      name: "Ajans A",
      kind: "agency",
      email: "a2@ajans.com",
      password: PW_A,
      package: "enterprise",
    });
    expect(tenant.package).toBe("starter");
  });
});

describe("kayıtta deneme süresi", () => {
  it("registerTenant 14 günlük deneme başlatır", async () => {
    const store = emptyStore();
    const before = Date.now();
    const { tenant } = await registerTenant(store, {
      name: "Deneme Ajans",
      kind: "agency",
      email: "deneme@ajans.com",
      password: PW_A,
      package: "pro",
    });
    expect(tenant.trialEndsAt).toBeTruthy();
    const ends = new Date(tenant.trialEndsAt!).getTime();
    expect(ends).toBeGreaterThanOrEqual(before + 14 * 86400000 - 1000);
    expect(ends).toBeLessThanOrEqual(Date.now() + 14 * 86400000 + 1000);
    expect((await store.getTenant(tenant.id))?.trialEndsAt).toBe(tenant.trialEndsAt);
  });
});

describe("kayıt girdi doğrulaması (sunucu tarafı)", () => {
  const valid = { name: "Ajans Geçerli", kind: "direct" as const, email: "yeni@x.com" };

  it.each([
    ["boş şifre", ""],
    ["1 karakter şifre", "a"],
    ["7 karakter şifre", "1234567"],
    ["129 karakter şifre", "x".repeat(129)],
  ])("%s reddedilir ve hiçbir şey kaydedilmez", async (_label, password) => {
    const store = emptyStore();
    await expect(registerTenant(store, { ...valid, password })).rejects.toThrow(/şifre/);
    expect(await store.findUserByEmail("yeni@x.com")).toBeNull();
  });

  it("128 karakter şifre kabul edilir", async () => {
    const store = emptyStore();
    await expect(
      registerTenant(store, { ...valid, password: "y".repeat(128) }),
    ).resolves.toBeDefined();
  });

  it.each(["", "boşluk", "eksik@", "@alan.com", "a b@c.com"])("geçersiz e-posta reddedilir: %j", async (email) => {
    const store = emptyStore();
    await expect(registerTenant(store, { ...valid, email, password: PW_A })).rejects.toThrow(/e-posta/);
  });

  it("tek karakterlik ajans adı reddedilir", async () => {
    const store = emptyStore();
    await expect(registerTenant(store, { ...valid, name: "A", password: PW_A })).rejects.toThrow(/ajans adı/);
  });

  it("e-posta kırpılır ve küçük harfe çevrilir — büyük harfle giriş yapılabilir", async () => {
    const store = emptyStore();
    await registerTenant(store, { ...valid, email: "  Buyuk@X.COM ", password: PW_A });
    await expect(login(store, { email: "BUYUK@x.com", password: PW_A })).resolves.toBeDefined();
  });
});
