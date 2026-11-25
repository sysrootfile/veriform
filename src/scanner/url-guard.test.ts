import { describe, expect, it } from "vitest";
import { assertPublicHttpUrl, assertPublicTarget } from "./url-guard.js";

type Record_ = { address: string; family: number };

describe("assertPublicHttpUrl (sözdizimi ve sabit adresler)", () => {
  it.each(["https://musteri.com", "http://musteri.com/a?b=1", "https://93.184.216.34/", "https://[2606:2800:220:1:248:1893:25c8:1946]/"])(
    "genel http adresi geçer: %s",
    (raw) => {
      expect(assertPublicHttpUrl(raw).protocol).toMatch(/^https?:$/);
    },
  );

  it.each([
    "file:///etc/passwd",
    "ftp://musteri.com/",
    "javascript:alert(1)",
    "https://",
    "http://localhost/",
    "http://api.localhost/",
    "http://127.0.0.1/",
    "http://127.5.4.3:4620/",
    "http://169.254.169.254/latest/meta-data",
    "http://10.0.0.5/",
    "http://172.16.0.1/",
    "http://192.168.1.2/",
    "http://0.0.0.0/",
    "http://[::1]/",
    "http://[::]/",
    "http://[::ffff:127.0.0.1]/",
    "http://[::ffff:169.254.169.254]/",
    "http://[fe80::1]/",
    "http://[fc00::1]/",
    "http://[fd12::1]/",
    "http://kullanici:sifre@musteri.com/",
  ])("reddedilir: %s", (raw) => {
    expect(() => assertPublicHttpUrl(raw)).toThrow(/taranamaz/);
  });
});

describe("assertPublicTarget (DNS çözümü)", () => {
  const resolving =
    (...records: Record_[]) =>
    async () =>
      records;

  it("tüm kayıtlar genel adrese çözülüyorsa geçer", async () => {
    await expect(
      assertPublicTarget(new URL("https://acik.test"), resolving({ address: "93.184.216.34", family: 4 })),
    ).resolves.toBeUndefined();
  });

  it("özel ağa çözülen alan adı reddedilir", async () => {
    await expect(
      assertPublicTarget(new URL("https://ic.test"), resolving({ address: "10.1.1.1", family: 4 })),
    ).rejects.toThrow(/özel ağ/);
  });

  it("kayıtlardan biri özel adrese çözülüyorsa reddedilir", async () => {
    await expect(
      assertPublicTarget(
        new URL("https://karisik.test"),
        resolving(
          { address: "93.184.216.34", family: 4 },
          { address: "::ffff:192.168.0.2", family: 6 },
        ),
      ),
    ).rejects.toThrow(/özel ağ/);
  });

  it("adres çözülemeyen alan adı reddedilir", async () => {
    await expect(assertPublicTarget(new URL("https://yok.test"), resolving())).rejects.toThrow(/çözülem/);
  });
});
