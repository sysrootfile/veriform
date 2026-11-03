/**
 * Metin üretici — planın non-goal'ü gereği hukuki metin YAZMAYIZ:
 * partner hukuk katmanının şablonunu, taramadan çıkan gerçeklerle
 * otomatik doldurur, versiyonlar ve "hukuki onay gerekir" damgasıyla sunar.
 * Şablon {{anahtar}} yer tutucuları kullanır; bilinmeyen yer tutucular
 * bilinçli olarak görünür kalır (hukukçunun düzenleme alanı).
 */

export interface DraftContext {
  siteUrl: string;
  contactEmail: string;
  /** İnsan onaylı, TR etiketli kategoriler (ör. "TC Kimlik No"). */
  collectedCategories: string[];
  /** Kullanılan çerez kategorileri (TR etiketli). */
  cookieCategories: string[];
  generatedAt: string;
}

export interface DraftOutput {
  title: string;
  markdown: string;
  version: string;
}

export const DEFAULT_TEMPLATE_VERSION = "tpl-default-2026-11";

export const DEFAULT_AYDINLATMA_TEMPLATE = `# {{siteUrl}} — Kişisel Verilerin Korunması Hakkında Aydınlatma Metni

> ⚠️ HUKUKİ ONAY GEREKTİRİR: Bu metin şablon ve tarama gerçeklerinden otomatik
> üretilmiştir; yayına almadan önce hukuk danışmanınız tarafından onaylanmalıdır.
> Şablon sürümü: {{templateVersion}} · Üretim: {{generatedAt}}

**Veri sorumlusu:** {{siteUrl}} · **İletişim:** {{contactEmail}}

## İşlenen Kişisel Veri Kategorileri

Web sitemizdeki formlar üzerinden şu anda şu kategorilerde kişisel veri toplanmaktadır:

{{collectedCategories}}

## Çerez Kullanımı

Sitemizde şu çerez kategorileri kullanılmaktadır: {{cookieCategories}}.
Çerez tercihlerinizi sayfa üzerindeki rıza yönetim aracından her zaman değiştirebilirsiniz.

## İşleme Amaçları ve Yasal Sebep

Verileriniz, yukarıda sayılan taleplerin karşılanması, hizmetlerin sunulması ve
iyileştirilmesi ile ilgili yükümlülüklerin yerine getirilmesi amacıyla, KVKK m.5/2
kapsamındaki uygun nedenlere ve gerektiğinde açık rızanıza dayanılarak işlenir.

## Haklarınız (KVKK m.11)

Veri sahibi olarak m.11 kapsamındaki haklarınızı sitemizdeki başvuru formundan
veya {{contactEmail}} adresinden kullanabilirsiniz. Başvurularınıza en geç 30 gün
içinde yanıt verilmektedir (KVKK m.13).
`;

export function renderTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) =>
    Object.hasOwn(vars, key) ? vars[key]! : match,
  );
}

function listToMarkdown(items: string[], emptyText: string): string {
  if (items.length === 0) return `_${emptyText}_`;
  return items.map((item) => `- ${item}`).join("\n");
}

export function generateAydinlatmaMetni(
  ctx: DraftContext,
  options: { template?: string; templateVersion?: string } = {},
): DraftOutput {
  const version = options.templateVersion ?? DEFAULT_TEMPLATE_VERSION;
  const template = options.template ?? DEFAULT_AYDINLATMA_TEMPLATE;
  const markdown = renderTemplate(template, {
    siteUrl: ctx.siteUrl,
    contactEmail: ctx.contactEmail,
    collectedCategories: listToMarkdown(
      ctx.collectedCategories,
      "Tarama sonucuna göre form kaynaklı kategori belirlenmedi.",
    ),
    cookieCategories: listToMarkdown(ctx.cookieCategories, "Çerez kategorisi belirlenmedi."),
    templateVersion: version,
    generatedAt: ctx.generatedAt,
  });
  return { title: `Aydınlatma Metni — ${ctx.siteUrl}`, markdown, version };
}

