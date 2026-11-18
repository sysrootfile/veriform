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
pnpm typecheck   # tsc --noEmit
pnpm build       # dist/ → embed + panel + scan bundle'ları
```

Paneli lokal çalıştırmak için oturum anahtarı zorunlu — kodda ve compose'da default yok:

```bash
SESSION_SECRET=$(openssl rand -hex 32) pnpm panel
```

Postgres entegrasyon testleri yalnızca `PG_URL` verilince koşar (örn. docker'da
`postgres:16-alpine` + `pnpm migrate` ile şeması kurulmuş veritabanı):

```bash
# `pnpm test -- <dosya>` filterı vitest'e ulaşmıyor — tüm suite'i koşar; tek dosya için:
PG_URL=postgresql://postgres:veriform@127.0.0.1:54329/veriform pnpm exec vitest run src/panel/store.pg.test.ts
```

CI: `pnpm typecheck` + `pnpm build` + birim suite'i ve `postgres:16-alpine` service'ı üzerinde
entegrasyon koşusu (`.github/workflows/ci.yml`). Entegrasyon job'ı test atlanmışsa bilerek
kırmızıya düşer — sessiz yeşil, `PG_URL` kapısının sessiz `describe.skip`'ı yüzünden yanıltıcı olur.

## Mimari ilkeler

1. **İzleyici ham veri saklamaz** — script yalnızca alan adı/meta veri kaydeder; değer içeriği sunucuya hiç gitmez.
2. Multi-tenant: ajans → alt müşteri → site hiyerarşisi.
3. Kanıt kayıtları append-only ve hash zincirli; Türkiye'de saklanır. *(Tek istisna: ajans bir müşteriyi kalıcı sildiğinde o müşterinin siteleri, taramaları ve kanıt zinciri birlikte silinir — silme öncesi dönem için append-only geçerlidir.)*

## Anahtar rotasyonu (SESSION_SECRET)

`SESSION_SECRET` zorunludur ve varsayılanı yoktur; eksik veya bilinen geliştirme değeri ise panel boot etmez (exit 1). Rotasyon oturumları düşürmeden yapılır:

1. `.env` içinde `SESSION_SECRET_PREVIOUS`e mevcut anahtarı yaz, `SESSION_SECRET`ı yenisiyle değiştir (`openssl rand -hex 32`).
2. `docker compose up -d` — imzalama yalnız yeni anahtarla yapılır, doğrulama yeni + eski listeyi kabul eder.
3. Bir tam oturum süresi (7 gün) sonra `SESSION_SECRET_PREVIOUS` satırını sil ve yeniden up et; eski çerezler o anda düşer.

Aynı ayrım worker ucu için de geçerli: `/internal/run-scheduled` `WORKER_TOKEN` ister, oturum anahtarı header'a sızmaz; `WORKER_TOKEN` tanımsız uç 403 döner.

## Deploy

Tek sunucuda `docker compose up -d --build` ile panel + Postgres ayağa kalkar; `/healthz` `store:"postgres"` döner. Zorunlu anahtarlar, şema init tuzağı, tarama zamanlayıcısının iki modeli (dahili döngü vs `WORKER_TOKEN`'lı cron), TLS/register kapatma ve yedek-geri alma adımları: [docs/deploy.md](docs/deploy.md).

## Embed kurulumu (v0 demo)

```bash
pnpm build:embed   # dist/veriform-embed.js (~11 KB IIFE)
```

Panel embed'i kendi adresinden servis eder: `GET /embed.js` (oturum gerekmez, `max-age=3600`).
Müşteri sitesine eklenecek snippet — `<panel-adresi>` ve token'ı müşteri detay sayfası hazır gösterir:

```html
<script src="https://<panel-adresi>/embed.js" data-site-token="…" async></script>
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

## Lisans

BUSL-1.1 (Business Source License 1.1) — bkz. [LICENSE](LICENSE). Kopyalamak, değiştirmek ve **production dışı** kullanmak serbest; ticari/production kullanımı lisansörün ticari lisansına tabi. Her sürümün Change Date'inden (`November 7, 2030`) ya da ilk public dağıtımdan dört yıl sonra (hangisi önce gelirse) o sürüm AGPL-3.0+ altına geçer.

`LICENSE` dosyasındaki `Licensor` ve `Licensed Work` telif satırı henüz placeholder — yayın/dağıtım kararından önce hukuki ünvanla doldurulmalı.
