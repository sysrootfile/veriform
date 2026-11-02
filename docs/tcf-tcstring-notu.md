# IAB TCF 2.2 — Gerçek TC String Üretimi Teknik Notu (Veriform)

*Araştırma: 2026-11-02 · Tüm noktalar resmî IAB kaynaklarından doğrulandı · Bağlam: mevcut `__tcfapi` sinyal yüzeyimiz tcString boş döner (bkz. src/consent/tcfapi.ts)*

---

## 1. CMP kaydı: süreç + maliyet

- Kayıt yalnızca **CMP Portal** üzerinden: `register.consensu.org/CMP`. Başvuru sonrası **IAB Europe'un yönettiği CMP Validation testi** geçilmeli; geçen CMP'ye **benzersiz CMP ID** atanır ve resmî listeye girilir. **Yıllık ücret €1.575** (vendor kaydı aynı ücret, GVL Portal'dan). Yayıncılar ücret ödemez; "private CMP" olarak da kayıt mümkün. Kaynak: [Join the TCF](https://iabeurope.eu/join-the-tcf/).
- Kayıt sonrası **TCF Compliance Program** sürekli yükümlülük: ön doğrulama (her ortam için UI + teknik), sürekli denetim, şikâyet mekanizması. **CMP Validator** (Chrome eklentisi) self-test için hazır. **TC String'e müdahale → min 4 hafta askıya alma + kamuya duyuru**; tekrar → kalıcı askı. Kaynak: [TCF Compliance Programmes](https://iabeurope.eu/tcf-compliance-programmes/).
- CMP policy yükümlülükleri: [TCF for CMPs](https://iabeurope.eu/tcf-for-cmps/).

## 2. TC String teknik yapısı + kütüphane

Resmî spec: [Consent string and vendor list formats v2 (IAB Tech Lab GitHub)](https://github.com/InteractiveAdvertisingBureau/GDPR-Transparency-and-Consent-Framework/blob/master/TCFv2/IAB%20Tech%20Lab%20-%20Consent%20string%20and%20vendor%20list%20formats%20v2.md).

- **Format:** nokta ile ayrılmış segmentler. **Core (SegmentType 0) zorunlu; DisclosedVendors (1) v2.3'ten beri zorunlu; PublisherTC (3) opsiyonel (type 2 değil!)**. Kodlama URL-safe base64.
- **Core alanları (bit genişlikleri):** Version 6 (=2); Created/LastUpdated 36'şar bit (epoch deciseconds); CmpId 12; CmpVersion 12; ConsentScreen 6; ConsentLanguage 12 (harf başına 6 bit); VendorListVersion 12; TcfPolicyVersion 6 (v2.2 → 4); **IsServiceSpecific 1 — her zaman 1 (0 ise string geçersiz)**; SpecialFeatureOptIns 12; PurposesConsent 24; PurposesLITransparency 24 (**v2.2'de amaç 3–6 için LI kaldırıldı → bitler 0**); PurposeOneTreatment 1; PublisherCC 12; VendorConsent/VendorLI (MaxVendorId 16 + IsRangeEncoding 1 + bitfield/range); NumPubRestrictions 12 + girişler.
- **Range kodlaması:** encoder, bitfield ile range arasından küçük çıktıyı seçmeli.
- **Kütüphane:** resmî monorepo [iabtcf-es](https://github.com/InteractiveAdvertisingBureau/iabtcf-es). Eski `@iabtcf/core` scope'u ~4 yıldır güncellenmiyor; güncel paket **`@iabtechlabtcf/core`** (1.5.22, Apache-2.0, TCF v2.3 desteği). `@iabtechlabtcf/core` + `@iabtechlabtcf/cmpapi` kullanın.

## 3. GVL gereklilikleri

- URL: `https://vendor-list.consensu.org/v3/vendor-list.json`; arşiv `vendor-list-v{N}.json`; diller `purposes-{lang}.json`. Eski host 31 Ocak 2021'de kapandı.
- Güncelleme **haftalık (Perşembe 17:00 CET)**; fetch **yalnızca sunucu tarafı** (tarayıcıdan GVL çekmek yasak), Cache-Control başlıklarına uyulmalı (~7 gün). Eski GVL sürümleri statiktir → süresiz cache'lenebilir; TC String yorumlanırken **string'e gömülü GVL versiyonu** kullanılır.

## 4. Veriform için karar matrisi

- **Consent Mode v2, TCF'den bağımsızdır:** Google reklam ürünlerinin EEA/UK şartlığı CMv2'dir; `gtag consent default/update` ile **TCF'siz çalışır** ([Google guide](https://developers.google.com/tag-platform/security/guides/consent)).
- **Gerçek TC String yalnızca şart:** müşteri EEA/UK kullanıcılarına **programatik reklam** (Ad Manager/AdSense, SSP/DSP) ile para kazanıyor ve vendor'lar TCF sinyali bekliyorsa. Ad Manager/AdSense bu senaryoda **TCF-integrated certified CMP** ister (+ [Additional Consent](https://support.google.com/admanager/answer/9681920)).
- **KVKK-odaklı, reklam-olmayan senaryo:** TC String gereksiz — mevcut `__tcfapi` sinyal katmanı + Consent Mode yeterli. TC String yokluğu analitiği kırmez; yalnızca programatik reklam zincirinde sinyal taşınmaz.
- **"Kiralanmış CMP ID" yasaktır:** spec, TC String'in yalnızca kayıtlı CMP'nin **kendi ID'si ile** üretilebileceğini söyler ([Confiant consent-tampering vakası](https://www.confiant.com/news/consent-tampering)). TCF'yi kullanmak (badge dahil) kayda tabidir.

## 5. Önerilen yol haritası

1. **Şimdi:** Consent Mode v2 + mevcut stub'i koru. TR/KVKK segmenti için gerçek TC String gerekmiyor.
2. **Tetikleyici:** AB programatik reklam müşterisi açılırsa → (a) `@iabtechlabtcf/core` ile Core+DisclosedVendors+PublisherTC üretimi (~1 hafta), (b) sunucu GVL proxy + cache (2–3 gün), (c) policy-uyumlu UI + CMP Validator self-test — **1–2 geliştirici için tahmini toplam 4–8 hafta**, (d) CMP kaydı **€1.575/yıl** + validation (süreç haftalar sürebilir).
3. **Köprü:** AB-reklam müşterisine geçici olarak certified bir CMP önerip Veriform'u KVKK kanıt katmanında tutmak; ya da Google Additional Consent köprüsü.

**Sonuç:** Mevcut "dürüst stub" stratejisi doğrulandı — hedef pazarda (TR KVKK uyumu) TC String zorunlu değil; yatırım tetikleyiciye ertelendi.
