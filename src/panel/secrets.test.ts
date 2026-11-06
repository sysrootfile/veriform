import { describe, expect, it } from "vitest";
import { resolvePanelSecrets, verifyWorkerToken } from "./secrets.js";

const REAL = "a".repeat(64);

describe("resolvePanelSecrets", () => {
  it("SESSION_SECRET yoksa boot'u durdurur", () => {
    expect(() => resolvePanelSecrets({})).toThrow(/SESSION_SECRET ayarlı değil/);
  });

  it("boş ve sadece boşluk değerleri de eksik sayılır", () => {
    expect(() => resolvePanelSecrets({ SESSION_SECRET: "" })).toThrow(/ayarlı değil/);
    expect(() => resolvePanelSecrets({ SESSION_SECRET: "   " })).toThrow(/ayarlı değil/);
  });

  it("geliştirme işaretini gerçek anahtar kabul etmez", () => {
    expect(() => resolvePanelSecrets({ SESSION_SECRET: "dev-secret-change-me" })).toThrow(
      /geliştirme işareti/,
    );
    expect(() => resolvePanelSecrets({ SESSION_SECRET: "Veriform" })).toThrow(/geliştirme işareti/);
  });

  it("gerçek anahtarı kabul eder, WORKER_TOKEN yoksa null döner", () => {
    expect(resolvePanelSecrets({ SESSION_SECRET: REAL })).toEqual({
      sessionSecret: REAL,
      sessionSecrets: [REAL],
      workerToken: null,
    });
  });

  it("WORKER_TOKEN'ı ayrı değer olarak döndürür", () => {
    const secrets = resolvePanelSecrets({ SESSION_SECRET: REAL, WORKER_TOKEN: "b".repeat(32) });
    expect(secrets.workerToken).toBe("b".repeat(32));
  });

  it("iki anahtar aynıysa ayrımı reddeder", () => {
    expect(() => resolvePanelSecrets({ SESSION_SECRET: REAL, WORKER_TOKEN: REAL })).toThrow(
      /oturum anahtarından ayır/,
    );
  });
});

describe("verifyWorkerToken", () => {
  const TOKEN = "c".repeat(32);

  it("doğru token'ı kabul eder", () => {
    expect(verifyWorkerToken(TOKEN, TOKEN)).toBe(true);
  });

  it("token tanımlı değilse her çağrıyı reddeder", () => {
    expect(verifyWorkerToken(TOKEN, null)).toBe(false);
    expect(verifyWorkerToken(undefined, null)).toBe(false);
  });

  it("yanlış, eksik ve uzun değerleri throw etmeden reddeder", () => {
    expect(verifyWorkerToken("d".repeat(32), TOKEN)).toBe(false);
    expect(verifyWorkerToken(undefined, TOKEN)).toBe(false);
    expect(verifyWorkerToken("", TOKEN)).toBe(false);
    expect(verifyWorkerToken(`${TOKEN}tas`, TOKEN)).toBe(false);
    expect(verifyWorkerToken("kisa", TOKEN)).toBe(false);
  });
});

describe("resolvePanelSecrets — anahtar rotasyonu", () => {
  const NEW = "n".repeat(64);
  const OLD = "o".repeat(64);

  it("SESSION_SECRET_PREVIOUS yoksa tek anahtar döner", () => {
    const secrets = resolvePanelSecrets({ SESSION_SECRET: NEW });
    expect(secrets.sessionSecrets).toEqual([NEW]);
  });

  it("rotasyon sırasında eski anahtar listenin sonunda taşınır", () => {
    const secrets = resolvePanelSecrets({
      SESSION_SECRET: NEW,
      SESSION_SECRET_PREVIOUS: OLD,
    });
    expect(secrets.sessionSecret).toBe(NEW);
    expect(secrets.sessionSecrets).toEqual([NEW, OLD]);
  });

  it("eski ve yeni aynıysa tekrarlanmaz", () => {
    const secrets = resolvePanelSecrets({
      SESSION_SECRET: NEW,
      SESSION_SECRET_PREVIOUS: NEW,
    });
    expect(secrets.sessionSecrets).toEqual([NEW]);
  });

  it("boş veya geliştirme işareti PREVIOUS kabul edilmez", () => {
    expect(() =>
      resolvePanelSecrets({ SESSION_SECRET: NEW, SESSION_SECRET_PREVIOUS: "   " }),
    ).not.toThrow();
    expect(() =>
      resolvePanelSecrets({ SESSION_SECRET: NEW, SESSION_SECRET_PREVIOUS: "dev-secret-change-me" }),
    ).toThrow(/geliştirme işareti/);
  });
});
