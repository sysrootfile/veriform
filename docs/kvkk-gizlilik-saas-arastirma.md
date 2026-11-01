# KVKK / Gizlilik Uyum SaaS — Pazar Araştırması

*Tarih: 2026-11-01 · Kapsam: efilli + Türkiye pazarı, global consent/privacy SaaS ekosistemi, fırsat boşlukları. Tüm iddialar kaynak URL'leriyle bağlantılıdır.*

---

## 1. Yönetici Özeti

- Global gizlilik yönetim yazılımı pazarı ~**$5,1 milyar (2025)**, %20–39 CAGR bandıyla büyüyor (Grand View Research).
- Türkiye'de pazar ikiye bölünmüş: **CMP (çerez/rıza)** odaklılar (efilli, Cerezgo…) ve **envanter-VERBİS-DSAR** odaklılar (TuneSoft, KVKNET…). Neredeyse hiçbirinde şeffaf fiyat yok.
- **Ana boşluk:** Ne globalde ne Türkiye'de, bir web sitesindeki **formların hangi kişisel veriyi topladığını ve bu verinin nereye aktığını izleyen** self-servis bir ürün var. Kurucunun "form içeriklerini takip etme" fikri tam bu boşlukta — teknik uygulanabilirlik akademik çalışmayla kanıtlı.
- İkinci güçlü boşluk: **ajans/e-ticaret platformu white-label + müşteri başına özelleştirilebilir multi-tenant panel**.

---

## 2. Efilli Analizi (referans ürün)

