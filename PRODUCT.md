# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Birincil: dijital ajanslar — müşterilerinin sitelerini toplu izleyen, beyaz-etiket panelle rapor sunan ekipler.
İkincil: doğrudan site sahipleri (KOBİ) — tek/az siteli, kendi KVKK uyumunu takip edenler.
İkisi de self-service kayıt olur, paket seçer; özelleştirme isteyince iletişim formundan ulaşır.
(Kitle vurgusu kullanıcı kararı, 2026-11-18: "ikisi de, ajans vurgulu".)

## Product Purpose

KVKK/çerez uyumu SaaS'ı: siteye eklenen embed script form veri-akışını izler (alan değeri okumadan),
headless tarayıcı taraması form envanteri + çerez + hedef raporu üretir, rıza kanıtları kurcalama
kanıtlı zincirde saklanır. Ajans paneli çok kiracılı ve beyaz-etiket. Başarı: müşterinin kendi
sitesinin uyum durumunu kanıtla gösterebilmesi.

## Positioning

"İzleyici ham veri saklamaz; kanıtlar kurcalama kanıtlı zincirde." Gizlilik-önce tasarım:
embed yalnızca meta veri (name/label/type), kategori tahmini ve hedef origin+path kaydeder.
Kanıt zinciri (hash-linked) + denetim izi + CSV kanıt ihracı — komşu ürünün kopyalayamayacağı
mekanizma iddiası değil, ölçülmüş çalışan özellik.

## Operating Context

Tek sunucu Docker compose (panel + Postgres), sürümlü migration'lar, `/healthz` DB probu,
worker cron ucu, TLS ters proxy arkası hedef. Panel Türkçe. Embed panelin kendi `/embed.js`
ucundan servis edilir (CDN yok). Kamu uçları: `/tarama` (demo tarama), `/login`, `/register`,
`/healthz`, `/embed.js`, DSAR ve headless API.

## Capabilities and Constraints

- Embed script (PII sınıflandırma, hedef gözlemi), headless tarama, çerez kategorileri,
  Consent Mode v2 banner konfigürasyonu, rıza kanıt zinciri, DSAR, e-posta bildirimleri,
  denetim izi, API anahtarları, çizelgeli tarama.
- Paket adları kullanıcı kararı: Starter / Pro / Ultimate. Fiyatlandırma kullanıcı tarafından
  ajana delege edildi ("sektörel standartlara göre belirleyebiliriz"); ödeme entegrasyonu
  kapsam dışı, sonraki karar. Paket seçimi şimdilik iletişim formu üzerinden ilerler.
- Mimari kısıt: framework yok — saf render fonksiyonları (`src/panel/render.ts` deseni),
  tüm girdi HTML'e kaçırılır, ince glue `server.ts`. Landing aynı desende yaşar.
- BUSL-1.1 lisans; Licensor ünvanı kullanıcıda, doldurulmadı.

## Brand Commitments

Ad: Veriform. Dil: Türkçe, kısa düz cümleler, "sen" hitabı. Beyaz-etiket: kiracı vurgu rengi
(#rrggbb) + logo; panel varsayılan vurgusu #1e7a46 (mühür yeşili). Logo varlığı yok — uydurma logo/testimonial
kullanılmaz.

## Evidence on Hand

- Gerçek müşteri/testimonial/benchmark YOK — landing'de uydurulamaz.
- Ölçülmüş kapılar: `docs/deploy.md` §11–16 canlı ölçüm tabloları (healthz, worker, Secure+throttle,
  migration, nav+embed). Sayılar yalnız buradan alınır.
- `docs/` belgeleri araştırma niteliğinde; hukuki uygunluk iddiası kurulamaz.

## Product Principles

1. Ham veri saklama — meta veri ve kanıt yeterli.
2. Kanıt zinciri kurcalamayı görünür kılar; iddia değil ölçüm konuşur.
3. Self-service: kayıt → paket → kurulum müşteri tarafından tamamlanabilir; özelleştirme insana düşer.
4. Türkçe, kısa, düz dil; geliştirici jargonu müşteri yüzeyine sızmaz.