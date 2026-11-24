import { panelPage } from "./render.js";
import type { SetupProgress } from "./types.js";

/**
 * Panel içi rehber — ürünün ne yaptığını ve kurulum akışını anlatır.
 * Operate modu: panelin mevcut sade düzeni korunur, içerik statiktir.
 */
export function renderGuidePage(setup?: SetupProgress | undefined): string {
  return panelPage(
    "Rehber",
    `<h1>Rehber — Veriform nasıl çalışır?</h1>
<p class="empty">Veriform, müşterilerinizin sitelerindeki form veri akışını ve çerezleri izler; KVKK uyumunu kanıta bağlar. Ham form verisi asla saklanmaz — yalnızca meta veri ve hedef origin+path kaydedilir.</p>

<h2>Ne yapar?</h2>
<ul>
<li><strong>Form veri envanteri:</strong> formlardaki TCKN, IBAN, kart gibi hassas alanları sınıflandırır; GET ile hassas veri ve 3. taraf hedef gibi riskleri işaretler.</li>
<li><strong>Rıza kanıt zinciri:</strong> her rıza kaydı sha256 ile önceki kayda bağlanır; kurcalama doğrulamada görünür. Kanıtlar CSV olarak ihraç edilir.</li>
<li><strong>DSAR başvuruları:</strong> veri sahibi başvuruları site anahtarı üzerinden gelir; KVKK m.13 son tarihi izlenir, tek uzatma hakkı denetlenir.</li>
<li><strong>Değişiklik uyarıları:</strong> iki tarama arasındaki yeni form/alan ve çerez kategorileri site sayfasında raporlanır, sahibine e-posta gider.</li>
</ul>

<h2>Kurulum akışı — altı adım</h2>
<p class="empty">Panelin üstündeki kurulum şeridiyle aynı sıra: önce değeri görün, sonra bağlanın.</p>
<ol>
<li><strong>Müşteri ekle</strong> — <a href="/clients">Müşteriler</a> sayfasında ajansınızın müşterisini kaydedin.</li>
<li><strong>Site ekle</strong> — müşteri sayfasından site adresini girin; sistem bir site anahtarı üretir.</li>
<li><strong>İlk tarama</strong> — site sayfasında <strong>Şimdi tara</strong> düğmesine basın; rapor dakikalar içinde hazır. Sürekli İzleme çizelgesi sonraki taramaları otomatik yapar.</li>
<li><strong>E-postanı onayla</strong> — gelen kutusundaki onay bağlantısına tıklayın. Banner yayını ve izleme kodu kurulum talimatı bu onaya bağlıdır; kayıt ve ilk tarama serbesttir.</li>
<li><strong>İzleme kodunu kur</strong> — müşteri sayfasındaki kod parçasını sitenizin <code>&lt;head&gt;</code> bölümüne ekleyin; <code>data-site-token</code> yerine site anahtarını yazın. Kod yüklenince panel "Bağlantı doğrulandı" kaşesini basar.</li>
<li><strong>Banner'ı yayınla</strong> — site sayfasında rıza bannerı metinlerini kaydedin; izleme kodu bu ayarları otomatik çeker.</li>
</ol>
<p class="empty">Terimler: <strong>izleme kodu</strong> = sitenize eklenen script (embed); <strong>site anahtarı</strong> = bu siteye özel ingest token.</p>

<h2>Sayfalar</h2>
<ul>
<li><a href="/clients">Müşteriler</a> — müşteri ve site yönetimi, beyaz etiket marka ayarları.</li>
<li><a href="/audit">Denetim İzi</a> — paneldeki her mutasyonun kaydı (KVKK m.12 kayıt yükümlülüğü zemini).</li>
<li><a href="/settings/api-keys">API Anahtarları</a> — headless API için X-API-Key anahtarları.</li>
<li><a href="/api/docs">API Docs</a> — headless API uçlarının dokümanı.</li>
</ul>

<h2>İlkeler</h2>
<ul>
<li>Ham veri saklanmaz; alan değerleri hiçbir yere yazılmaz.</li>
<li>Kanıtlar kurcalama kanıtlı zincirde tutulur; doğrulama başarısızsa site sayfası uyarır.</li>
<li>Her mutasyon denetim izine yazılır.</li>
</ul>`,
    undefined,
    "guide",
    setup,
  );
}