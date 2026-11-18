---
version: 1
slug: "src-panel-landing-ts"
primary_target: "src/panel/landing.ts"
related_targets: ["src/panel/server.ts"]
---

# Surface brief — landing (`/`, src/panel/landing.ts)

Kapsam: kamu landing, Persuade. Kitle: ajans vurgulu + doğrudan site sahipleri (PRODUCT.md).
Eylem: kayıt (/register) veya iletişim formu (POST /contact); ikincil: demo tarama (/tarama).
Kanıt: ürünün kendi mekanizması — hash zinciri canlı demo; gerçek müşteri/testimonial yok, uydurulmaz.
Kısıt: saf render fonksiyonu, framework yok, tüm metin statik/escape'li; Türkçe; mobil responsive.

## Direction contract

THESIS: Landing'in kendisi uyum defteridir — her tarama deftere işlenen kayıt, her kayıt bir öncekine hash halkasıyla mühürlü. Kategorinin hero+üç-kart dizilimini reddeder; kanıt mekanizması ilk ekranda ziyaretçinin eliyle çalışır.

OWN-WORLD: Soğuk defter kağıdı #f6f7f4, Türk defterinin mavi çizgisi #2447c9, kırmızı marj #c93a2e, mürekkep #191d26, mühür yeşili #1e7a46, uyarı amber #b45309. Renk yalnız çizgi/marj/mühürde; metin akromatik. Archivo (display 900/700) + Spline Sans Mono (kanıt numeralleri), self-host woff2. Cilt delikleri, antet, mühür kaşesi.

STORY: Ziyaretçi "siteniz ne topluyor?" sorusunu görür → deftere örnek tarama ekler, kurcalar, zincirin kırıldığını kendi eliyle görür → kanıtın nasıl üretildiğine inanır → paketini seçer → formu mühürler ya da defteri açar.

FIRST VIEWPORT: Tam genişlik defter yaprağı; solda kırmızı marj + cilt delikleri, üstte antet "VERİFORM — UYUM DEFTERİ"; başlık defterin ilk kaydı olarak Archivo 900 ~5rem; altında canlı demo defteri (2 seed satır + hash halkaları) ve üç kontrol: "Örnek tarama ekle", "Kurcala", "Zinciri doğrula"; birincil eylem "Defteri aç" mühür-buton başlığın hemen altında, demo kontrolleri yaprağın sağ kolonunda.

FORM: Zincir Defter — grounded listemde 5. sıra (1 Noter Mühürü, 2 Veri Akış Paftası, 3 Tebligat Zarfı, 4 Denetim Dosyası, 5 Zincir Defter, 6 Dilekçe, 7 Kasa Fişi). Seed key: 850108bb. Raise'ler: kiln (satır inline meta), bulut (renk yalnız çizgide), quiz (net varış: form), ASCII (tek grid + mono numerals), laban (iki kolon kanıt).

İmza etkileşim: gerçek sha256 zinciri browser'da (crypto.subtle) — ekle/kurcala/doğrula; mühür basma animasyonu (scale 0.95→1 + opacity, cubic-bezier(0.23,1,0.32,1), 200ms; reduced-motion'da yalnız opacity).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
