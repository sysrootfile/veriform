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
<li><strong>DSAR başvuruları:</strong> veri sahibi başvuruları site token'ı üzerinden gelir; KVKK m.13 son tarihi izlenir, tek uzatma hakkı denetlenir.</li>
<li><strong>Değişiklik uyarıları:</strong> iki tarama arasındaki yeni form/alan ve çerez kategorileri site sayfasında raporlanır, sahibine e-posta gider.</li>
</ul>

<h2>Kurulum akışı</h2>
<ol>
<li><strong>Müşteri ekle</strong> — <a href="/clients">Müşteriler</a> sayfasında ajansınızın müşterisini kaydedin.</li>
<li><strong>Site ekle</strong> — müşteri sayfasından site URL'i girin; sistem ingest token üretir.</li>
<li><strong>Embed'i kur</strong> — müşteri sayfasındaki embed snippet'ini sitenin <code>&lt;head&gt;</code> bölümüne ekleyin; rıza bannerı ve kanıt kaydı bu scriptle çalışır.</li>
<li><strong>Sürekli İzleme'yi aç</strong> — site sayfasındaki çizelgeden aralık seçin; worker vakti gelen siteleri tarar.</li>
<li><strong>Raporu oku, kanıtı ihraç et</strong> — site sayfasında taramalar, insan onayı bekleyen düzeltmeler ve kanıt CSV'i; aydınlatma / açık rıza / çerez politikası taslakları yazdırılabilir.</li>
</ol>

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