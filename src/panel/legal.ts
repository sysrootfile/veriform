/**
 * Kamu yasal sayfaları — kullanım şartları, gizlilik/KVKK aydınlatma, çerez politikası.
 * Metinler ürünün gerçek davranışını anlatır; hukuki ünvan [Ünvan] placeholder'ı
 * kullanıcı tarafından doldurulur (LICENSE ile aynı karar). Hukuki yeterlilik ayrı inceleme ister.
 */

import { FONT_FACES, WORLD_TOKENS, WORLD_BASE, SHEET_CSS, LEGAL_CSS, sheetOpen } from "./design.js";

const LEGAL_STYLE = `${FONT_FACES}
${WORLD_TOKENS}
${WORLD_BASE}
${SHEET_CSS}
${LEGAL_CSS}`;

function legalPage(title: string, body: string): string {
  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} — Veriform</title>
<style>:root { --sheet-w: 860px; }
${LEGAL_STYLE}</style>
</head>
<body>
<nav class="legal-nav"><a href="/">← Veriform ana sayfa</a></nav>
${sheetOpen(title)}
${body}
<footer class="legal-footer">
  <a href="/kullanim-sartlari">Kullanım Şartları</a>
  <a href="/gizlilik">Gizlilik ve KVKK</a>
  <a href="/cerez-politikasi">Çerez Politikası</a>
  <a href="/#iletisim">İletişim</a>
</footer>
</div>
</body>
</html>`;
}

export function renderTermsPage(): string {
  return legalPage(
    "Kullanım Şartları",
    `<h1>Kullanım Şartları</h1>
<p class="muted">Yürürlük: 24 Kasım 2026 · Hizmet sağlayıcı: [Ünvan] ("Veriform")</p>

<h2>1. Hizmetin kapsamı</h2>
<p>Veriform; web sitelerindeki formların veri akışını, çerezleri ve onay kayıtlarını izleyen,
tarama sonuçlarını kurcalamaya dayanıklı bir hash zinciriyle kayıt altına alan bir uyum aracıdır.
Hizmet, panel erişimi ve sitenize eklenen izleyici betiği ile sunulur.</p>

<h2>2. Yetkili kullanım</h2>
<p>Veriform'u yalnızca sahibi olduğunuz veya tarama için yetkili olduğunuz sitelerde kullanabilirsiniz.
Yetkisiz sitelerin taranması, hizmeti hukuka aykırı amaçla kullanmak ve izleyiciyi yanıltıcı
biçimde konumlandırmak yasaktır.</p>

<h2>3. Hesap ve güvenlik</h2>
<p>Hesabınızın ve şifrenizin gizliliğinden siz sorumlusunuz. Şüpheli bir durumda şifrenizi
paneldeki Hesap sayfasından değiştirebilir veya hesabınızı silebilirsiniz.</p>

<h2>4. Paketler ve kota</h2>
<p>Kayıtta seçilen paket (Starter, Pro, Ultimate) site kotasını belirler. Kota aşımında yeni
site eklenemez; paket değişimi için operatörle iletişime geçilir. Fiyat ve kota değişiklikleri
ileriye dönük uygulanır, mevcut döneminizi etkilemez.</p>

<h2>5. Sorumluluk sınırı</h2>
<p>Hizmet "olduğu gibi" sunulur. Veriform, uyum sürecinizi destekleyen bir kanıt aracıdır;
hukuki tavsiye vermez ve tek başına KVKK/GDPR uyumunu garanti etmez. Yürürlükteki hukukun
izin verdiği azami ölçüde, dolaylı zararlardan sorumluluk kabul edilmez.</p>

<h2>6. Fesih</h2>
<p>Hizmeti dilediğiniz zaman paneldeki Hesap sayfasından hesabınızı silerek sonlandırabilirsiniz;
hesap silme, kiracılarınıza ait tüm panel verilerini kalıcı olarak kaldırır. Bu şartların
ihlalinde hesabınız askıya alınabilir veya kapatılabilir.</p>

<h2>7. Uygulanacak hukuk</h2>
<p>Bu şartlar Türkiye Cumhuriyeti hukukuna tabidir. Ticari lisans ve kurumsal sözleşmeler
ayrıca akdedilir; kaynak kod lisansı (BUSL-1.1) bu şartlardan bağımsızdır.</p>`,
  );
}

export function renderPrivacyPage(): string {
  return legalPage(
    "Gizlilik ve KVKK Aydınlatma",
    `<h1>Gizlilik ve KVKK Aydınlatma Metni</h1>
<p class="muted">Yürürlük: 24 Kasım 2026 · Veri sorumlusu: [Ünvan] ("Veriform")</p>

