import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * .env'e yazılan e-posta ayarları compose'tan geçmezse konteyner onları hiç görmez.
 * Bu yüzden compose dosyası, mail yolunun okuduğu her adı panel ortamına aktarmalı.
 */

const compose = readFileSync(new URL("../../docker-compose.yml", import.meta.url), "utf8").replaceAll("\r\n", "\n");
const lines = compose.split("\n");

/** panel servisinin `environment:` bölümü — anahtar → ham değer. */
function panelEnvironment(): Map<string, string> {
  const panelStart = lines.findIndex((line) => line === "  panel:");
  const result = new Map<string, string>();
  let inEnvironment = false;
  for (let i = panelStart + 1; i < lines.length; i += 1) {
    const line = lines[i]!;
    if (/^ {0,3}\S/.test(line)) break;
    if (line === "    environment:") {
      inEnvironment = true;
      continue;
    }
    if (!inEnvironment) continue;
    const entry = /^ {6}([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/.exec(line);
    if (entry) {
      result.set(entry[1]!, entry[2]!.trim());
    } else if (/^ {0,5}\S/.test(line)) {
      break;
    }
  }
  return result;
}

/** mailer.ts'in okuduğu adlar + iletişim formu operatör adresi (server.ts). */
const MAIL_NAMES = [
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "SMTP_FROM",
  "ALLOW_CONSOLE_MAIL",
  "CONTACT_OPERATOR_EMAIL",
];

describe("compose panel ortamı — e-posta aktarımı", () => {
  it("panel servisinin environment bölümünü bulur", () => {
    expect(panelEnvironment().has("PANEL_URL")).toBe(true);
  });

  describe.each(MAIL_NAMES)("%s", (name) => {
    it("panel ortamına aktarılır", () => {
      expect(panelEnvironment().has(name)).toBe(true);
    });

    it("tanımsızken açılışı durdurmaz (isteğe bağlı aktarım)", () => {
      expect(panelEnvironment().get(name)).toBe(`\${${name}:-}`);
    });
  });
});

describe("compose panel ortamı — proxy güveni", () => {
  it("TRUST_PROXY aktarılır ve varsayılanı açık (dağıtım tünel arkasında)", () => {
    expect(panelEnvironment().get("TRUST_PROXY")).toBe("${TRUST_PROXY:-1}");
  });
});