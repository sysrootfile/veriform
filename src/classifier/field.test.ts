import { describe, expect, it } from "vitest";
import { classifyField } from "./field.js";
import type { FieldMeta } from "./types.js";

describe("classifyField", () => {
  it("e-posta alanını type/autocomplete/label sinyalleriyle sınıflandırır", () => {
    const r = classifyField({
      name: "eposta",
      label: "E-Posta Adresiniz",
      type: "email",
      autocomplete: "email",
    });
    expect(r.category).toBe("email");
    expect(r.confidence).toBeGreaterThanOrEqual(0.9);
    expect(r.signals).toEqual(
      expect.arrayContaining(["type:email", "autocomplete:email", "text:eposta"]),
    );
  });

  it("TC Kimlik alanını etiketten sınıflandırır", () => {
    const r = classifyField({ name: "tcno", label: "T.C. Kimlik No" });
    expect(r.category).toBe("tckn");
  });

  it("IBAN alanını sınıflandırır", () => {
    const r = classifyField({ label: "Banka IBAN Bilgisi" });
    expect(r.category).toBe("iban");
  });

  it("telefon alanını hem tel tipinden hem etiketten sınıflandırır", () => {
    const byType = classifyField({ name: "gsm", type: "tel" });
    expect(byType.category).toBe("phone");
    const byLabel = classifyField({ label: "Cep Telefonu" });
    expect(byLabel.category).toBe("phone");
  });

  it("ad soyad alanını sınıflandırır", () => {
    expect(classifyField({ label: "Adınız Soyadınız" }).category).toBe("full_name");
  });

  it("doğum tarihi alanını Türkçe karakterlerle sınıflandırır", () => {
    expect(classifyField({ label: "Doğum Tarihiniz" }).category).toBe("birthdate");
  });

  it("adres ve pasaport alanlarını sınıflandırır", () => {
    expect(classifyField({ label: "Teslimat Adresi" }).category).toBe("address");
    expect(classifyField({ label: "Pasaport No" }).category).toBe("passport");
  });

  it("hiçbir kurala uymayan alanı free_text döndürür", () => {
    const r = classifyField({ label: "Şirket Ünvanı" });
    expect(r.category).toBe("free_text");
    expect(r.confidence).toBeLessThan(0.2);
  });

  it("çakışmada yüksek güvenli kural kazanır (0.9 tckn > 0.85 tel)", () => {
    const r = classifyField({ name: "tel", type: "tel", label: "Kimlik No" });
    expect(r.category).toBe("tckn");
    expect(r.signals).toContain("type:tel");
  });

  it("META İLKESİ: değer alanı yoktur — FieldMeta değer taşıyamaz", () => {
    // Types düzeyinde garanti: FieldMeta'da 'value' benzeri alan tanımlı değil.
    const meta: FieldMeta = { label: "T.C. Kimlik No" };
    expect("value" in meta).toBe(false);
  });
});
