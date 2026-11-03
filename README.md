# Veriform

> Uyumun kanıtı. / Proof of compliance.

Web sitelerinin kişisel veri toplama gerçeğini izleyen, kanıtlayan ve müşteriye özel konfigüre edilebilen uyum katmanı. Çekirdek ürün: **form veri akış izleyici** (hangi form hangi kişisel veriyi topluyor, nereye aktarıyor). Paket: çerez uyumu (Consent Mode v2 / TCF 2.2), hash zincirli rıza kanıtı, DSAR. Dağıtım: ajanslara beyaz etiket, çok kiracılı panel.

- Pazar araştırması: [docs/kvkk-gizlilik-saas-arastirma.md](docs/kvkk-gizlilik-saas-arastirma.md)
- Proje planı (Faz 0–3, ICP, fiyat hipotezi, riskler): [docs/veriform-proje-plani.md](docs/veriform-proje-plani.md)

## Geliştirme akışı

TDD mantığında ilerleriz: **kırmızı test → yeşil implementasyon → refactor → commit/branch → PR (remote varsa)**.

```bash
pnpm install
pnpm test        # vitest run
pnpm test:watch  # vitest
```

Postgres entegrasyon testleri yalnızca `PG_URL` verilince koşar (örn. docker'da
`postgres:16-alpine` + `src/panel/schema.sql` uygulanmış veritabanı):

```bash
PG_URL=postgresql://postgres:veriform@127.0.0.1:54329/veriform pnpm test -- src/panel/store.pg.test.ts
```

## Mimari ilkeler

1. **İzleyici ham veri saklamaz** — script yalnızca alan adı/meta veri kaydeder; değer içeriği sunucuya hiç gitmez.
2. Multi-tenant: ajans → alt müşteri → site hiyerarşisi.
3. Kanıt kayıtları append-only ve hash zincirli; Türkiye'de saklanır. *(Tek istisna: ajans bir müşteriyi kalıcı sildiğinde o müşterinin siteleri, taramaları ve kanıt zinciri birlikte silinir — silme öncesi dönem için append-only geçerlidir.)*

## Embed kurulumu (v0 demo)

```bash
pnpm build:embed   # dist/veriform-embed.js (~11 KB IIFE)
```

Müşteri sitesine eklenecek snippet:

```html
<script src="https://cdn.veriform.io/v1/veriform-embed.js" async></script>
```

Script sayfada `window.__veriform` tanıtıcısını açar:

```js
__veriform.getReport()          // PII haritası: formlar, kategoriler, hedefler, risk işaretleri
__veriform.getObservedTargets() // canlı submit/fetch/XHR hedefleri (origin+path, değer içermez)
__veriform.detach()             // tüm gözlemcileri söker
```

İlke: script **alan değerlerini okumaz**; yalnızca meta veri (name/label/type), kategori tahmini ve hedef origin+path kaydeder.

## Tarama (sunucu tarafı)

```bash
pnpm scan -- https://ornek-site.com.tr   # JSON rapor + canlı hedefler
```

Gerçek headless tarayıcıya (kurulu chromium; yoksa Windows'ta Edge kanalı) embed'i enjekte eder, sayfayı yükler, `FormInventoryReport` + gözlemlenen `fetch`/`XHR` hedeflerini JSON olarak basar. Testleri yerel fixture sunucuyla koşar — dış ağ bağımlılığı yok.

## Durum

Faz 0 — MVP (8 hafta): embed script çekirdeği (form keşfi + PII sınıflandırma) → hedef tespiti + rapor v1 → çerez tarayıcı + Consent Mode v2 banner + rıza kanıtı → white-label ajans paneli + pilot (3–5 ajans).
