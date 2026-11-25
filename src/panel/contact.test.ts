import { describe, expect, it, vi } from "vitest";
import { createRateLimiter } from "./rate-limit.js";
import { createInMemoryPanelStore } from "./store.js";
import type { EmailSender } from "./mailer.js";
import {
  buildContactEmail,
  handleContactSubmit,
  validateContactInput,
} from "./contact.js";

function form(over: Record<string, string> = {}): URLSearchParams {
  return new URLSearchParams({
    name: "Ayşe Yılmaz",
    email: "ayse@ajans.com",
    company: "Ajans A",
    package: "pro",
    message: "15 müşterimizin sitesini izlemek istiyoruz, kurulum desteği lazım.",
    ...over,
  });
}

function okSender(): EmailSender & { sent: Array<{ to: string; subject: string }> } {
  const sent: Array<{ to: string; subject: string }> = [];
  return {
    sent,
    async send(email) {
      sent.push({ to: email.to, subject: email.subject });
    },
  };
}

describe("validateContactInput", () => {
  it("geçerli formu trim'lenmiş değerlerle döner", () => {
    const r = validateContactInput(form({ name: "  Ayşe  ", email: " ayse@ajans.com " }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.name).toBe("Ayşe");
      expect(r.value.email).toBe("ayse@ajans.com");
      expect(r.value.package).toBe("pro");
    }
  });

  it("paket ve şirket opsiyoneldir", () => {
    const r = validateContactInput(form({ package: "", company: "" }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.package).toBeUndefined();
      expect(r.value.company).toBeUndefined();
    }
  });

  it("eksik ad, bozuk e-posta, kısa mesaj ve bilinmeyen paket reddedilir", () => {
    expect(validateContactInput(form({ name: "" })).ok).toBe(false);
    expect(validateContactInput(form({ name: "A" })).ok).toBe(false);
    expect(validateContactInput(form({ email: "ayse@" })).ok).toBe(false);
    expect(validateContactInput(form({ email: "bosluklu adres@x.com" })).ok).toBe(false);
    expect(validateContactInput(form({ message: "kısa" })).ok).toBe(false);
    expect(validateContactInput(form({ message: "x".repeat(2001) })).ok).toBe(false);
    expect(validateContactInput(form({ package: "enterprise" })).ok).toBe(false);
    expect(validateContactInput(form({ name: "x".repeat(121) })).ok).toBe(false);
  });
});

describe("buildContactEmail", () => {
  it("operatöre giden mail ad, e-posta, paket ve mesajı taşır; HTML kaçırılır", () => {
    const email = buildContactEmail({
      id: "c1",
      name: "<script>alert(1)</script>",
      email: "x@y.com",
      package: "ultimate",
      message: "özel kurulum <b>istiyoruz</b>",
      createdAt: "2026-11-18T10:00:00.000Z",
    });
    expect(email.subject).toContain("iletişim talebi");
    expect(email.text).toContain("x@y.com");
    expect(email.text).toContain("ultimate");
    expect(email.text).toContain("özel kurulum");
    expect(email.html).not.toContain("<script>alert");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).not.toContain("<b>istiyoruz</b>");
  });
});

describe("handleContactSubmit", () => {
  function deps(over: { sender?: EmailSender } = {}) {
    const store = createInMemoryPanelStore();
    const sender = over.sender ?? okSender();
    return {
      store,
      sender,
      call: (f: URLSearchParams, ip = "1.2.3.4") =>
        handleContactSubmit({
          form: f,
          store,
          mailSender: sender,
          operatorEmail: "operator@veriform.test",
          limiter: createRateLimiter({ max: 3, windowMs: 60_000 }),
          ip,
        }),
    };
  }

  it("geçerli talep saklanır, operatöre mail gider, 303 ile teşekkür adresine döner", async () => {
    const d = deps();
    const sender = d.sender as ReturnType<typeof okSender>;
    const r = await d.call(form());
    expect(r.status).toBe(303);
    expect(r.location).toContain("contact=ok");
    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0]!.to).toBe("operator@veriform.test");
  });

  it("geçersiz form 400 döner; depo ve mail tetiklenmez", async () => {
    const d = deps();
    const sender = d.sender as ReturnType<typeof okSender>;
    const spy = vi.spyOn(d.store, "createContactRequest");
    const r = await d.call(form({ email: "bozuk" }));
    expect(r.status).toBe(400);
    expect(spy).not.toHaveBeenCalled();
    expect(sender.sent).toHaveLength(0);
  });

  it("limit aşımında 429 döner; depo ve mail tetiklenmez", async () => {
    const store = createInMemoryPanelStore();
    const sender = okSender();
    const limiter = createRateLimiter({ max: 3, windowMs: 60_000 });
    const spy = vi.spyOn(store, "createContactRequest");
    const call = () =>
      handleContactSubmit({
        form: form(),
        store,
        mailSender: sender,
        operatorEmail: "operator@veriform.test",
        limiter,
        ip: "9.9.9.9",
      });
    expect((await call()).status).toBe(303);
    expect((await call()).status).toBe(303);
    expect((await call()).status).toBe(303);
    const fourth = await call();
    expect(fourth.status).toBe(429);
    expect(spy).toHaveBeenCalledTimes(3);
    expect(sender.sent).toHaveLength(3);
  });

  it("mail hatası talebi düşürmez — kayıt kalır, 303 döner", async () => {
    const store = createInMemoryPanelStore();
    const spy = vi.spyOn(store, "createContactRequest");
    const failing: EmailSender = {
      async send() {
        throw new Error("smtp yok");
      },
    };
    const r = await handleContactSubmit({
      form: form(),
      store,
      mailSender: failing,
      operatorEmail: "operator@veriform.test",
      limiter: createRateLimiter({ max: 5, windowMs: 60_000 }),
      ip: "5.5.5.5",
    });
    expect(r.status).toBe(303);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
describe("iletişim maili görünürlüğü", () => {
  function base(sender: EmailSender) {
    return {
      form: form(),
      store: createInMemoryPanelStore(),
      mailSender: sender,
      operatorEmail: "op@ajans.com",
      limiter: createRateLimiter({ max: 10, windowMs: 60_000 }),
      ip: "198.51.100.7",
    };
  }

  it("başarılı gönderim operatör adresiyle loglanır", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const result = await handleContactSubmit(base(okSender()));
      expect(result.status).toBe(303);
      expect(
        spy.mock.calls.some((c) => String(c[0]).includes("[contact]") && String(c[0]).includes("op@ajans.com")),
      ).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });

  it("mail hatası sessizce yutulmaz: loglanır, talep DB'de kalır", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const store = createInMemoryPanelStore();
      const sender: EmailSender = {
        async send() {
          throw new Error("smtp kapalı");
        },
      };
      const result = await handleContactSubmit({ ...base(sender), store });
      expect(result.status).toBe(303);
      expect(spy.mock.calls.some((c) => String(c[0]).includes("[contact]"))).toBe(true);
      expect(await store.listContactRequests()).toHaveLength(1);
    } finally {
      spy.mockRestore();
    }
  });
});
