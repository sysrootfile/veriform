import { describe, expect, it, vi } from "vitest";
import { createConsoleEmailSender, createMailSenderFromEnv, createSmtpEmailSender } from "./mailer.js";

const createTransport = vi.hoisted(() =>
  vi.fn((_options: Record<string, unknown>) => ({ sendMail: vi.fn(async () => {}) })),
);
vi.mock("nodemailer", () => ({ createTransport, default: { createTransport } }));

describe("createConsoleEmailSender", () => {
  it("mailin tam metnini loglar — bağlantı token'ları dev'de görünür", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      await createConsoleEmailSender().send({
        to: "a@b.com",
        subject: "Konu",
        text: "ilk satır\n\nhttps://panel.test/verify-email?token=abc123",
        html: "<p>x</p>",
      });
      expect(spy).toHaveBeenCalledTimes(1);
      const line = String(spy.mock.calls[0]![0]);
      expect(line).toContain("[mailer:console]");
      expect(line).toContain("a@b.com");
      expect(line).toContain("https://panel.test/verify-email?token=abc123");
    } finally {
      spy.mockRestore();
    }
  });
});
describe("SMTP gönderici zaman aşımı", () => {
  it("bağlantı, karşılama ve soket için sınır verir — erişilemeyen SMTP isteği dakikalarca bekletmez", async () => {
    createTransport.mockClear();
    const sender = createSmtpEmailSender({ host: "smtp.test", port: 587, from: "a@b.com" });
    await sender.send({ to: "c@d.com", subject: "Konu", text: "gövde", html: "<p>gövde</p>" });
    expect(createTransport).toHaveBeenCalledTimes(1);
    const options = createTransport.mock.calls[0]![0];
    expect(options.connectionTimeout).toBe(10_000);
    expect(options.greetingTimeout).toBe(10_000);
    expect(options.socketTimeout).toBe(20_000);
  });
});

describe("createMailSenderFromEnv üretim kapısı", () => {
  it("https panelde SMTP yoksa açılış durur (mail sessizce kaybolmaz)", () => {
    expect(() => createMailSenderFromEnv({ PANEL_URL: "https://panel.test" })).toThrow(/SMTP_HOST/);
  });

  it("açıkça istenmiş console gönderici kabul edilir (yerel deneme)", () => {
    expect(
      createMailSenderFromEnv({ PANEL_URL: "https://panel.test", ALLOW_CONSOLE_MAIL: "1" }),
    ).toBeDefined();
  });

  it("yerel http panelde SMTP yoksa console gönderici döner", () => {
    expect(createMailSenderFromEnv({ PANEL_URL: "http://localhost:4620" })).toBeDefined();
    expect(createMailSenderFromEnv({})).toBeDefined();
  });
});
