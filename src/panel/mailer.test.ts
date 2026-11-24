import { describe, expect, it, vi } from "vitest";
import { createConsoleEmailSender } from "./mailer.js";

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