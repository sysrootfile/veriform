import { panelPage } from "./render.js";
import type { SetupProgress } from "./types.js";

/**
 * Panel içi rehber — ürünün ne yaptığını ve kurulum akışını anlatır.
 * Operate modu: panelin mevcut sade düzeni korunur, içerik statiktir.
 */
export function renderGuidePage(setup?: SetupProgress | undefined): string {
  return panelPage(
    "Rehber",
    `<h1>Rehber — Veriform ne işe yarar, nasıl ilerlersiniz?</h1>
<p class="empty">Veriform sitenizdeki formları ve çerezleri tarar, ziyaretçiden izin almanızı sağlar ve her işlemi denetimde gösterilecek şekilde kayda geçirir. Ajanslar müşterilerinin sitelerini tek panelden izler. Ham form verisi asla saklanmaz — yalnızca alan adları, çerez kategorileri ve hedef adresler kaydedilir.</p>

<h2>Ne işe yarar?</h2>
<ul>
<li><strong>Form veri envanteri:</strong> sitenizde hangi formların kişisel veri topladığını görün. TCKN, IBAN, kart gibi hassas alanlar sınıflandırılır; GET ile hassas veri gönderimi ve 3. taraf hedefler risk olarak işaretlenir.</li>
<li><strong>Rıza kanıt zinciri:</strong> ziyaretçinin her izni zaman damgasıyla kayda geçer. Kayıtlar sha256 ile birbirine bağlanır; sonradan kurcalama doğrulamada görünür. Kanıtı CSV olarak indirip denetimde gösterirsiniz.</li>
<li><strong>DSAR başvuruları:</strong> veri sahibinin silme/erişim talepleri site anahtarı üzerinden gelir. KVKK m.13 yanıt süresi (30 gün) izlenir, tek uzatma hakkı denetlenir.</li>
<li><strong>Değişiklik uyarıları:</strong> iki tarama arasında yeni form/alan veya çerez kategorisi çıkınca site sayfasında raporlanır ve sahibine e-posta gider.</li>
</ul>

<h2>Hangi ihtiyaçları karşılar?</h2>
<ul>
<li><strong>"Sitemde ne toplandığını bilmiyorum"</strong> → tarama raporu: formlar, alanlar, çerezler, hedefler, riskler.</li>
<li><strong>"Ziyaretçiden geçerli izin almam gerekiyor"</strong> → tek satır izleme kodu + rıza bannerı; her tercih kayda geçer.</li>
<li><strong>"Denetimde ne göstereceğim?"</strong> → kurcalama kanıtlı kayıt zinciri, CSV ihracı, KVKK metin taslakları.</li>
<li><strong>"Müşteri siteleri değişince haberim olmuyor"</strong> → çizelgeli otomatik tarama + e-posta uyarısı, tek panelden çok müşteri.</li>
</ul>

<h2>Sırayla ne yapacaksınız — altı adım</h2>
<p class="empty">Panelin üstündeki kurulum şeridiyle aynı sıra: önce değeri görün, sonra bağlanın. Her adımın sonunda elinizde somut bir şey olur.</p>
<ol>
<li><strong>Müşteri ekle</strong> — <a href="/clients">Müşteriler</a> sayfasında müşterinizi kaydedin. Kazanım: siteleri tek panelden izlenecek bir çatı.</li>
<li><strong>Site ekle</strong> — müşteri sayfasından site adresini girin; sistem bir site anahtarı üretir. Kazanım: tarama ve izin kayıtlarının bağlanacağı site.</li>
<li><strong>İlk tarama</strong> — site sayfasında <strong>Şimdi tara</strong> düğmesine basın. Kazanım: sitenin ne topladığını gösteren rapor. Sürekli İzleme çizelgesi sonraki taramaları otomatik yapar.</li>
<li><strong>E-postanı onayla</strong> — gelen kutusundaki onay bağlantısına tıklayın. Kazanım: banner yayını ve izleme kodu kurulumu açılır (kayıt ve ilk tarama onaysız serbesttir).</li>
<li><strong>İzleme kodunu kur</strong> — müşteri sayfasındaki kod parçasını sitenizin <code>&lt;head&gt;</code> bölümüne ekleyin; <code>data-site-token</code> yerine site anahtarını yazın. Kazanım: ziyaretçiden izin alınmaya başlar; panel "Bağlantı doğrulandı" kaşesini basar.</li>
<li><strong>Banner'ı yayınla</strong> — site sayfasında rıza bannerı metinlerini kaydedin. Kazanım: ziyaretçi tercihini seçer, her tercih kanıta dönüşür.</li>
</ol>

<h2>Elimde ne olacak?</h2>
<ul>
<li>Site başına tarama raporu: form/alan envanteri, çerez kategorileri, risk işaretleri.</li>
<li>Ziyaretçi izin kayıtları ve kurcalama kanıtlı zincir; CSV kanıt ihracı.</li>
<li>Aydınlatma metni, çerez politikası ve açık rıza taslakları.</li>
<li>Veri sahibi başvuru formu ve süre takibi (DSAR).</li>
<li>Değişiklik uyarı mailleri ve panelde denetim izi.</li>
</ul>

<h2>Sayfalar</h2>
<ul>
<li><a href="/clients">Müşteriler</a> — müşteri ve site yönetimi, beyaz etiket marka ayarları.</li>
<li><a href="/audit">Denetim İzi</a> — paneldeki her işlemin kaydı (KVKK m.12 kayıt yükümlülüğü zemini).</li>
<li><a href="/settings/api-keys">API Anahtarları</a> — headless API için X-API-Key anahtarları.</li>
<li><a href="/api/docs">API Docs</a> — headless API uçlarının dokümanı.</li>
</ul>

<h2>Terimler</h2>
<ul>
<li><strong>İzleme kodu (embed):</strong> sitenize eklenen tek satırlık script; izni alır ve tarama sinyali gönderir.</li>
<li><strong>Site anahtarı (ingest token):</strong> bu siteye özel kimlik; kodda ve başvuru formunda kullanılır.</li>
<li><strong>Kanıt zinciri:</strong> kayıtların sha256 ile birbirine bağlanması; kurcalama doğrulamada görünür.</li>
<li><strong>DSAR:</strong> veri sahibinin kişisel verisiyle ilgili başvurusu (silme, erişim, düzeltme).</li>
</ul>

<h2>İlkeler</h2>
<ul>
<li>Ham veri saklanmaz; alan değerleri hiçbir yere yazılmaz.</li>
<li>Kayıtlar kurcalama kanıtlı zincirde tutulur; doğrulama başarısızsa site sayfası uyarır.</li>
<li>Her işlem denetim izine yazılır.</li>
</ul>`,
    undefined,
    "guide",
    setup,
  );
}