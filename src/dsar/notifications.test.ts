import { describe, expect, it } from "vitest";
import { buildDsarNotificationEmail } from "./notifications.js";

describe("buildDsarNotificationEmail", () => {
  it("konu satırında başvuran ve tür taşır; 30 gün sonucu gövdede", () => {
    const email = buildDsarNotificationEmail({
      siteUrl: "https://musteri.com",
      subjectName: "Ayşe Yılmaz",
      type: "silme",
      deadlineAt: "2026-12-02T10:00:00.000Z",
    });
    expect(email.subject).toContain("Ayşe Yılmaz");
    expect(email.subject).toContain("Silinmesini");
    expect(email.text).toContain("30 gün");
    expect(email.text).toContain("2026-12-02");
    expect(email.html).toContain("Ayşe Yılmaz");
  });

  it("tür etiketi KVKK maddesi referansıyla gelir", () => {
    const email = buildDsarNotificationEmail({
      siteUrl: "https://musteri.com",
      subjectName: "M",
      type: "itiraz",
      deadlineAt: "2026-12-02T10:00:00.000Z",
    });
    expect(email.text).toContain("m.11/8");
  });
});
