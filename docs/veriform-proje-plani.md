# Veriform — Proje Planı

*Versiyon 0.2 · 2026-11-01 · Kaynak araştırma: [kvkk-gizlilik-saas-arastirma.md](kvkk-gizlilik-saas-arastirma.md) · Kritik doğrulama tamamlandı: [red-team-dogrulama.md](red-team-dogrulama.md) — plan bu sonuçlara göre revize edildi.*

---

## 1. Marka

| | |
|---|---|
| **Ad** | Veriform |
| **Alan adı** | veriform.io (RDAP'a göre büyük olasılıkla boş — hemen tescil edilmeli) |
| **Anlam** | TR *"veri"* + Latin *"veri-"* (verify/veritas = doğruluk): "doğrulanmış veri/form" |
| **Slogan adayları** | "Uyumun kanıtı." / "Proof of compliance." |
| **Çakışma durumu** | Aynı adı farklı sektörlerde 4 kullanıcı var (UK pazarlama ajansı, Verivend'in fon-admin yazılımı, Kanada metal üretimi, Hindistan siber güvenlik). Gizlilik-uyum SaaS sınıfında bilinen çakışma yok. **Aksiyon:** MVP döneminde TÜRKPATENT tarama + tescil; global giriş öncesi EUIPO/USPTO. |
| **Domain stratejisi** | veriform.io şimdi; veriform.com'un durumuna göre ileride teklif (park/aktif kontrolü yapılmalı). |

## 2. Vizyon ve tek cümlelik konumlandırma

> **Veriform, web sitelerinin kişisel veri toplama gerçeğini izleyen, kanıtlayan ve müşteriye özel konfigüre edilebilen uyum katmanıdır.** Form veri akış izleyici çekirdek üründür; çerez uyumu (CMP), rıza kanıtı ve DSAR paketin geri kalanıdır. Dağıtım: ajanslara beyaz etiket, çok kiracılı panel.

Çekirdek iddia (v0.2 revizyonu — red-team sonrası): form düzeyinde PII takibi **kurumsal bantta mevcut** (DataTrue $1.333/ay'dan; Reflectiz quote-only) — "küreselde hiç yok" iddiası geçersiz. **Boşluk, "self-servis + KOBİ fiyat bandı (~$50–200) + KVKK-referanslı" kombinasyonudur**: ne Türkiye'de ne küreselde bu bantta ürün var (en yakın: cerez.io $24–66/ay ama yalnız çerez CMP). Konumlandırma anlatısı: *"DataTrue'nun yaptığı işi, TR pazarının 1/20'si fiyatına self-servis yapmak."* Hız kritiktir — efilli boşluğu bir sürümde kapatabilir.

## 3. Sorun ve müşteri (ICP)

**Sorun:** Veri sorumlusu, kendi sitesindeki formların hangi kişisel veriyi kime gönderdiğini bilmiyor; aydınlatma/açık rıza yükümlülüklerini "form başına" ispatlayamıyor; cezalar büyüyor (2026'da üst sınır 17 mn TL; çerez cezası örneği 800.000 TL). Ajanslar müşterilerinin KVKK/GDPR uyumunu elle ve kanıtsız yönetiyor.

**Hedef müşteriler (öncelik sırasıyla):**
1. **Web/dijital ajanslar** — 10–100 müşteri sitesi; white-label + çoklu müşteri paneli alıcısı (dağıtım kanalı).
2. **E-ticaret işletmeleri** — 43.580 site (ETBİS 2024); çerez + form uyumu acil, kredi kartı/TC içeren formlar en riskli.
3. **Orta ölçekli veri sorumluları** — sigorta acenteleri, klinikler, eğitim, finans; form verisi hassas.
4. **Hukuk büroları / KVKK danışmanları** — müşterilerine kanıt üretecek araç arıyorlar; partner.

## 4. Ürün — 4 katman

```
[Kiracı: Ajans]──alt müşteriler──┐
[Kiracı: Doğrudan müşteri]───────┤
                                 ▼
1. TOPLAYICI (gömülü script) ── form keşfi, saha sınıflandırma, hedef tespiti
2. TARAYICI (headless farm) ── dönemsel tarama, çerez/script envanteri, diff uyarı
3. UYUM ÇEKİRDEĞİ ── Consent Mode v2/TCF banner, hash zincirli rıza kanıtı, TR saklama
4. ÇIKTILAR ── PII haritası raporu → metin üretici (versiyonlu) → DSAR (Faz 2)
```

**Modül listesi (Faz 0–2):**
- **Form İzleyici (çekirdek):** siteye gömülü 1. taraf script; form saha keşfi; PII sınıflandırma (TC Kimlik No algoritması, IBAN, e-posta, telefon, doğum tarihi, pasaport, kart ön eki + TR etiket sözlüğü + insan onaylı düzeltme döngüsü); gönderim hedef tespiti (submit/fetch/XHR hedef hostları — **yüklemesi değil, hedefi** kaydeder); değişiklik uyarısı ("yeni form/alan eklendi").
- **Çerez Uyumu:** headless çerez/script tarayıcı; Consent Mode v2 + IAB TCF 2.2 uyumlu banner; headless/API modu; banner metni versiyonlanır, her rıza metin hash'iyle bağlanır.
- **Rıza Kanıtı (mur):** append-only kanıt kaydı `{ts, tenant, site, banner_sürümü, metin_hash, kategoriler, prev_hash, self_hash}`; ihraç edilebilir denetim raporu; Türkiye'de saklama.
- **Metin Üretici (Faz 2):** aydınlatma metni, açık rıza metni, çerez politikası — form/veri tipine göre otomatik taslak, versiyonlu.
- **DSAR (Faz 2):** gömülebilir başvuru formu + kimlik doğrulama + yasal süre takibi.
- **Ajans Paneli:** çok kiracılı; müşteri başına marka/metin/konfigürasyon (senin "müşterilere özel düzenleme" fikrin); ajans raporları.

**Kritik tasarım ilkesi — izleyici ham veri saklamaz:** script yalnızca alan adı/meta veri ve tip tespiti kaydeder; değer içeriği asla sunucuya gitmez (opsiyonel "gelişmiş mod"da salt per-tenant tuzlu hash). Ürün kendisi KVKK sorunu yaratmamalı; bu aynı zamanda satışta güven argümanı.

**Kapsam dışı (non-goals) — v0.2, red-team kesinleştirmesiyle:**
1. **VERBİS kaydı / veri envanteri danışmanlığı veya modülü üretmeyiz** — yalnızca web-kanalı (form + çerez) kanıtını üretir, hukukçu/ajansa API ile ihraç ederiz (BBDAS-181 istisnası bu pazarı küçültüyor ama çerez/DSAR/aydınlatma yükümlülüklerini kaldırmıyor).
2. **Engelleme/temizlik yapmayız** (blocking, script rewrite, PCI/Magecart) — ürün read-only tespit + kanıt + rapordur; "prevent" roadmap'e girmez (Reflectiz/Feroot savaş alanı).
3. **Hukuki metin üretimini tek başımıza yapmayız** — metin şablonları partner hukuk katmanından gelir; biz metnin *uygulandığının* kanıtını tutarız (iubenda'nın çekirdeğine saldırı değil).
4. Publisher-side TCF/reklam gelir araçları yok (Didomi–Sourcepoint savaş alanı).
5. Mobil SDK Faz 3+.

## 5. Teknik mimari

| Bileşen | Seçim | Not |
|---|---|---|
| Gömülü script | Vanilla TS, <50 KB, 1. taraf sunum (tenant subdomain / CNAME) | pasif mod varsayılan; Consent Mode v2 sinyalleri |
| Tarayıcı | Playwright worker havuzu + kuyruk (BullMQ/Redis) | site başına sayfa bütçesi; diff tabanlı uyarı |
| Sınıflandırma | Kural motoru v0 → insan onayı → öğrenme katmanı (tenant düzeltmeleri global modele) | LLM yalnızca etiket/meta üzerinde, ham değer yok |
| Dashboard | Next.js + Postgres (RLS ile multi-tenant) + audit log | rol: ajans admin / müşteri / salt-okur denetçi |
| Kanıt deposu | Append-only tablo, hash zinciri; TR bölgesi (AWS İstanbul veya yerel sağlayıcı) | ihraç edilebilir PDF/CSV denetim raporu |
| Edge | Cloudflare CDN | hız + 1. taraf sunum güvenliği |

**Veri modeli (çekirdek varlıklar):** `tenants → clients → sites → forms → fields(kategori, güven, durum) → destinations → scans → cookies → consents(receipts) → dsar_requests → documents(versiyonlu) → users/audit`.

**Kendi uyumumuz:** ürün "işlemeye vesile olan" (processor) konumunda; müşteriye İVSS/DPA şablonu sunulacak — bu hem yasal gereklilik hem satış kancası. Kendi sitemizde tam şeffaf gizlilik politikası (ürün satan için güvenliksiz site karşı-farklılaştırıcı).

## 6. Yol haritası

**Faz 0 — MVP (8 hafta, 1–2 geliştirici + kurucu):**
- H1–2: embed script çekirdeği (form keşfi + kural sınıflandırma), tenant modeli, dashboard iskeleti
- H3–4: gönderim hedef tespiti, PII haritası raporu v1, ücretsiz "Form Taraması" sayfası (lead magnet)
- H5–6: headless çerez tarayıcı, Consent Mode v2 banner v1, hash zincirli rıza kanıtı
- H7–8: white-label skin + çoklu müşteri paneli; 3–5 pilot ajans onboarding; ölçüm altyapısı

**Faz 1:** tam CMP (TCF 2.2), değişiklik uyarıları, ajans rev-share programı, şeffaf fiyat sayfası canlı.
**Faz 2:** DSAR + metin üretici + platform eklentileri (WooCommerce → İdeasoft/Shopier/ikas).
**Faz 3:** headless/API-first CMP + ikinci hukuk paketi (GDPR derinleşme veya az hizmetlenmiş yargı bölgesi); marka tescili TR sonrası EUIPO.

**Faz 0 başarı kapıları (doğrulanmış ilerleme, nebuya dön/öl):**
- 3 pilot ajans aktif; ≥25 müşteri sitesi taranmış; ≥1 ajans ücretliye geçmiş.
- Sınıflandırma doğruluğu ≥%80 (insan onaylı örneklem).
- **Pivot kriterleri:** ajanslar white-label'a ilgi göstermezse doğrudan KOBİ kanalına; doğruluk <%60'sa sınıflandırmayı LLM'e kaydır; efilli form modülü çıkarıp fiyat kırarsa ajans+hukuk kanalına derinleş.

## 7. İş modeli (hipotez — pilot ile test edilecek)

| Plan | Fiyat | İçerik |
|---|---|---|
| Ücretsiz | ₺0 | 1 site form+çerez tarama raporu (lead magnet — satış kancası: "Sitenizde N form, M'si kişisel veri topluyor, K farklı 3. tarafa gönderiyor") |
| KOBİ | ~₺749/ay | 1 site: form izleme + CMP + rıza kanıtı |
| Pro | ~₺1.499/ay | 3 site + metin üretici + DSAR formu |
| Ajans | ~₺2.990/ay + ~₺299/müşteri | white-label, çoklu müşteri paneli, ajans raporu |
| Kurumsal | teklif | SLA, özel saklama, SSO |

Hesap: 6 ayda 100 ücretli site (~₺250K MRR hedefi, karışım ile). Türk rakiplerin neredeyse tamamı teklif-üstüne — şeffaf fiyat tek başına bir farklılaşma. Red-team notu: TR self-serve fiyat bandının varlığı doğrulandı (cerez.io Free / Pro $24–30 / Business $66, TRY faturalama) — bandımız üstünde ama form-izleme + kanıt içerdiği için farklılaşır.

## 8. Pazarlama (GTM)

1. **Ücretsiz Form Taraması** aracı — efilli'nin ücretsiz çerez tarayıcı kancasının rakipsiz olduğu alanı: form tarafı.
2. **Ajans partner programı** — white-label + %20 devamlı komisyon; 20 ajanslık hedef liste ile dışa satış.
3. **Platform mağazaları** — WooCommerce eklentisi ilk; sonra İdeasoft/Shopier/ikas (efilli–Ticimax iş birliği kanal talebini doğruladı).
4. **SEO içerik** — "KVKK form verileri", "çerez rehberi 2026 uygulaması" gibi konularda rakipsiz eğitim içeriği.
5. **Hukuk bürosu/danışman ortaklığı** — kanıt aracı olarak referans edilmek.

**KPI'lar:** taranan form sayısı, onaylı sınıflandırma sayısı, ücretsiz→ücretli dönüşüm, aktif ajans kiracı sayısı, kanıt kayıt hacmi, aylık churn (<%3 hedef).

**Red-team GTM okuması:** TR'de talep öncelikle ajans/platform kanalından tetikleniyor (Cerezgo'nun İkas/T-Soft kampanyaları) — kanal önceliği bu yüzden 2 ve 3'tedir; doğrudan KOBİ satışı ücretsiz taramanın kanıt raporuyla ısıtılır.

## 9.5. Red-team doğrulama özeti (2026-11-01)

7 çekirdek iddia sınandı — 2 CONFIRMED, 1 kısmen DISCONFIRMED, 4 UNCERTAIN. Tam rapor ve kaynaklar: [red-team-dogrulama.md](red-team-dogrulama.md).

| İddia | Sonuç |
|---|---|
| Küreselde self-serve form-PII ürünü yok | **Kısmen çürütüldü** — DataTrue ($1.333/ay) var; boşluk self-serve/KOBİ bandında |
| efilli'de form/envanter/DSAR modülü yok | **Doğrulandı** (bugün itibarıyla) — roadmap gizli olabilir, hız şart |
| TR KOBİ'ler gerçekten ödüyor | **Belirsiz** — cerez.io $24–66 bandı var; talep ajans/platform kanalından akıyor |
| Form takibi ürün mü feature mı | **Doğrulandı** — güvenlik tarafı ucuz add-on değil (Feroot ~$5K/yıl'dan) |
| Ajans white-label ince | **Kısmen çürütüldü** — iubenda programı olgun; derin konsol hâlâ boş |
| KVKK talebi büyüyor | **Belirsiz** — çerez rehberi sertleşti (olumlu); VERBİS istisnası genişledi (olumsuz; çerez/DSAR yükümlülükleri duruyor) |
| Teknik ölçeklenir, engel yok | **Doğrulandı-lean** — resmî patent taraması yapılmadı |

**En yakın 3 rakip:** DataTrue (8/10), Reflectiz (7/10), Usercentrics ücretsiz scan (5/10).
**Ana stratejik düzeltme:** anlatı "biricik ürün" değil — "kurumsal sınıf form-PII izlemede ~1/20 fiyatla self-servis + TR yasal derinliği + ajans konsolu".

## 9. Riskler ve karşı hamleler

| Risk | Karşı hamle |
|---|---|
| efilli form modülü ekler (dağıtımı güçlü) | Rapor-çekirdekli konum + ajans white-label (kurumsal modeline zıt) + kanıt hikâyesi |
| Yanlış pozitif sınıflandırma güven kaybı | İnsan onaylı düzeltme döngüsü; doğruluk metni şeffaf gösterim |
| İzleyicinin kendisi KVKK riski | Ham veri saklama yasağı (mimari ilke), DPA/DPIA, minimal veri |
| Banner emtialaşması (Consent Mode v2) | Banner paket içi özellik; gelir rapor+kanıt+DSAR'dan |
| Talep yavaşlığı | Ücretsiz tarayıcı kancası + hukuk bürosu kanalı |
| Marka çakışması | TÜRKPATENT taraması MVP'de; global öncesi EUIPO/USPTO |
| DataTrue/Reflectiz aşağı-yönlü fiyat kırması (self-serve KOBİ bandına inme) | Hız: TR'de KVKK-referanslı ilk self-serve ol; kanıt arşivi + ajans konsolu derinliği kopyalanması zor sur |
| Doğrudan KOBİ talebi zayıf olabilir (TR'de talep ajans/platform kanalından akıyor; TR WP eklentisi <10 kurulum) | GTM'de ajans+platform kanalı öncelikli; doğrudan KOBİ satışı ücretsiz tarama kanıt raporuyla ısıtılır |
| efilli boşluğa hızlı giriş (roadmap gizli, 1 release uzakta olabilir) | Haftalık MVP iterasyonu; hukuk bürosu/ajans referanslarını erken kilitle |
| iubenda tarzı olgun ajans programı (26. siteden %50'ye varan indirim + white-label) | "İndirim değil konsol": per-client konfigürasyon + ajans raporlama + müşteri başına evidence arşivi derinliği |
| Patent/ToS riski resmî olarak taranmadı | MVP öncesi USPTO/EPO patent taraması (script-based data collection monitoring) vekil ile |

## 10. Açık kararlar ve hemen yapılacaklar

1. veriform.io tescili (acil, ~$30–40/yıl) + veriform.com park/aktif kontrolü.
2. TÜRKPATENT marka taraması (patent vekili ile, MVP dönemi içinde tescil başvurusu) + USPTO/EPO patent taraması (red-team bulgusu: resmî tarama yapılmadı).
3. Pilot ajans listesi (20 ajans) + demo raporu mock-up'ı.
4. Faz 0 detaylı teknik şartnamesi (embed script sözleşmesi, sınıflandırma pipeline'ı, veri modeli DDL).
5. ~~Red-team sonuçlarının plana işlenmesi~~ — tamamlandı (v0.2).

---

*Bu plan, iki tur pazar araştırması + red-team doğrulama akışına dayanır; fiyatlar ve kapı kriterleri hipotezdir, Faz 0 pilotu ile doğrulanmak üzere yazılmıştır.*
