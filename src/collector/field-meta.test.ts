// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { extractFieldMeta } from "./field-meta.js";
import { classifyField } from "../classifier/field.js";

function dom(html: string): Document {
  document.body.innerHTML = html;
  return document;
}

describe("extractFieldMeta", () => {
  it("name/id/type/autocomplete/required özniteliklerini değer almadan eşler", () => {
    const el = dom(
      `<input name="email" id="f-email" type="email" autocomplete="email" required>`,
    ).querySelector("input")!;
    expect(extractFieldMeta(el)).toEqual({
      name: "email",
      id: "f-email",
      type: "email",
      autocomplete: "email",
      required: true,
    });
  });

  it("label[for] ilişkisini çözer ve classifyField ile TCKN bulur", () => {
    const el = dom(
      `<label for="tc">T.C. Kimlik No</label><input id="tc" name="tcno">`,
    ).querySelector("input")!;
    const meta = extractFieldMeta(el);
    expect(meta.label).toBe("T.C. Kimlik No");
    expect(classifyField(meta).category).toBe("tckn");
  });

  it("sarmalayan label'ın metnini etiket olarak alır", () => {
    const el = dom(`<label>Ad Soyad <input name="fullname"></label>`).querySelector("input")!;
    expect(extractFieldMeta(el).label).toBe("Ad Soyad");
  });

  it("aria-label'ı etiket olarak kullanır", () => {
    const el = dom(`<input name="iban" aria-label="IBAN">`).querySelector("input")!;
    expect(extractFieldMeta(el).label).toBe("IBAN");
  });

  it("aria-labelledby referansını çözer", () => {
    const el = dom(
      `<span id="lbl">Pasaport No</span><input aria-labelledby="lbl">`,
    ).querySelector("input")!;
    expect(extractFieldMeta(el).label).toBe("Pasaport No");
  });

  it("etiketi olmayan alanın label'ı tanımsız kalır, placeholder taşınır", () => {
    const el = dom(`<input name="mesaj" placeholder="Mesajınız">`).querySelector("input")!;
    const meta = extractFieldMeta(el);
    expect(meta.label).toBeUndefined();
    expect(meta.placeholder).toBe("Mesajınız");
  });
});