<h2>1. Hangi verileri işliyoruz</h2>
<div class="table-scroll">
<table>
<tr><th>Veri</th><th>Amaç</th></tr>
<tr><td>Hesap: ad, e-posta, şifre özeti (scrypt ile geri döndürülemez)</td><td>Hesap kurulumu ve oturum yönetimi</td></tr>
<tr><td>Site adresleri ve tarama sonuçları: form alan adlarını, çerez ad/kategorileri, hedef alan adları</td><td>Uyum kanıtı üretimi</td></tr>
<tr><td>Onay makbuzları: karar, zaman damgası, banner sürümü, hash zinciri</td><td>Kurcalamaya dayanıklı kanıt defteri</td></tr>
<tr><td>DSAR başvuruları: başvuru sahibinin adı ve e-postası</td><td>KVKK başvuru sürecinin yürütülmesi ve kaydı</td></tr>
<tr><td>İletişim formu: ad, e-posta, şirket, mesaj</td><td>Talebinizin yanıtlanması</td></tr>
</table>
</div>
<p><strong>İzleyici, form içeriklerini saklamaz.</strong> Form alanlarının adlarını ve çerez
kategorilerini kaydeder; ziyaretçinin yazdığı mesajları, e-posta içeriklerini veya şifreleri
toplamaz ve iletmez.</p>

<h2>2. Hukuki sebepler</h2>
<p>Hesap ve tarama verileri sözleşmenin ifası kapsamında; kanıt defteri kayıtları hukuki
yükümlülüklerin yerine getirilmesi ve meşru menfaat (uyum kanıtı) kapsamında işlenir.
Ziyaretçi onayına ilişkin makbuzlar, ilgili sitenin kendi açık rıza sürecinin kaydıdır.</p>

<h2>3. Aktarım</h2>
<p>Verileriniz pazarlama amacıyla üçüncü taraflarla paylaşılmaz. Barındırma ve e-posta
iletimi için altyapı sağlayıcıları veri işleyen olarak görev yapar. Yasal zorunluluk
halinde yetkili kurumlara aktarım yapılabilir.</p>

<h2>4. Saklama süresi</h2>
<p>Panel verileri hesabınız aktif kaldığı süre boyunca saklanır. Hesabınızı sildiğinizde
kiracınıza ait müşteriler, siteler, taramalar, makbuzlar ve DSAR kayıtları kalıcı olarak silinir.</p>

<h2>5. KVKK 11. madde hakları</h2>
<p>KVKK'nın 11. maddesi uyarınca; verilerinizin işlenip işlenmediğini öğrenme, bilgi talep etme,
düzeltme, silme ve itiraz haklarına sahipsiniz. Başvurunuzu <a href="/#iletisim">iletişim formu</a>
üzerinden iletebilirsiniz; site sahipleri için panelde ayrıca DSAR yönetim ekranı bulunur.
Başvurular en geç 30 gün içinde yanıtlanır.</p>

<h2>6. Güvenlik</h2>
<p>Şifreler scrypt ile özetlenir; oturum çerezleri HttpOnly ve SameSite=Lax'tır, üretimde
Secure bayrağıyla taşınır. Kanıt defteri kayıtları sha256 hash zinciriyle birbirine bağlanır;
sonradan değişiklik doğrulama sırasında tespit edilir.</p>`,
  );
}

export function renderCookiePolicyPage(): string {
  return legalPage(
    "Çerez Politikası",
    `<h1>Çerez Politikası</h1>
<p class="muted">Yürürlük: 24 Kasım 2026 · Veri sorumlusu: [Ünvan] ("Veriform")</p>

<h2>1. Veriform'un kendi çerezleri</h2>
<p>Veriform paneli ve landing sitesi analitik veya pazarlama çerezi kullanmaz.
Yalnızca oturum yönetimi için zorunlu bir çerez kullanılır:</p>
<div class="table-scroll">
<table>
<tr><th>Ad</th><th>Tür</th><th>Özellik</th><th>Süre</th></tr>
<tr><td>vf_session</td><td>Zorunlu (oturum)</td><td>HttpOnly, SameSite=Lax; üretimde Secure</td><td>Oturum süresi</td></tr>
</table>
</div>

<h2>2. İzleyici betiği (embed)</h2>
<p>Müşteri sitesine eklenen Veriform izleyicisi çerez yazmaz. Sitedeki mevcut çerezlerin
adlarını ve kategorilerini envanterler; içeriklerini okumaz veya aktarmaz.</p>

<h2>3. Müşteri sitelerinin çerezleri</h2>
<p>Veriform'un izlediği siteler kendi çerezlerini kendileri belirler. Bu çerezler için
aydınlatma ve onay yükümlülüğü ilgili site sahibine aittir; Veriform bu yükümlülüğün
kanıtlanmasını kolaylaştıran tarama ve onay makbuzu araçları sunar.</p>

<h2>4. Tarayıcı ayarları</h2>
<p>Zorunlu oturum çerezini tarayıcınızdan engelleyebilirsiniz; bu durumda panel girişi
çalışmaz. Landing ve bu sayfalar çerez olmadan da okunabilir.</p>`,
  );
}