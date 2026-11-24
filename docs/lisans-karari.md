# Lisans kararı — Veriform

Karar tarihi: 2026-11-07. Uygulanan lisans: **BUSL-1.1**, gövde metni `LICENSE`, parametreler aşağıda.
Bu doküman bir hukuki tavsiye değil; mühendislik/ticari tercih kaydı ve tekrar açma şartlarıdır.
Hukuki uygunluk için ayrı inceleme gerekir — ölçülmedi, bu dosya onu iddia etmiyor.

## 1. Kısa karar

Yurt dışı pazar için lisans modeli **BUSL-1.1 olarak bırakıldı**, sebebi Change License'ın zaten
AGPL-3.0+ seçilmiş olması: bugün ticari münhasırlık penceresi, dört yıl sonra gerçek açık kaynak.
Yani "BSL mi açık kaynak lisansı mı" sorusu iki zıt seçenek değil, aynı yolun iki aşaması.

Tekrar açma şartı (ikisinden biri olursa bu karar gözden geçirilir):

1. Aşağıdan gelen (bottom-up) yurt dışı benimseme ana büyüme kanalı olur — kurumsal satış değil.
   O zaman AGPL-3.0 + dual licensing sürtünmeyi düşürür (§5).
2. AB kamu/ihale segmenti belirleyici olur ve dış katkı telif zinciri tek elde toplanamaz. O zaman
   telif devri gerektirmeyen tam-copyleft bir seçenek (AGPL ya da EUPL) öne çıkar.

Kararın dayandığı ölçülen satırlar (`LICENSE`, 87 satır):

| Alan | Değer | Satır |
|---|---|---|
| Licensor | placeholder — hukuki ünvan kullanıcı tarafından doldurulacak | 5 |
| Licensed Work | `Veriform. The Licensed Work is (c) 2026 [placeholder]` | 6–7 |
| Change Date | `November 7, 2030` | 8 |
| Change License | `GNU Affero General Public License v3.0 or later` | 9 |
| Additional Use Grant | `None` | 10 |

## 2. Hedef → lisans eşlemesi

Sorunun doğru biçimi "hangi lisans daha iyi" değil, "hangi büyüme hedefi hangi lisansı taşır".

| Hedef | Uygun lisans | Neden |
|---|---|---|
| Kaynak görünsün, ama rakipler üretimde ücretsiz kullanamasın | **BUSL-1.1** (mevcut) | Production kullanımı ancak lisansörün ticari lisansıyla serbest (`LICENSE:34-37`) |
| Kurumsal müşteri "kendi sunucumda çalıştırabilirim" der, katkı beklenmez | BUSL-1.1 + ticari lisans sözleşmesi | Sözleşme kapısı metinde zaten var |
| Yurt dışından organik/alttan benimseme, PR'lar, entegrasyon ekosistemi | **AGPL-3.0 + dual licensing** | OSI listesinde, kurumsal politikalar engellemiyor |
| Tamamen açık, yaygın benimseme, ticari münhasırlık umurunda değil | MIT / Apache-2.0 | En az sürtünme; karşılığında rakip ayrımı yok |
| AB kamu ihalesi / devlet kurumuna satış | AGPL-3.0+ veya **EUPL-1.2** | Non-OSI terimler genelde listede dışarıda kalıyor |
| KVKK/GDPR hassas regüle müşteri, veri taahhüdü ön planda | Lisans tek başına yetmez | DPA + işleyen sözleşmesi ayrı belgeler |

## 3. BUSL-1.1 bugün ne veriyor, ne vermiyor

Veriyor (metinden, `LICENSE:23-27`): kopyalama, değiştirme, türev üretme, yeniden dağıtım ve
**non-production** kullanım. Additional Use Grant `None` olduğu için production'da ücretsiz kullanım yok.

Vermiyor:

- OSI açık kaynak statüsü. Metnin kendi Notice'ı bunu açıkça söylüyor (`LICENSE:14-16`):
  "The Business Source License ... is not an Open Source license."
- Ticari markalar. Marka/logo hakkı tanınmıyor (`LICENSE:53-55`).
- Garanti. "AS IS" + tüm garantiler reddediliyor (`LICENSE:57-61`).

