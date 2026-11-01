// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { discoverForms } from "./discover.js";
import { classifyField } from "../classifier/field.js";

function dom(html: string): Document {
  document.body.innerHTML = html;
  return document;
}

describe("discoverForms", () => {
  it("formdaki input/select/textarea alanlarını meta ile toplar", () => {
    const [form] = discoverForms(dom(`
      <form>
        <input name="email" type="email" required>
        <select name="sehir"><option>İstanbul</option></select>
        <textarea name="mesaj"></textarea>
      </form>
    `));
    expect(form!.fields).toHaveLength(3);
    expect(form!.fields.map((f) => f.meta.name)).toEqual(["email", "sehir", "mesaj"]);
    expect(form!.fields[0]!.meta.required).toBe(true);
  });

  it("buton/submit/reset/hidden tipindeki inputları toplamaz", () => {
    const [form] = discoverForms(dom(`
      <form>
        <input name="ad" type="text">
        <input type="hidden" name="csrf" value="x">
        <input type="submit" value="Gönder">
        <button type="button">İptal</button>
        <input type="reset" value="Temizle">
      </form>
    `));
    expect(form!.fields).toHaveLength(1);
    expect(form!.fields[0]!.meta.name).toBe("ad");
  });

  it("çoklu formda action ve method'u yakalar, formsuz sayfada boş döner", () => {
    const d = dom(`
      <form action="/kayit" method="post"><input name="email"></form>
      <form method="GET"><input name="ara"></form>
    `);
    const forms = discoverForms(d);
    expect(forms).toHaveLength(2);
    expect(forms[0]!.action).toBe("/kayit");
    expect(forms[0]!.method).toBe("post");
    expect(forms[1]!.method).toBe("get");
    expect(discoverForms(dom("<p>form yok</p>"))).toEqual([]);
  });

  it("uçtan uca: Türkçe kayıt formu → alan kategorileri", () => {
    const [form] = discoverForms(dom(`
      <form action="/uye" method="post">
        <label for="ad">Ad Soyad</label><input id="ad" name="adsoyad">
        <label for="mail">E-Posta</label><input id="mail" name="email" type="email">
        <label for="tc">T.C. Kimlik No</label><input id="tc" name="tcno">
      </form>
    `));
    const categories = form!.fields.map((f) => classifyField(f.meta).category);
    expect(categories).toEqual(["full_name", "email", "tckn"]);
  });
});