export const DEFAULT_ACIK_RIZA_TEMPLATE = `# {{siteUrl}} — Açık Rıza Beyanı ve Onam Metni

> ⚠️ HUKUKİ ONAY GEREKTİRİR: Bu metin şablon ve tarama gerçeklerinden otomatik
> üretilmiştir; yayına almadan önce hukuk danışmanınız tarafından onaylanmalıdır.
> Şablon sürümü: {{templateVersion}} · Üretim: {{generatedAt}}

**Veri sorumlusu:** {{siteUrl}} · **İletişim:** {{contactEmail}}

## AÇIK RIZA

Aşağıda sayılan kişisel verilerimin, belirtilen amaçlarla işlenmesine ve
üçüncü taraflarla paylaşılmasına **açık rıza** veriyorum:

{{collectedCategories}}

Bu rızayı dilediğim zaman geri alabileceğimi; geri almanın geçmişe dönük
işlemleri etkilemeyeceğini biliyorum (KVKK m.5/2, m.11/6).
`;

export const DEFAULT_CEREZ_POLITIKASI_TEMPLATE = `# {{siteUrl}} — Çerez Politikası

> ⚠️ HUKUKİ ONAY GEREKTİRİR: Bu metin şablon ve tarama gerçeklerinden otomatik
> üretilmiştir; yayına almadan önce hukuk danışmanınız tarafından onaylanmalıdır.
> Şablon sürümü: {{templateVersion}} · Üretim: {{generatedAt}}

**Veri sorumlusu:** {{siteUrl}} · **İletişim:** {{contactEmail}}

## Çerezler Nedir?

Çerezler, web sitesini ziyaret ettiğinizde cihazınıza kaydedilen küçük metin
dosyalarıdır. Zorunlu çerezler hizmetin çalışması için gereklidir; diğer
çerezler yalnızca rızanız ile kullanılır.

## Sitemizde Kullanılan Çerez Kategorileri

{{cookieCategories}}

## Tercihlerinizi Yönetme

Çerez tercihlerinizi sayfamızın altındaki rıza aracından her zaman görüntüleyebilir,
değiştirebilir veya geri alabilirsiniz. Tercihleriniz cihazınızda saklanır ve
değişiklik yaptığınızda yeniden rıza istenir.
`;

export function generateAcikRizaMetni(
  ctx: DraftContext,
  options: { template?: string; templateVersion?: string } = {},
): DraftOutput {
  const version = options.templateVersion ?? DEFAULT_TEMPLATE_VERSION;
  const markdown = renderTemplate(options.template ?? DEFAULT_ACIK_RIZA_TEMPLATE, {
    siteUrl: ctx.siteUrl,
    contactEmail: ctx.contactEmail,
    collectedCategories: listToMarkdown(
      ctx.collectedCategories,
      "Açık rıza gerektiren kategori belirlenmedi.",
    ),
    templateVersion: version,
    generatedAt: ctx.generatedAt,
  });
  return { title: `Açık Rıza Metni — ${ctx.siteUrl}`, markdown, version };
}

export function generateCerezPolitikasi(
  ctx: DraftContext,
  options: { template?: string; templateVersion?: string } = {},
): DraftOutput {
  const version = options.templateVersion ?? DEFAULT_TEMPLATE_VERSION;
  const markdown = renderTemplate(options.template ?? DEFAULT_CEREZ_POLITIKASI_TEMPLATE, {
    siteUrl: ctx.siteUrl,
    contactEmail: ctx.contactEmail,
    cookieCategories: listToMarkdown(ctx.cookieCategories, "Çerez kategorisi belirlenmedi."),
    templateVersion: version,
    generatedAt: ctx.generatedAt,
  });
  return { title: `Çerez Politikası — ${ctx.siteUrl}`, markdown, version };
}