**Mevcut ürün portföyü** (efilli.com, Kasım 2026): efilli bugün bir "KVKK suite" değil, bir **rıza yönetim platformu (CMP) + erişilebilirlik şirketi**. Sitemap ve ana sayfada yalnızca şu modüller var: Web Sitesi Rıza Yönetimi (çerez banner'ı), Mobil Uygulama Rıza Yönetimi (iOS/Android SDK), Çerez Tarayıcı, Dijital Erişilebilirlik tarayıcısı, Google Consent Mode v2 / IAB TCF 2.2 entegrasyonları (https://efilli.com, https://efilli.com/sitemap.xml). GitBook dokümantasyonunda ek olarak Analitik ve A/B test modülleri var (https://efilli.gitbook.io/efilli).

**Kritik bulgu:** "Form izleme", veri envanteri, VERBİS modülü, veri sahibi başvuru (DSAR) yönetimi bugün efilli'nin sitede, sitemap'te ve dokümantasyonda **yok** — yalnızca blog içeriklerinde değiniyorlar. CMP + erişilebilirliğe odaklanmış; "gömülebilir, müşteri başına özelleştirilebilir KVKK araç seti" tarafı lokalde boşalmış durumda.

**Konumlandırma ve ölçek:** "Türkiye'nin lider rıza yönetim platformu"; 510+ kurumsal müşteri, aylık 114,4M+ rıza, 3.000+ alan adı; hedef sektörler bankacılık, e-ticaret, sigorta, turizm (https://efilli.com). Rıza kayıtları Türkiye'de saklanıyor (veri lokalizasyonu satış argümanı); KVKK + GDPR + LGPD + CCPA iddiası. Banka referansları: Kuveyt Türk, QNB Portföy, Denizbank, Fibabanka.

**Firma:** 2019'da KOSGEB AR-GE desteğiyle kuruldu, Türk Telekom Pilot + İTÜ Çekirdek ekosistemi, İzmir Ege Teknopark. Halka açık yatırım turu bulunamadı. Ocak 2026'da **Ticimax** ile iş birliği (https://blog.itucekirdek.com, https://efilli.com/hakkimizda).

**Fiyatlandırma:** Yayınlanmış fiyat listesi yok (fiyatlandırma sayfası 404). Planlar: Başlangıç / Hesaplı / Kurumsal, 7 gün deneme, ücretsiz çerez tarayıcı aracı (https://efilli.com/website-cerez-tarayici). → SMB'de şeffaf self-servis fiyatlama boşluğu var.

---

## 3. Türkiye Rakip Ekosistemi

| Ürün / Firma | Ne sunuyor | Tip | Fiyat |
|---|---|---|---|
| **Cerezgo (Nesil Teknoloji)** | KVKK/GDPR çerez banner'ı, tarama, Consent Mode v2 (https://www.cerezgo.com.tr) | Gerçek SaaS CMP | — |
| **Cookiespool (Dataspool)** | KVKK/GDPR/ePrivacy çerez rızası, onay kayıtları lokal sunucuda | SaaS CMP | — |
| **Cookie Seal** | Çerez takip/rıza, zaman damgalı kayıt (https://cookieseal.com) | SaaS CMP | — |
| **Trusthoop** | KVKK/GDPR veri envanteri otomasyonu (https://www.trusthoop.com) | SaaS suite | — |
| **TuneSoft** | KVKK platformu: veri envanteri, yönetişim; LuckyEye ortaklığı (https://tunesoft.com.tr) | SaaS + danışmanlık | — |
| **KVKNET** | Veri envanteri, VERBİS, aydınlatma/açık rıza, iç denetim, imha; 7 gün deneme | SaaS | Talep üzerine |
| **Veribenim** | Çerez yönetimi, açık rıza log, DSAR, veri envanteri | SaaS | — |
| **AuditRunner** | Düşük kodlu KVKK uyum + veri envanteri | SaaS | — |
| **Cyberverse sKVKK** | Veri sahibi başvuru takibi, iç denetim (https://www.cyberverse.com.tr/sKVKK.pdf) | Kurumsal araç | — |
| **E-KVK** | Bulut KVKK yazılımı, VERBİS entegrasyonu | SaaS | — |
| **UYAÇ** | Sigorta acenteleri için sektörel uyum yazılımı | Sektörel SaaS | — |
| **Diğerleri** | Peerlog, KVKSİS, Bilimp, Mechsoft, İkarus Bilişim | Çoğunlukla danışmanlık yan ürünü | — |
| **Global (TR'de kullanılan)** | OneTrust, TrustArc, Securiti, Cookiebot | Olgun SaaS | Yüksek fiyat + veri dışa aktarım sorunu |

**Özet:** Pazar (1) CMP odaklı ve (2) envanter-VERBİS-DSAR odaklı (genelde danışmanlık firmalarının yazılım kolları) ikiye bölünmüş. Neredeyse hiçbirinde açık fiyat yok; UX ve geliştirici deneyimi zayıf; **"form başına veri toplama izleme" hiçbir rakipte belgelenmiş modül değil.**

---

## 4. Düzenleyici Ortam (Türkiye)

- **Yurt dışına veri aktarımı reformu:** 7499 sayılı Kanun (RG 12.03.2024), KVKK m.9 değişikliği, 01.06.2024 yürürlük; yönetmelik 10.07.2024. Standart sözleşme + Kurum akreditasyonu geldi; yurt dışı sorumlulara **temsilcilik yükümlülüğü** para cezasına bağlandı (https://turunc.av.tr/news/kisisel-verilerin-korunmasi-kanununda-yapilan-onemli-degisiklikler, https://gun.av.tr/tr/goruslerimiz/guncel-yazilar/kisisel-verilerin-yurt-disina-aktarilmasi-rehberi-yayinlandi).
- **Çerez rehberi:** "Çerez Uygulamaları Hakkında Rehber" Temmuz/Ağustos 2025'te güncellendi (https://www.kvkk.gov.tr/SharedFolderServer/CMSFiles/fb193dbb-b159-4221-8a7b-3addc083d33f.pdf). 2022/1358 sayılı Kurul kararı: aydınlatma metnine link tek başına yeterli değil (https://www.kvkk.gov.tr/Icerik/7595/).
- **Cezalar:** 2024'te toplam 552,67 mn TL ceza (Sondakika/Ankara Gazetesi 30.12.2024). Nisan 2025 itibarıyla kümülatif **1,02 milyar TL**, 49.019 ihbar (https://www.ntv.com.tr/ntvpara/kvkkdan1-milyar-24-milyon-786-bin-liralik-idari-para-cezasi,Rei40-N4q0ClAGyXFEDjeQ). 2025'te 594 veri sorumlusuna VERBİS cezası, 328 ihlal bildirimi (KVKK 2025 Faaliyet Raporu). Çerez/aydınlatma ceza örneği: e-ticaret firmasına 800.000 TL (https://hukukvebilisim.org/kvkk-cerez-metni-cezasi).
- **2026 ceza tutarları** (+%25,49 yeniden değerleme; https://www.alomaliye.com/2026/01/07/6698-sayili-kisisel-verilerin-korunmasi-kanunu-kapsaminda-ipc-tutarlari/): Aydınlatma 85.437–1.709.200 TL; veri güvenliği 256.357–17.092.242 TL; VERBİS 341.809–17.092.242 TL.
- **VERBİS kapsamı:** Eşik 50+ çalışan veya 100 mn TL+ bilanço; özel nitelikli veri ve yurt dışı sorumlular her koşulda kapsamda. **1 Ekim 2025 BBDAS-181 kararıyla 10 çalışanın altındaki, özel nitelikli veri işlemeyen küçük sorumlular muaf tutuldu** → kayıt-aracı pazarı daralırken "kayıtsız KOBİ'nin çerez/aydınlatma uyumu" pazarı büyüdü.
- **E-ticaret:** ETBİS Nisan 2024: 36.777 işletme / 43.580 site; Ticaret Bakanlığı 2023 sonu: 559.412 e-ticaret işletmesi; 2024 e-ticaret hacmi 1,85 trilyon TL, %59 büyüme.

---

## 5. Global Oyuncular

| Oyuncu | Odak | Segment | Fiyat modeli |
|---|---|---|---|
| **OneTrust (+CookiePro)** | En geniş kurumsal gizlilik süiti (CMP, DSAR, data mapping, AI governance) | Enterprise | Modüler teklif; consent girişi ~$10–45/ay/domain, üst ~$2.000/ay (https://www.enzuzo.com/blog/onetrust-vs-cookiebot, https://sprinto.com/blog/onetrust-review) |
| **TrustArc** | Kurumsal gizlilik program yönetimi | Enterprise | ~$30–75K/yıl, $100–400K'ya çıkıyor (https://www.vendr.com/marketplace/trustarc) |
| **Usercentrics** | Kurumsal CMP + etkileşim analitiği | Mid/Enterprise | Oturum (session) bazlı, teklif ile (https://usercentrics.com/us/pricing) |
| **Cookiebot** | SMB için basit, sertifikalı CMP | Mikro/SMB | ~€7–90+/ay/domain, 50 alt sayfaya kadar ücretsiz (https://www.cookiebot.com/us/pricing) |
| **Didomi (+Sourcepoint)** | Publisher/marka odaklı CMP; 2025'te Sourcepoint'i aldı | Enterprise/Publisher | Teklif bazlı (https://www.didomi.io/consent-management-platform) |
| **Osano** | Etik CMP + satıcı riski | Mid/Enterprise | Teklif bazlı |
| **Termly** | ABD odaklı politika + banner; ajans planı | Mikro/SMB | Ücretsiz katman; $10–20/ay; Agency planı (https://termly.io/pricing/) |
| **iubenda** | Çok dilli politika üretici + banner | Mikro/SMB | €5–90/ay + €5/1.000 consent (https://www.iubenda.com/en/pricing) |
| **Ketch** | "Veri kontrol düzlemi" | Mikro→Enterprise | Ücretsiz (5.000 kullanıcı) → $150 → $499/ay → enterprise (https://www.ketch.com/pricing) |
| **Transcend** | Geliştirici odaklı DSR otomasyonu + veri keşfi | Enterprise | Teklif bazlı (https://transcend.io) |
| **DataGrail** | "Live Data Map" sürekli sistem tespiti + DSR | Enterprise | ACV ~$40–90K (https://www.vendr.com/marketplace/datagrail) |
| **MineOS** | E-posta taramasıyla hızlı data mapping + DSAR | Mid-market | Teklif bazlı (https://saymine.com) |
| **Quantcast Choice / Sourcepoint** | Publisher TCF CMP | Publisher | Quantcast ücretsiz katman |

Segment ayrımı: **SMB self-servis** = Cookiebot, Termly, iubenda, Ketch alt katman. **Enterprise** = OneTrust, TrustArc, Didomi, Transcend, DataGrail. Fiyat kalıpları: domain/alt-sayfa, oturum/trafik, kullanıcı sayısı, yıllık kurumsal abonelik.

**Tipik ürün modülleri:** (1) çerez tarayıcı + banner CMP (hepsi; Consent Mode v2 + TCF 2.2 farklılaştırıcı — https://developers.google.com/tag-platform/security/guides/consent), (2) rıza kayıt/kanıt (consent log), (3) data mapping / RoPA otomasyonu (DataGrail Live Data Map), (4) DSAR kabulu + kimlik doğrulama (Transcend Privacy Center), (5) izleyici taraması (Termly haftalık, iubenda saatlik), (6) politika üretici, (7) satıcı/DPA yönetimi, (8) ihlal bildirim akışı, (9) AI governance (en yeni), (10) veri keşif taraması.

---

## 6. Form Düzeyinde PII Takibi — Ana Boşluk

**Ana akım hiçbir CMP veya SMB gizlilik süiti, web sitenizdeki formların hangi PII'yi topladığını ve verinin nereye aktığını haritalayan bir ürün sunmuyor.** Uyum araçları veri toplayıcıları kendileri keşfedemediği için doğru girdiye muhtaç (https://cside.com/blog/best-ai-tools-for-website-privacy-compliance); geliştiriciler de form denetimi yapan araç arıyor (https://www.reddit.com/r/gdpr/comments/1t0se2n/tool_to_check_a_website_for_gdpr_compliance).

En yakın mevcut yaklaşımlar:
- **Client-side güvenlik izleme (en yakın kategori, yanlış alıcı):** Reflectiz üçüncü taraf scriptlerin hangi verilere eriştiğini izler ama alıcısı güvenlik ekibi (https://www.reflectiz.com/use-cases/website-privacy-compliance). Benzer: cside, VaultJS, Feroot, Cloudflare client-side security — hepsi Magecart/skimmer odaklı, kurumsal güvenlik fiyatlı.
- **Akademik kanıt:** Sprecher vd. (2022), Firefox'ta üçüncü taraf scriptlerin form alanlarındaki PII'ye erişimini izledi — fikir teknik olarak uygulanabilir (https://oaklandsok.github.io/papers/sprecher2022.pdf).
- **Veri keşfi araçları (yanlız yüzey):** DataGrail SaaS entegrasyonlarını tarar, web formlarını değil; Transcend SaaS/veri ambarı keşfi yapar; Privado kod seviyesinde analiz eder, geliştirici aracıdır.
- **Form platformu içi:** Jotform yalnızca kendi barındırdığı formlarda PII tespit ediyor.

**Sonuç:** Güvenlik tarafı teknik altyapı kanıtlı; "her müşteri sitesinin formlarını tarayıp hangi PII'nin nereye aktığını uyum raporuna çeviren" self-servis ürün boşluğu açık.

---

## 7. Pazar Büyüklüğü ve Trendler

- Grand View Research: gizlilik yönetim yazılımı pazarı 2025'te **$5,1 milyar**, 2026'da $6,6 milyar, 2033'te **$68,2 milyar** (%39,5 CAGR) (https://www.grandviewresearch.com/industry-analysis/privacy-management-software-market-report). Firmalar arası tahminler geniş; makul konsensüs ~$5 milyar (2025) + %20–25 CAGR.
- **İticiler:** Google Consent Mode v2 zorunluluğu (Mart 2024, EEA/UK), IAB TCF 2.2, ABD eyalet yasaları (https://iapp.org/resources/article/us-state-privacy-legislation-tracker), server-side tagging kayması (Didomi'nin Addingwell alımı), AI governance.
- **Konsolidasyon:** Didomi €72M + Addingwell (2025) + Sourcepoint (Temmuz 2025) (https://www.prnewswire.com/news-releases/didomi-and-sourcepoint-join-forces-to-build-the-future-of-privacy-technology-302500014.html); Osano WireWheel alımı; OneTrust $4,5B değerleme, $500M+ ARR, Kasım 2025'te PE satış görüşmeleri haberleri (https://en.wikipedia.org/wiki/OneTrust).

---

## 8. Boşluklar ve Çıkabilecek Proje Fikirleri

**Kalabalık segmentler:** genel çerez banner'ı (fiyat savaşı), kurumsal süit.

**Fırsatlar (bulgularla hizalı):**

1. **Form/PII haritalama çekirdekli ürün** — "Sitenizdeki her formun hangi kişisel veriyi topladığını ve nereye gönderdiğini izler, KVKK/GDPR raporuna çevirir." Doğrudan rakip yok; en güçlü fark. CMP + form izleme tek paket.
2. **Ajans / white-label + multi-tenant panel** — Termly'nin Agency planı talebi doğruluyor ama sığ; müşteri başına ayrı konfigürasyon/rapor derinliği kimse sunmuyor. Türkiye'de e-ticaret platformları (İdeasoft, Shopier, ikas, İnginery vb.) ve web ajansları kanal.
3. **Şeffaf self-servis fiyat** — Türk rakiplerin neredeyse tamamı teklif-üstüne; KOBİ'de açık fiyatlı ürün güçlü differentiator.
4. **Headless/API-first CMP** — Transcend geliştirici odaklı ama kurumsal fiyatlı; SMB'de yok.
5. **E-ticaret platformu ekosistemi** — Shopify/WooCommerce/İdeasoft eklentisi olarak form+çerez+DSAR bütünleşik paket (efilli–Ticimax iş birliği bu kanalın talebini doğruluyor).
6. **Dikey "compliance in a box"** — e-ticaret, klinik/sağlık, eğitim, sigorta acentesi gibi dikeylerde paketli uyum.
7. **Türkiye'ye özgü katman:** VERBİS entegrasyonu, Türkçe doküman üretimi, yerel veri saklama (efilli'nin satış argümanı), TL fiyatlandırma, yurt dışı aktarım (standart sözleşme) takip modülü.

**Riskler:** efilli CMP'de 510+ kurumsal müşteri ve banka referanslarıyla güçlü; Ekim 2025 VERBİS muafiyeti envanter-kayıt araç pazarını daralttı; Consent Mode v2/TCF CMP'yi emtialaştırıyor → farklılaşma form-düzeyi izleme + kanıt/audit log + ajans white-label olmalı.

---

## 9. Önerilen Konumlandırma (sentez)

> "Sitenize gömülü, müşterinize özel konfigüre edilebilir uyum katmanı: form veri izleme + çerez uyumu + rıza kanıtı + DSAR — ajanslarınıza ve müşterilerinize beyaz etiketli, şeffaf fiyatla."

MVP önerisi: (1) form tarayıcı/izleyici (PII tespiti + hedef tespiti), (2) çerez tarayıcı + Consent Mode v2 uyumlu banner, (3) zaman damgalı rıza ve form kanıt kaydı (audit log), (4) müşteri başına özelleştirilebilir multi-tenant ajans paneli. Global kıyas noktaları: Reflectiz'in izleme tekniği + Termly'nin self-servis modeli + efilli'nin yerel veri saklama argümanı.
