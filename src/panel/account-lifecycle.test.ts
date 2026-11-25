import { describe, expect, it, vi } from "vitest";
import {
  changePassword,
  deleteAccount,
  hashAccountToken,
  issueEmailVerification,
  requestPasswordReset,
  resetPassword,
  sendVerificationInBackground,
  verifyEmail,
} from "./account-lifecycle.js";
import { hashPassword } from "./auth.js";
import { login } from "./accounts.js";
import type { EmailSender, OutgoingEmail } from "./mailer.js";
import { createInMemoryPanelStore } from "./store.js";

function spyMailer() {
  const sent: OutgoingEmail[] = [];
  const sender: EmailSender = {
    async send(email) {
      sent.push(email);
    },
  };
  return { sent, sender };
}

async function setup() {
  const store = createInMemoryPanelStore();
  const tenant = await store.createTenant({ name: "Hesap Ajans", kind: "agency" });
  const user = await store.createUser({
    tenantId: tenant.id,
    email: "hesap@probe.test",
    passwordHash: "eski-hash",
  });
  return { store, tenant, user };
}

describe("e-posta doğrulama", () => {
  it("doğrulama bağlantısı token'la maillenir; verifyEmail kullanıcıyı doğrular", async () => {
    const { store, user } = await setup();
    const { sent, sender } = spyMailer();
    await issueEmailVerification(store, sender, user, "https://panel.test");
    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toBe("hesap@probe.test");
    const link = sent[0]!.text.match(/https:\/\/panel\.test\/verify-email\?token=([0-9a-f]{64})/);
    expect(link).not.toBeNull();
    await verifyEmail(store, link![1]!);
    const found = await store.findUserByEmail("hesap@probe.test");
    expect(found?.emailVerifiedAt).toBeTruthy();
  });

  it("token tek kullanımlıktır — ikinci doğrulama reddedilir", async () => {
    const { store, user } = await setup();
    const { sent, sender } = spyMailer();
    await issueEmailVerification(store, sender, user, "https://panel.test");
    const token = sent[0]!.text.match(/token=([0-9a-f]{64})/)![1]!;
    await verifyEmail(store, token);
    await expect(verifyEmail(store, token)).rejects.toThrow(/geçersiz veya süresi dolmuş/);
  });

  it("bilinmeyen token reddedilir", async () => {
    const { store } = await setup();
    await expect(verifyEmail(store, "f".repeat(64))).rejects.toThrow(/geçersiz veya süresi dolmuş/);
  });

  it("süresi dolmuş token reddedilir", async () => {
    const { store, user } = await setup();
    const token = "a".repeat(64);
    await store.createAccountToken({
      userId: user.id,
      purpose: "verify-email",
      tokenHash: hashAccountToken(token),
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });
    await expect(verifyEmail(store, token)).rejects.toThrow(/geçersiz veya süresi dolmuş/);
  });
});

describe("şifre sıfırlama", () => {
  it("kayıtlı e-postaya sıfırlama bağlantısı gider; reset yeni şifreyi kurar", async () => {
    const { store, user } = await setup();
    const { sent, sender } = spyMailer();
    await store.updateUserPassword(user.id, "eski-hash");
    await requestPasswordReset(store, sender, "hesap@probe.test", "https://panel.test");
    expect(sent).toHaveLength(1);
    const token = sent[0]!.text.match(/https:\/\/panel\.test\/reset-password\?token=([0-9a-f]{64})/)![1]!;
    await resetPassword(store, token, "yeni-sifre-123");
    const found = await store.findUserByEmail("hesap@probe.test");
    expect(found?.passwordHash).not.toBe("eski-hash");
  });

  it("bilinmeyen e-posta mail üretmez ve hata vermez (varlık sızdırmaz)", async () => {
    const { store } = await setup();
    const { sent, sender } = spyMailer();
    await expect(
      requestPasswordReset(store, sender, "yok@probe.test", "https://panel.test"),
    ).resolves.toBeUndefined();
    expect(sent).toHaveLength(0);
  });

  it("sıfırlama token'ı tek kullanımlıktır", async () => {
    const { store, user } = await setup();
    const { sent, sender } = spyMailer();
    await requestPasswordReset(store, sender, "hesap@probe.test", "https://panel.test");
    const token = sent[0]!.text.match(/token=([0-9a-f]{64})/)![1]!;
    await resetPassword(store, token, "yeni-sifre-123");
    await expect(resetPassword(store, token, "baska-sifre-123")).rejects.toThrow(
      /geçersiz veya süresi dolmuş/,
    );
    void user;
  });

  it("kısa şifre reddedilir", async () => {
    const { store } = await setup();
    const { sent, sender } = spyMailer();
    await requestPasswordReset(store, sender, "hesap@probe.test", "https://panel.test");
    const token = sent[0]!.text.match(/token=([0-9a-f]{64})/)![1]!;
    await expect(resetPassword(store, token, "kisa")).rejects.toThrow(/en az 8/);
  });

  it("doğrulama token'ı şifre sıfırlamada kullanılamaz (amaç izolasyonu)", async () => {
    const { store, user } = await setup();
    const { sent, sender } = spyMailer();
    await issueEmailVerification(store, sender, user, "https://panel.test");
    const token = sent[0]!.text.match(/token=([0-9a-f]{64})/)![1]!;
    await expect(resetPassword(store, token, "yeni-sifre-123")).rejects.toThrow(
      /geçersiz veya süresi dolmuş/,
    );
  });
});

