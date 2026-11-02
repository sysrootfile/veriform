import { describe, expect, it } from "vitest";
import { generateAydinlatmaMetni, renderTemplate, type DraftContext } from "./generator.js";

const ctx: DraftContext = {
  siteUrl: "https://musteri1.com",
  contactEmail: "kvkk@musteri1.com",
  collectedCategories: ["TC Kimlik No", "E-Posta"],
  cookieCategories: ["Analitik", "Pazarlama/Reklam"],
  generatedAt: "2026-11-02T10:00:00.000Z",
};

describe("renderTemplate", () => {
  it("bilinen yer tutucuları değiştirir, bilinmeyeni olduğu gibi bırakır", () => {
    const out = renderTemplate("Site: {{siteUrl}} — Yetkili: {{contactEmail}} — {{hukukcuNotu}}", {
      siteUrl: "https://x.com",
      contactEmail: "a@x.com",
    });
    expect(out).toBe("Site: https://x.com — Yetkili: a@x.com — {{hukukcuNotu}}");
  });
});

describe("generateAydinlatmaMetni", () => {
  it("gerçekleri şablona doldurur: site, iletişim, kategoriler, çerezler", () => {
    const draft = generateAydinlatmaMetni(ctx);
    expect(draft.title).toContain("Aydınlatma Metni");
    expect(draft.markdown).toContain("https://musteri1.com");
    expect(draft.markdown).toContain("kvkk@musteri1.com");
    expect(draft.markdown).toContain("TC Kimlik No");
    expect(draft.markdown).toContain("E-Posta");
    expect(draft.markdown).toContain("Analitik");
    expect(draft.markdown).toContain("2026-11-02");
  });

  it("HUKUKİ ONAY uyarısını ve şablon sürümünü taşır", () => {
    const draft = generateAydinlatmaMetni(ctx, { templateVersion: "tpl-2026-11" });
    expect(draft.markdown).toContain("HUKUKİ ONAY");
    expect(draft.version).toBe("tpl-2026-11");
  });

  it("hiç veri toplanmamışsa kibar boş durum kullanır", () => {
    const empty = generateAydinlatmaMetni({ ...ctx, collectedCategories: [], cookieCategories: [] });
    expect(empty.markdown).toContain("belirlenmedi");
  });
});