Geçiş zamanı iki kapılı ve hangisi önce gelirse o geçerli (`LICENSE:28-32`): tanımlı Change Date
**veya** belirli bir sürümün bu lisansla ilk public dağıtımının dördüncü yılı. Yani 2030'da
doldurulmuş bir Change Date, daha erken yayınlanmış sürümler için fiilen öne çekilebiliyor.

## 4. Yurt dışı sürtünmeler — ölçülen iki madde

**a) Non-OSI dışlaması.** Birçok kurumsal ve kamu alım politikası kabul edilen lisansları OSI
spdx listesi üzerinden filtreliyor. Ölçülen durum: SPDX `license-list-data` kaydı
`json/details/BUSL-1.1.json` → `isOsiApproved: false`, `name: Business Source License 1.1`. Metin
bunu kendi Notice'ında da kabul ediyor (`LICENSE:14-16`). Sonuç: teknik olarak uygun olsa da satın
alma formunda "open source: hayır" satırına takılabilir. **ÖLÇÜLMEDİ:** hangi hedef müşteri
segmentinin bu filtreyi gerçekten uyguladığı — örnek ihale metni toplanmadı.

**b) Mahkeme önünde denenmemiş metin + hukuki forum belirsizliği.** BSL 2017'de yazıldı, yaygın ama
içtihadı zayıf. Bu depo ölçümüyle somut olan nokta: `grep -inE "governing law|jurisdiction|venue|applicable law|arbitrat" LICENSE`
tek satır döndürüyor — 57. satırdaki garanti reddi ifadesi ("TO THE EXTENT PERMITTED BY APPLICABLE LAW").
Yani lisans metninde **uygulanacak hukuk ve yetkili mahkeme/kolaylaştırılmış tahkim kaydı yok**.
Bu, BSL'ye özgü bir eksik değil (çoğu yazılım lisansında yok), ama sınır ötesi satışta tek başına BSL'ye
güvenilmesini zayıflatıyor. Çözüm lisans değişikliği değil: ayrı ticari lisans sözleşmesi + DPA.

## 5. Alternatif: AGPL-3.0 + dual licensing

Eğer strateji "yurt dışından alttan benimseme" ise, AGPL-3.0 daha az sürtünmeli ve network-use
(madde 13) ile SaaS'ta copyleft'i gerçekten koruyor. Ticari münhasırlık ise **dual licensing** ile
sürer: aynı kod AGPL alan için AGPL, kapalı ürününe gömmek isteyen için ücretli ticari lisans.

Bu modelin üç ön koşulu var ve hiçbiri bugün karşılanmış değil:

1. **Telif devri / CLA.** Dış katkıcıların kodu AGPL altında kalırken aynı kodu üçüncü kişiye
   satabilmek için her katkının ticari lisanslama hakkını da devretmesi gerekir. Ölçülen durum:
   repoda CLA, `CODE_OF_CONDUCT`, katkı politikası veya contributor telif akorduna dair dosya yok;
   `docs/` listesinde ve `.github/` altında böyle bir dosya bulunmadı (`.github/` yalnız `workflows`
   içeriyor). Telif tek kurucuda ise gerekli değil; dış katkı gelirse **zorunlu**.
2. **Fiyat kapısı.** "Ticari lisans" satılabilir bir şey olmalı: support SLA, hosted versiyon,
   markasız white-label veya ek modül. Ölçülen durum: repoda fiyat listesi veya satılabilir
   lisans paketi tanımlayan bir dosya yok.
3. **Dışa dönük copyleft yükü.** Asıl gerilim bağımlılık tarafında değil dağıtım tarafında: panel
   AGPL altında dağıtıldığında, beyaz-etiket ajansın kendi müşterisine sunduğu kurulum da AGPL
   yükümlülüğü altına girer (kaynak temini + Change License zinciri). Çok kiracılı ajans modeli
   bununla doğrudan çelişir; bu yüzden AGPL'e geçiş ancak ajans segmenti ticari lisansa
   yönlendirilirse temiz olur. BUSL-1.1'de aynı sorun yok — production kullanım zaten lisans
   gerektiriyor (`LICENSE:23-27,34-37`).

Karşılaştırmalı özet:

| | BUSL-1.1 (mevcut) | AGPL-3.0 + dual |
|---|---|---|
| OSI açık kaynak | hayır | evet |
| Production kullanımı | ticari lisans ister | AGPL yükümlülüğünü kabul edene serbest |
| Münhasırlık | 4 yıl / Change Date'e kadar | yalnızca satılan ticari lisansta |
| Dış katkı | gerekmez | CLA/telif devri gerektirir |
| Kurumsal filtre riski | var | düşük |
| İçtihat / mahkeme geçmişi | zayıf | AGPLv3 görece denenmiş |

## 6. Neden diğerleri değil

- **MIT / Apache-2.0:** sürtünme sıfıra yakın, ama rakip ürünün aynı kodu kapalı satmasını
  engellemez. Bu projenin ayrımcı değeri tarama + kanıt zinciri + KVKK yerelliği; kapalı çatal
  bunu ticarileştirebilir. Elenmiştir.
- **GPL-3.0 (AGPL'siz):** SaaS'ta network kullanımı copyleft tetiklemiyor; yani sunucusu "hediye"
  olur. SaaS ürünü için AGPL'den zayıf.
- **EUPL 1.2:** AB için yazılmış, kamu alımında avantajlı. AGPL v3+ ile uyumlu olduğu
  belirtiliyor; **ÖLÇÜLMEDİ:** bu uyumluluk EUPL'in resmi ek listesinde metin olarak
  doğrulanmadı. Ama pazar/kullanım coğrafyası AB odaklı; küresel farkındalığı düşük ve mevcut
  Change License'ı EUPL yapmak Covenants of Licensor madde 1 (GPL-2.0 uyumluluğu) çerçevesinde
  mümkün olsa da AGPL kadar tanınmıyor. Yalnız AB kamu segmenti belirleyici olursa masaya gelir.
- **Kaynak-kod public ama lisanssız:** telif varsayımıyla yeniden dağıtım fiilen yasak kalır; en
  kötü seçenek.

## 7. Lisans dışında kalan, ama lisansı tamamlayan belgeler

BUSL-1.1 bir yazılım lisansıdır; hizmet sözleşmesi değildir. Yurt dışı satışta ayrıca gerekir:

- **Ticari lisans sözleşmesi:** uygulanacak hukuk, yetkili mahkeme, ödeme/süre, sınırlı sorumluluk
  tavanı, fesih.
- **DPA / GDPR-KVKK işleyen sözleşmesi:** Veriform form verisi akışını izleyen bir araç; kendi
  müşterisinin verisini işleyen bir SaaS olarak bu ayrılmaz. `docs/` içinde KVKK araştırma notları
  var, imzalanabilir DPA taslağı yok.
- **Sub-processor listesi ve SLA:** kurumsal alımın standart istekleri.

**Ölçülen durum:** bu üç belgenin hiçbiri repoda taslak olarak yok (`docs/` ve `.github/`
listeleri kontrol edildi). **ÖLÇÜLMEDİ:** hazırlanmaları ve hukuki yeterlilikleri — bu doküman
taslak üretmiyor ve üretmeli mi kararını da vermiyor.

## 8. Bu dokümanın kararlaştırmadıkları

- `Licensor` ve telif satırları placeholder olarak duruyor (`LICENSE:5-7`); hukuki ünvanı kullanıcı
  kendisi dolduracak — bu bir mühendislik kararı değil.
- Repoya public kararı uygulandı (2026-11-24): iş geliştirme notları history'den çıkarıldı,
  yayın temiz history'li yeni repoda yapıldı.
- LICENSE gövdesinin değiştirilmesi bir tercih değil, kapalı seçenek: Covenants of Licensor madde 4
  "Not to modify this License in any other way" diyor (`LICENSE:86`). Parametre alanları
  (Licensor / Change Date / Additional Use Grant) doldurulabilir; gövde SPDX metni ile birebir
  kalmak zorunda. Bu depoda doğrulandı: yazılan gövde ile SPDX BUSL-1.1 `licenseText` arasındaki
  `diff` boş çıktı.
- AGPL'e erken geçiş, bir sonraki sürümden itibaren mümkün (Change Date'i öne çekmek veya
  sürüm-bazlı Change License); mevcut sürümlerin BUSL hakları geriye dönük düşmüyor, çünkü lisans
  sürüm başına ayrı uygulanıyor (`LICENSE:39-42`). Bu geçişin yapılıp yapılmayacağı burada
  kararlaştırılmadı.