describe("şifre değiştirme", () => {
  it("mevcut şifre doğruysa yenisi kurulur", async () => {
    const store = createInMemoryPanelStore();
    const tenant = await store.createTenant({ name: "A", kind: "agency" });
    const { hashPassword } = await import("./auth.js");
    await store.createUser({
      tenantId: tenant.id,
      email: "degis@probe.test",
      passwordHash: await hashPassword("eski-sifre-123"),
    });
    await changePassword(store, tenant.id, "eski-sifre-123", "yeni-sifre-456");
    expect(await login(store, { email: "degis@probe.test", password: "yeni-sifre-456" })).toBe(tenant.id);
    await expect(login(store, { email: "degis@probe.test", password: "eski-sifre-123" })).rejects.toThrow();
  });

  it("mevcut şifre yanlışsa reddedilir", async () => {
    const store = createInMemoryPanelStore();
    const tenant = await store.createTenant({ name: "A", kind: "agency" });
    const { hashPassword } = await import("./auth.js");
    await store.createUser({
      tenantId: tenant.id,
      email: "degis@probe.test",
      passwordHash: await hashPassword("eski-sifre-123"),
    });
    await expect(changePassword(store, tenant.id, "yanlis-sifre", "yeni-sifre-456")).rejects.toThrow(
      /mevcut şifre hatalı/,
    );
  });
});

describe("hesap silme (KVKK)", () => {
  it("kiracı, kullanıcı ve müşteri verisi birlikte silinir", async () => {
    const { store, tenant } = await setup();
    const client = await store.createClient({ tenantId: tenant.id, name: "M" });
    await store.createSite({ tenantId: tenant.id, clientId: client.id, url: "https://sil.com" });
    await deleteAccount(store, tenant.id);
    expect(await store.getTenant(tenant.id)).toBeNull();
    expect(await store.findUserByEmail("hesap@probe.test")).toBeNull();
    expect(await store.listClients(tenant.id)).toEqual([]);
  });
});
describe("oturum düşürme", () => {
  it("şifre sıfırlama ve şifre değiştirme önceki oturumları düşürür", async () => {
    const { store, tenant, user } = await setup();
    const { sent, sender } = spyMailer();
    expect((await store.findUserByTenant(tenant.id))!.sessionsValidAfter).toBe("1970-01-01T00:00:00.000Z");

    await requestPasswordReset(store, sender, "hesap@probe.test", "https://panel.test");
    const token = sent[0]!.text.match(/token=([0-9a-f]{64})/)![1]!;
    await resetPassword(store, token, "yeni-sifre-123");
    const afterReset = (await store.findUserByTenant(tenant.id))!.sessionsValidAfter;
    expect(Date.parse(afterReset)).toBeGreaterThan(Date.now() - 60_000);

    await store.updateUserPassword(user.id, await hashPassword("yeni-sifre-123"));
    await changePassword(store, tenant.id, "yeni-sifre-123", "daha-yeni-sifre-456");
    const afterChange = (await store.findUserByTenant(tenant.id))!.sessionsValidAfter;
    expect(Date.parse(afterChange)).toBeGreaterThanOrEqual(Date.parse(afterReset));
  });
});

describe("arka plan doğrulama maili", () => {
  it("çağıranı bekletmez: gönderim bitmeden döner, mail sonra gider", async () => {
    const { store, user } = await setup();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const sent: OutgoingEmail[] = [];
    const sender: EmailSender = {
      async send(email) {
        await gate;
        sent.push(email);
      },
    };

    sendVerificationInBackground(store, sender, user, "https://panel.test");
    expect(sent).toHaveLength(0);

    release();
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]!.to).toBe("hesap@probe.test");
  });

  it("geçici SMTP hatasında yeniden dener; sonunda mail gider", async () => {
    const { store, user } = await setup();
    let calls = 0;
    const sent: OutgoingEmail[] = [];
    const sender: EmailSender = {
      async send(email) {
        calls += 1;
        if (calls < 3) throw new Error("smtp geçici hata");
        sent.push(email);
      },
    };

    sendVerificationInBackground(store, sender, user, "https://panel.test", { retryDelayMs: 1 });

    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect(calls).toBe(3);
  });

  it("tüm denemeler tükenirse hata loglanır; istek çoktan dönmüştür", async () => {
    const { store, user } = await setup();
    const logged: string[] = [];
    const sender: EmailSender = {
      async send() {
        throw new Error("smtp kapalı");
      },
    };

    sendVerificationInBackground(store, sender, user, "https://panel.test", {
      attempts: 2,
      retryDelayMs: 1,
      log: (message) => logged.push(message),
    });

    await vi.waitFor(() => expect(logged).toHaveLength(1));
    expect(logged[0]).toContain("arka planda");
  });
});
