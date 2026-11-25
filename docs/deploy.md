# Deploy — Veriform panel

Bu doküman `docker compose` ile tek sunucuda panel + Postgres ayağa kaldırma akışını anlatır.
Yazdığım her satır ya bu repodaki dosyalardan (`docker-compose.yml`, `Dockerfile`, `.env.example`,
`src/panel/server.ts`) okundu ya da gerçek konteynerlerde çalıştırıldı. Bölüm 11'de canlı ölçüm
kaydı var; hâlâ çalıştıramadığım tek satır §6'daki ters proxy arkası oturum akışı — **ÖLÇÜLMEDİ**
etiketi orada duruyor.

## 0. Önkoşullar

- Docker + compose v2 (`docker compose version`). `WITH_SCANNER=1` imajı **1,78 GB** (chromium +
  playwright + node:22-alpine; `docker images` ölçümü) — disk ve bant genişliği planını buna göre yap.
  Scanner'ı kapatırsan (`WITH_SCANNER=0`) imaj küçülür ama self-servis `/tarama` çalışmaz.
- Panele gelecek bir HTTPS alan adı (örn. `panel.ajans.com`) ve ters proxy (Caddy/nginx/Traefik).
- `openssl` (anahtar üretimi için).

## 1. Ortam değişkenleri

Kodda ve compose'da **hiçbir zorunlu anahtarın default'u yok**. Eksikse panel boot etmez
(`resolvePanelSecrets` throw eder), compose `${VAR:?}` ile durur.

Kapılar konteyner içinde ölçüldü (imajı `node dist/panel.mjs` ile doğrudan koşturarak):

| Durum | Sonuç |
|---|---|
| `SESSION_SECRET=` (boş) | exit 1 — "SESSION_SECRET ayarlı değil — güçlü bir değer ver (örn. `openssl rand -hex 32`)" |
| `SESSION_SECRET=dev-secret-change-me` | exit 1 — "SESSION_SECRET hâlâ geliştirme işareti — gerçek bir anahtarla değiştir" |
| `WORKER_TOKEN` = `SESSION_SECRET` | exit 1 — "WORKER_TOKEN, SESSION_SECRET ile aynı — tetikleyici anahtarını oturum anahtarından ayır" |
| `POSTGRES_PASSWORD` tanımsız | `docker compose config` exit 1 — required variable interpolasyonu |

| Değişken | Zorunlu | Ne yapar | Nereden üretilir |
|---|---|---|---|
| `POSTGRES_PASSWORD` | evet | hem `db` konteyneri hem `DATABASE_URL` bu parolayı kullanır | `openssl rand -hex 16` |
| `SESSION_SECRET` | evet | `vf_session` çerezinin HMAC-SHA256 imza anahtarı | `openssl rand -hex 32` |
| `SESSION_SECRET_PREVIOUS` | hayır | rotasyon penceresinde eski anahtarla açılmış oturumları yaşatır | rotasyon günü eski secret |
| `SESSION_COOKIE_SECURE` | hayır | `1` ise `vf_session` çerezine `Secure` bayrağı eklenir (yalnız HTTPS'te gönderilir). TLS arkasında `1` yap; düz HTTP'de `0`/boş | — |
| `WORKER_TOKEN` | hayır | `/internal/run-scheduled` tetikleyici anahtarı. **Ayarlanmazsa uç her çağrıda 403 döner** (fail-closed) | `openssl rand -hex 16` |
| `OPERATOR_EMAILS` | hayır | virgülle ayrılmış e-posta listesi; owner e-postası listede olan kiracılar `/operator/*` konsolunu görür (gelen kutusu + paket yönetimi). Boşsa konsol kimseye açılmaz | `sen@ornek.com` |
| `DATABASE_URL` | hayır | doluysa Postgres store, boşsa in-memory. compose otomatik kurar | — |
| `PORT` / `HOST` | hayır | varsayılan `4620` / `0.0.0.0` | — |
| `ENABLE_SCAN_SCHEDULER` | hayır | `1` ise panel süreci içinde `setInterval` tarama döngüsü açılır | — |
| `SCAN_CHECK_INTERVAL_MS` | hayır | döngü aralığı, varsayılan `300000` (5 dk) | — |
| `CHROMIUM_EXECUTABLE_PATH` | scanner imajında | compose `/usr/bin/chromium-browser` veriyor | — |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | `PANEL_URL` https ise evet | `SMTP_HOST` yoksa ve panel http ise mail console'a log düşer. Panel https ise `SMTP_HOST` zorunlu, boot durur. İstisna: `ALLOW_CONSOLE_MAIL=1` | SMTP sağlayıcın |
| `PANEL_URL` | `DATABASE_URL` doluysa evet | Hesap maillerindeki ve embed snippet'indeki mutlak adreslerin kökü. İstek `Host` başlığından türetilmez. compose bunu zorunlu kılar | `https://panel.ajans.com`; yerel compose `http://localhost:4620` |
| `ALLOW_CONSOLE_MAIL` | hayır | `1` ise https panelde bile SMTP'siz açılır (yalnız yerel deneme). Mail kaybolur | — |
| `CONTACT_OPERATOR_EMAIL` | hayır | Landing iletişim formu taleplerinin gideceği adres. Boşsa kod varsayılanı (`iletisim@veriform.io`) kullanılır | `iletisim@ajans.com` |

`.env` dosyası asla repoya girmez (`.gitignore`); `cp .env.example .env` ile başla.

## 2. İlk boot

```bash
cp .env.example .env
# .env içinde POSTGRES_PASSWORD ve SESSION_SECRET satırlarını doldur
openssl rand -hex 32   # SESSION_SECRET için çıktı
docker compose up -d --build
docker compose ps      # panel konteyneri "healthy" olmalı
curl -fsS http://127.0.0.1:4620/healthz
```

`/healthz` `{"ok":true,"store":"postgres"}` döner (`src/panel/server.ts:155`). Uç, `PanelStore.ping()`
ile veritabanına `select 1` atar: DB erişilemezse `503` + `{"ok":false,"store":"postgres"}` döner ve
HEALTHCHECK konteyneri `unhealthy` işaretler. `store:"memory"` görürsen
`DATABASE_URL` set edilmemiş demektir — prod'da bu veri kaybı demek, durdur ve `.env`'i düzelt.

Boot sırasında konteyner loglarında şunları beklersin:
- `[migrate] uygulandı: 001_init.sql` (boş volume) ya da `[migrate] baseline …` (eski volume) —
  şema güncelse migrate satırı hiç çıkmaz (§3).
- `[sched] sürekli izleme döngüsü: 300000ms aralıkla` — yalnız `ENABLE_SCAN_SCHEDULER=1` ise.
- `WORKER_TOKEN ayarlı değil` uyarısı — token boşsa çıkar; dahili döngü kullanıyorsan normal,
  harici cron kullanacaksan hatadır.

**Ölçüldü (2026-11-07, Docker 29.9.2 / compose v5.6.1):** `docker compose up -d --build` → imaj 177 paketli
chromium kurulumuyla build oldu, `veriform-db-1 Up (healthy)` + `veriform-panel-1 Up (healthy)`,
`docker inspect` health `healthy`, `curl /healthz` → `{"ok":true,"store":"postgres"}`, log'da
`[sched] sürekli izleme döngüsü: 300000ms aralıkla`. Build + boot + ilk tarama ~4 dk sürdü (chromium indirme dahil).

**/healthz kör noktası kapatıldı (2026-11-18'de ölçüldü):** Eski sürümde `/healthz` yalnız sürecin
ayakta olduğunu söylüyor, veritabanına sorgu atmıyordu; kırık Postgres parolasında `ok:true` +
`healthy` kalıyordu (2026-11-07 ölçümü, §11). Artık uç `select 1` atıyor: izole probe'da DB
durdurulunca `503 {"ok":false}` ve konteyner `unhealthy` (3 ardışık başarısız), DB geri gelince
`200 {"ok":true}` + `healthy` ölçüldü (§12). Yani compose `healthy` artık DB erişimini de kanıtlıyor;
yine de yayında en az bir gerçek okuma/yazma (`/register` 302'si ya da bir tarama kaydı) doğrulanmalı.

## 3. Şema ve migration

Şema `src/panel/migrations/001_init.sql`; koşucu `src/panel/migrate.ts` (birim + PG entegrasyon testli).

- Panel açılışta `DATABASE_URL` varsa migration'ları otomatik koşar. Başarısız migration
  süreci durdurur (fail-fast) — yarım şemayla servis verilmez.
- Dosyalar `NNN_ad.sql` biçiminde, sürüm sırasıyla uygulanır. Uygulanan sürümler
  `schema_migrations (version, applied_at)` tablosunda tutulur; ikinci koşu no-op'tur.
- Her migration kendi transaction'ında koşar; hata rollback edilir ve sürüm kaydedilmez.
- Advisory lock: panel açılışı ile CLI eşzamanlı koşsa bile çakışmaz (§15'te ölçüldü).
- **Baseline:** initdb mount'uyla kurulmuş eski volume'de şema vardır ama kayıt tablosu yoktur.
  Koşucu `tenants` tablosunu görürse ilk migration'ı YENİDEN ÇALIŞTIRMADAN kaydeder
  (`[migrate] baseline …`) — mevcut veri korunur.
- CLI/manuel yol: `PG_URL=… pnpm migrate` (ya da `DATABASE_URL`). CI entegrasyon job'ı bunu kullanır.
- Compose'da initdb mount'u yok: şemayı panel kurar. Boş volume'de ilk boot migration'ı uygular.
- Şema değişikliği = yeni dosya (`002_….sql`). Uygulanmış dosyayı sonradan düzenleme —
  yeniden koşmaz, değişikliğin sessizce kaybolur.

**Volume tuzağı (ölçüldü):** `POSTGRES_PASSWORD` yalnız `pgdata` **boşken** init sırasında Postgres'e
gider. Var olan bir volume ile `.env`'deki parolayı değiştirirsen `db` konteyneri `healthy` kalır
(pg_isready parola doğrulamaz) ama panelin her yazması `password authentication failed for user
"postgres"` ile patlar ve kullanıcı generic "Kayıt başarısız" görür. 2026-11-18'den beri `/healthz`
bu durumda `503` döner ve panel konteyneri `unhealthy` olur — sessiz kırıklık artık healthz'de görünür.
Elimde 2026-11-04'ten kalma bir
`veriform_pgdata` vardı; yeni parolayla boot bu hatayı üretti. Parolayı mevcut volume'e uydurmanın
yolu ya eski parolayı bilmek ya da `ALTER USER postgres PASSWORD …` (parola bilgisiyle) ya da volume'ü
silmek — yani **parola rotasyonu şema yedeği kadar ciddi bir iş**. Kanıt olarak taze volume'de
(`docker compose -p <yeni-proje> up -d`) aynı `.env` ile 10 tablo oluştu ve her şey çalıştı.
Volume'i silmeden önce `pg_dump` al, sıradaki bölümde.

## 4. İlk kiracı

Postgres modunda demo seed **yok**; ilk hesap `/register` üzerinden açılır.
Compose `panel` servisinde `ports: "4620:4620"` yazıyor — yani tüm arayüzlerde publish edilir,
boot'tan saniyeler sonra panel internete açıktır. `db` servisinde `ports` yok, Postgres dışa kapalı kalır.

İlk hesabı açmadan önce 4620'yi kapat (arama motorundan/`taranabilir internet`ten önce):

```bash
ufw deny 4620/tcp   # ya da bind'i "127.0.0.1:4620:4620" yap, proxy'yi localhost'a bağla
```

1. Tarayıcıda `http://<sunucu>:4620/register` (bind'i localhost'a çevirdiysen SSH tüneli: `ssh -L 4620:127.0.0.1:4620 sunucu`).
2. Ajans adı + e-posta + parola gir — `kind` sunucu tarafında `"agency"` olarak sabit (`server.ts:197`).
3. Oturum çerezi 7 gün (`Max-Age`), `HttpOnly`, `SameSite=Lax`; `SESSION_COOKIE_SECURE=1` ise ayrıca `Secure`.
4. `/clients` → müşteri ekle → site ekle → müşteri detayından embed snippet + ingest token'ı al.
   Snippet panelin kendi adresini gösterir (`http(s)://<host>/embed.js`); ayrı CDN yok.
   Oturumlu sayfaların hepsinde üstte ortak nav var (Müşteriler / Denetim İzi / API Anahtarları /
   API Docs + Çıkış); aktif sayfa `aria-current="page"` ile işaretli. `GET /embed.js` kamu rotası —
   `application/javascript`, `max-age=3600`, `nosniff`; build yoksa 404 + `pnpm build:embed` notu.

**Auth throttle ve Secure (2026-11-18'de kapatıldı, §14):** `/register` POST IP başına 5/dk,
`/login` POST IP başına 10/dk ile sınırlı; aşım `429` döner (başarısız denemeler de sayaçtan yer).
Limiter anahtarı `req.socket.remoteAddress` — ters proxy arkasında tüm ziyaretçiler proxy IP'sini
paylaşır, limit site geneline iner (§6); proxy katmanında ayrıca limit koy. `vf_session` çerezine
`Secure` bayrağı `SESSION_COOKIE_SECURE=1` ile eklenir; TLS arkasında bunu aç, düz HTTP'de açma
(çerez hiç gönderilmez, oturum kurulamaz). Eski sürümde her iki uç throttle'suzdu ve `Secure` yoktu
(2026-11-07 ölçümü).

**Akış konteynerde ölçüldü:** `POST /register` → `302 → /clients` ve
`set-cookie: vf_session=<token>; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`; oturumsuz
`GET /clients` → `302 /login`; `POST /login` yanlış parola → `302 /login?error=1` ve **çerez set
edilmiyor**; doğru parola → `302 /clients`. `/clients` (müşteri) → `/clients/<id>/sites` (`url`) →
`/sites/<id>/schedule` (`intervalHours=24`) POST'ları 302 döndü ve `select url, scan_interval_hours
from sites` → `https://example.com/|24` satırını verdi. Kamu `/tarama` limiter'ı aynı IP'de
5 istekten sonra `429` (ilk beşi işlenip `500` — o siteye erişilemedi; limiter hata olsa da sayaç
tutuyor, yani başarısız denemeler de hakkından yer).

## 5. Tarama zamanlayıcısı: iki model

Aynı turu (`runScheduledScans`) koşturan iki yol var; **birini** seç, ikisini aynı anda açma
(çakışma koruması yalnız dahili döngünün kendi `running` bayrağında var, uçlar arasında değil).

**a) Dahili döngü (compose varsayılanı)** — `ENABLE_SCAN_SCHEDULER=1`, `SCAN_CHECK_INTERVAL_MS=300000`.
Her turda yalnız çizelgesi açık ve vakti gelen siteler taranır (`isDue`), sonuçlar depoya yazılır,
önceki taramayla diff çıkarsa sahip e-postalanır. E-posta `notifier` ile bu yoldan gider.

**b) Harici cron / CI tetiklemesi** — `ENABLE_SCAN_SCHEDULER` kapalı tutulur ve dışarıdan:

```bash
curl -fsS -X POST https://panel.ajans.com/internal/run-scheduled \
  -H "x-worker-token: $WORKER_TOKEN"
# yanıt: {"scanned":3,"failed":0,"notified":1}
```

crontab için saate uygun aralık: `*/5 * * * *`. Uç, turu dahili döngüyle **aynı notifier
bağlantısıyla** çağırır (`src/panel/worker.ts` → `handleWorkerRun`): değişiklik uyarı e-postaları
bu yoldan da gider, `notified` sayacı yanıtta görünür. Eski sürümde uç `notifier` vermeden
çağırıyordu ve cron modelinde uyarı e-postası hiç gitmiyordu (2026-11-07 ölçümü); 2026-11-18'de
kapatıldı ve canlı ölçüldü (§13).

Her iki yolda da SMTP tanımsızsa mail log'a düşer — bildirim bekliyorsan `SMTP_*` set et.

**Worker ucu konteynerde ölçüldü** (2026-11-07, `WORKER_TOKEN` set iken; yanıt biçimi o sürümde
`notified` içermiyordu):

| Çağrı | Sonuç |
|---|---|
| token başlıksız `POST /internal/run-scheduled` | `403` |
| `x-worker-token: yanlis-token-degeri` | `403` |
| doğru token, vakti gelen 1 site | `200 {"scanned":1,"failed":0}` — 3,2 sn |
| hemen ikinci çağrı (aynı site, 24 sa dolmadı) | `200 {"scanned":0,"failed":0}` |

Aynı turda konteynerin kendi chromium'u (`/usr/bin/chromium-browser`) ile gerçek sayfa yüklendi:
`https://example.com/` kaydı `formCount 0 / fieldCount 0` üretti (o sayfada form yok), host'a
kurduğum fixture sayfası (`http://host.docker.internal:8099/`) ise `formCount 1 / fieldCount 2 /
categoryCounts [email, tckn] / destinations 1` üretti. (Bu kayıt tarama kalkanından önceye ait;
bugün bu adres özel ağ adresi sayıldığı için taranmaz, bkz. §10.) Yani embed enjeksiyonu + form keşfi + PII
sınıflandırması + canlı hedef yakalama imaj içinde çalışıyor; daha önce **ÖLÇÜLMEDİ** olan
`src/scanner/browser.ts` inject yolu böylece kapandı.
`failed` sayacı tek sitenin hatasında turu düşürmüyor — dead site probe'unda `{scanned:N, failed:1}`
bekle, tur devam eder.

## 6. TLS (ters proxy)

Panel düz HTTP konuşur, TLS sonlandırması sensin. Caddy örneği:

```caddy
panel.ajans.com {
  reverse_proxy 127.0.0.1:4620
}
```

nginx ise `proxy_set_header Host/X-Forwarded-Proto` ayarla ve `client_max_body_size`'ı tarama
bedenlerine göre yükselt. Sonrasında `PANEL_URL=https://panel.ajans.com` ver ve
`SESSION_COOKIE_SECURE=1` yap (oturum çerezi yalnız HTTPS'te gönderilsin). Compose hâlâ
`4620:4620` publish ediyor, bunu internete kapatmak için bind'i `127.0.0.1:4620:4620`'ya çevir ya da
firewall'la (`ufw deny 4620`).

**Ölçülmüş proxy tuzağı:** `/tarama` rate limiter'ı anahtarı `req.socket.remoteAddress`'ten alıyor
(`server.ts:334`) ve `X-Forwarded-For` **hiç okumuyor** — kaynakta eşleşme sayımı: `grep -ril
x-forwarded-for --include=*.ts src` → 0 dosya. Ters proxy arkasında tüm ziyaretçilerin tek IP'si
proxy'nin kendisi olur → 5 istek/dakika limiti **site geneline** uygulanır, meşru trafik "çok fazla
istek" alır. Limit başına 5 ve 6. istekte `429` doğrudan bağlanarak ölçüldü (§4); proxy arkasında
tek balta haline gelmesi bu okumadan türüyor, ama o senaryo ayrıca denendi mi: **ÖLÇÜLMEDİ** (bu
turda denek proxy kurulmadı). Çözüm sırası: (a) güvenilen proxy IP'sini ayrıştırıp anahtarı
`X-Forwarded-For`'dan okutan küçük bir değişiklik, ya da (b) limit'i proxy katmanında (Caddy
`rate_limit`, nginx `limit_req`) uygula ve app'lideki pencereyi gevşet — (b) kod değişikliği
istemeyen yol.
**ÖLÇÜLMEDİ:** TLS sonlandırması sonrası oturum akışı (çerezin `Secure` bayrağısızlığı proxy
arkasında pratikte nasıl davranır) — proxy'li gerçek deneme bu turda yapılmadı.

**Güvenlik başlıkları (2026-11-24):** her yanıt CSP (`script-src 'self' + landing gömülü
script sha256 hash'leri`, `frame-ancestors 'none'`), `X-Frame-Options: DENY`, `nosniff` ve
`referrer-policy` taşır (`security-headers.ts`). HSTS (`max-age=15552000; includeSubDomains`)
yalnız `X-Forwarded-Proto: https` gelen istekte eklenir — ters proxy bu başlığı iletmeli,
yoksa tarayıcı HSTS görmez. Landing script'i değişirse hash listesi otomatik güncellenir
(`LANDING_SCRIPT_HASHES`); elle CSP yazma.

## 7. Güncelleme ve rotasyon

```bash
git pull && docker compose build panel && docker compose up -d   # kesinti: birkaç saniye
```

Yeni sürümde migration dosyaları varsa panel açılışta otomatik uygular (§3); şema değişikliği
içeren güncellemelerde önce `pg_dump` al (§8).

`SESSION_SECRET` rotasyonu (kesintisiz, README'deki prosedürle aynı):
1. `.env`: `SESSION_SECRET_PREVIOUS=<mevcut secret>`, `SESSION_SECRET=<yeni secret>`.
2. `docker compose up -d` — imzalama yalnız yeni anahtarla, doğrulama yeni + eski listeyle yapılır.
3. Bir tam oturum süresi (7 gün) sonra `SESSION_SECRET_PREVIOUS` satırını sil ve yeniden `up -d`.
   Silindiği anda eski çerezler düşer, herkes tekrar giriş yapar.

**Canlı ölçüldü** (aynı konteyner yığınında, çerez saklanarak): rotasyon öncesi eski çerezle
`GET /clients` → `200`; `SESSION_SECRET` yenilenip `SESSION_SECRET_PREVIOUS` eski değer verildikten
sonra `up -d --force-recreate panel` → eski çerez hâlâ `200` (oturum düşmedi); `PREVIOUS`
satırı kaldırılıp yeniden `up -d` → eski çerez `302 /login`, taze `POST /login` → `302 /clients` ve
yeni çerezle `200`. Yani prosedürün "kesintisiz" iddiası ve "PREVIOUS silinince düşer" iddiası
ikisi de doğrulandı. `--force-recreate` gerekiyor; compose yalnız env değiştiğinde konteyneri
yeniden yaratmayabilir — `up -d` sonrası `docker inspect` ile env'i teyit et.

## 8. Yedekleme ve geri alma

```bash
docker compose exec -T db pg_dump -U postgres -d veriform | gzip > veriform-$(date +%F).sql.gz

# geri yükleme: boş HEDEF veritabanına yap, canlı veritabanının üstüne değil
docker compose exec -T db psql -U postgres -d postgres -c "create database veriform_restore"
gunzip -c veriform-2026-11-07.sql.gz | \
  docker compose exec -T db psql -U postgres -d veriform_restore -v ON_ERROR_STOP=1
```

**Ölçüldü:** dump 3653 bayt (gzip, 2 site + 2 tarama + 1 kullanıcı + 1 kiracı), yeni hedef veritabanına
geri yükleme `ON_ERROR_STOP=1` ile sıfır hata satırı üretti ve `select count(*)` değerleri kaynakla
birebir eşleşti (siteler 2/2). Geri yükleme aynı isimli veritabanına yapılırsa `relation already
exists` alır — bu yüzden hedef hep boş olsun, sonra `ALTER DATABASE … RENAME` ile canlıya çevir.

İki yanıltıcı ayrıntı ölçüldü:
- `docker compose exec db pg_dump` konteyner **içinde unix socket** üzerinden bağlanır, parola
  sormaz. Parola uyumsuzluğunda bile dump başarılı (ölçüldü: app tarafı `/register → 400` iken
  aynı yığın `pg_dump` ile 3309 bayt verdi). Yani "yedek alıyor" olmak "uygulama veriye
  erişebiliyor" olmak zorunda değil — yedeği **uygulama tarafı okuma ile** de doğrula.
- Uygulamanın TCP bağlantısı (`DATABASE_URL`) parola isteyebilir; yedeği `pg_dump -h 127.0.0.1 -U
  postgres` gibi TCP üzerinden alıyorsan `PGPASSWORD` gerekir ve `pipefail` olmadan sıfır baytlık
  sessiz yedek üretebilir. Bu dosyadaki komutlar socket yolunu kullanıyor, dolayısıyla `PGPASSWORD`
  gerekmez; TCP'ye geçersen `set -o pipefail` ve boyut kontrolü zorunlu.

- Yedek tek başına `pgdata` volume'ünün kopyasından iyidir: şema + mantıksal dump geri alması
  konteyner imajı sürümünden bağımsız.
- Rollback: image tag'i sabitlemeden `build` kullanıyorsan geri dönecek sabit imajın yok. Compose
  build'i `veriform-panel:latest` diye etiketliyor (ikinci proje `vfprobe-panel:latest` üretti —
  ikisi de `docker images`'ta ölçüldü); yani etiket var ama **hep mutable `latest`**, eski sürümü
  tutmuyor. Publish öncesi `docker compose build --tag veriform-panel:<git-sha>` ile sabit etiket
  bırak, compose'a `image: veriform-panel:<sha>` ver ve dönüşte o etiketi geri çek.
  Kalınan imajlar `docker image prune` ile silinir — rollback imajını ayrı bir registry'e it.
- Kopyalanacak sırlar: `.env` (POSTGRES_PASSWORD, SESSION_SECRET, WORKER_TOKEN, SMTP_*).
  Bunlar kaybolursa oturumlar ve veri erişimi kaybolur; parola sırları `scrypt` ile saklandığı için
  kullanıcı parolaları geri getirilemez, yalnız sıfırlanabilir.

## 9. Yayın öncesi kontrol listesi

- [ ] `curl /healthz` → `200 {"ok":true,"store":"postgres"}` — uç artık DB'ye `select 1` atıyor, 503 = DB kırık
- [ ] Boot logunda `[migrate] uygulandı/baseline` ya da migrate satırı yok (şema güncel); `schema_migrations` dolu
- [ ] Uygulama tarafı gerçek okuma/yazma: `/register` 302 döndü mü (400 = Postgres bağlantısı kırık)
- [ ] `pgdata` volume'ü ile `POSTGRES_PASSWORD` uyumlu mu (eski volume + yeni parola = sessiz kırık)
- [ ] `/register` ile tek hesap açıldı, anonim `/clients` → 302 `/login`
- [ ] Site + embed + ingest token'ı ile gerçek tarama kaydı (`/tarama` ya da panel)
- [ ] `WORKER_TOKEN` ya set ya bilinçli olarak boş (uç 403) — hangisi seçildiyse cron da ona göre
- [ ] Ters proxy HTTPS + HTTP→HTTPS yönlendirmesi, `4620` internete kapalı, `SESSION_COOKIE_SECURE=1`
- [ ] SMTP: test bildirimi gerçekten kutuya düştü mü
- [ ] Yedek komutu cron'landı ve **geri yükleme de denendi** (denenmemiş yedek yedek değildir)
- [ ] `LICENSE` dosyasındaki `Licensor` placeholder'ı hukuki ünvanla dolduruldu
- [ ] Yasal sayfalardaki (`/kullanim-sartlari`, `/gizlilik`, `/cerez-politikasi`) `[Ünvan]`
  placeholder'ı dolduruldu ve metinler hukuki incelemeden geçti
- [x] Repoya public kararında: iş geliştirme notları history'den çıkarıldı (2026-11-24);
  yayın temiz history'li yeni repoda yapıldı

## 10. Bilinen sınırlar

- `runScheduledScans` tek süreçte `setInterval` — çok kopyalı (scaled) deploy'ta aynı site
  birden fazla taranabilir. Faz 1'de ayrı worker konteynerine taşınacak.
- `dist/` gitignored; imaj her boot'ta `pnpm build:panel` çıktısını kendisi üretiyor (Dockerfile multi-stage).
- Rate limiter bellek içi ve anahtarı `req.socket.remoteAddress`: panel yeniden başladığında sayaçlar
  sıfırlanır, çok kopyada paylaşılır değil, ters proxy arkasında tek balta haline gelir (§6).
- Compose `build` kullanıyor, `image:` satırı yok → etiketli rollback kurulu değil (§8).
- RLS **etkin** (migration 009, §19), iki sınırla: (1) uygulama `postgres` süper kullanıcısıyla
  bağlanıyor; kiracı yolu işlem boyunca `veriform_app` rolüne geçiyor ama sistem yolları (ingest
  anahtarı, zamanlayıcı, operatör, hesap belirteci) tablo sahibi olarak kalıyor ve kiracı filtresi yok.
  Ayrı bağlantı hesabı + `FORCE ROW LEVEL SECURITY` sonraki sertleştirme. (2) Kiracı oturumunun
  yalnız `tenantId` alan depo metotlarını çağırdığı kod incelemesiyle sağlanıyor; tip sistemi
  zorlamıyor.
- IP anahtarlı limiterler (giriş, kayıt, sıfırlama, `/tarama`) proxy arkasında tek adrese iner
  (yukarıdaki madde). DSAR ve ingest limiterleri token doğrulandıktan sonra site kimliğiyle sayar,
  proxy arkasında da doğru çalışır.
- Site ekleme yalnız adres söz dizimini denetler (şema, kullanıcı bilgisi, yerel/adres aralıkları).
  `http://db:5432/` gibi söz dizimi kurallı bir ana bilgisayar adı eklenir; engelleme noktası
  tarama anındaki DNS çözümlemesi. Tarama sırasında sayfanın yaptığı her istek de aynı denetimden
  geçer.
- `host.docker.internal` gibi yerel fixture adresleri tarama kalkanına takılır. Scanner testleri
  bu yüzden yalnız `targetPolicy: "any"` seçeneğiyle yerel hedef kullanır; bu seçenek üretim
  kodundan geçmez.

## 11. Canlı ölçüm kaydı — 2026-11-07

Ortam: Docker 29.9.2, Docker Compose v5.6.1, Windows host. İzole `vfprobe` projesi taze
`pgdata` volume'ü ile kuruldu, probe bittikten sonra volume ve imaj silindi; makinede
2026-11-04 tarihli mevcut `veriform_pgdata` volume'üne dokunulmadı.

| Ölçülen | Sonuç |
|---|---|
| `docker compose up -d --build` | exit 0; chromium dahil imaj build oldu; `db` ve `panel` `healthy` |
| `curl /healthz` | `{"ok":true,"store":"postgres"}` |
| Boot log | `[sched] sürekli izleme döngüsü: 300000ms aralıkla` |
| Taze volume'de şema | 10 tablo (`information_schema` sayımı) |
| `POST /register` | 302 → `/clients`, `HttpOnly; SameSite=Lax; Max-Age=604800` çerezi |
| Oturumsuz `/clients` | 302 → `/login` |
| Yanlış parola `POST /login` | 302 `/login?error=1`, çerez yok |
| `/internal/run-scheduled` token'sız / yanlış token | 403 / 403 |
| Doğru token ile tur | 200 `{"scanned":1,"failed":0}` (3,2 sn) |
| Aynı turun tekrarı | 200 `{"scanned":0,"failed":0}` — çizelge kapısı çalışıyor |
| Konteyner içi chromium taraması | `example.com`: 0 form; fixture sayfa: 1 form / 2 alan / `[email, tckn]` / 1 hedef |
| `SESSION_SECRET` boş / placeholder / `WORKER_TOKEN` çakışması | üçü de exit 1, Türkçe hata mesajıyla |
| `POSTGRES_PASSWORD` tanımsız compose | `docker compose config` exit 1 |
| `SESSION_SECRET` rotasyonu | PREVIOUS dolu: eski çerez 200 · PREVIOUS silindi: eski çerez 302, yeni login 200 |
| `pg_dump` + boş DB'ye geri yükleme | 3653 bayt dump, `ON_ERROR_STOP=1` sıfır hata, satır sayıları eşleşti (2/2) |
| Eski volume + yeni parola | app tarafı `POST /register` 400 (`password authentication failed`), `/healthz` yeşil, konteynerler `healthy`, socket `pg_dump` 3309 bayt |
| `/tarama` hız sınırı | ilk 5 istek işlendi, 6. ve 7. `429` |

Ölçülemeyen: TLS sonlandırması sonrası oturum akışı ve `X-Forwarded-For` arkasında limiter (§6),
SMTP'nin gerçek kutuya düşürmesi (bu koşuda `SMTP_*` tanımsızdı, mail yolu log'a düşüyor),
çok kopyalı (scaled) deploy davranışı.

## 12. Canlı ölçüm kaydı — 2026-11-18 (healthz DB probu)

Ortam: Docker 29.9.3, Windows host. İzole `vfhealth` projesi, taze `pgdata` volume'ü,
`WITH_SCANNER=0` imaj (healthz probu chromium gerektirmez), panel `4621` ve db `5433` portlarında.
Probe sonunda konteynerler, volume ve imaj silindi; mevcut `veriform_pgdata` volume'üne dokunulmadı.

| Ölçülen | Sonuç |
|---|---|
| `pnpm typecheck` | 0 hata |
| `vitest run` (lokal, PG_URL'siz) | 295 passed / 6 skipped (46 dosya passed, 1 skipped) |
| `store.pg.test.ts` gerçek PG'ye karşı (probe db, `PG_URL` ile) | 6/6 passed — `ping` gerçek DB'de resolve, erişilemeyen DB'de reject |
| Taze stack `curl /healthz` | `200 {"ok":true,"store":"postgres"}`, her iki konteyner `healthy` |
| `docker compose stop db` sonrası `/healthz` | `503 {"ok":false,"store":"postgres"}` |
| HEALTHCHECK (30s aralık, 3 retry) | panel `unhealthy`, fail streak 3 |
| `docker compose start db` + 40s | `200 {"ok":true,"store":"postgres"}`, panel yeniden `healthy` |

Kod değişikliği: `PanelStore.ping()` portu (in-memory: no-op, Postgres: `select 1`),
`src/panel/health.ts` → `checkHealth`, `/healthz` artık `ok:false` durumunda `503` döner.
Dockerfile HEALTHCHECK değişmedi (`r.ok` zaten 503'te exit 1 üretiyor).

## 13. Canlı ölçüm kaydı — 2026-11-18 (worker ucu notifier)

Ortam: Docker 29.9.3, Windows host. İzole `vfworker` projesi, taze `pgdata` volume'ü,
`WITH_SCANNER=1` imaj (chromium dahil), panel `4621`, db `5433`, `ENABLE_SCAN_SCHEDULER=0`
(yalnız cron ucu koşsun diye). Host'ta fixture sunucu `0.0.0.0:8092` — ilk denemede `8091`
başka bir uygulamanın portuydu, taramalar 0 form ile geçersiz ölçüm üretti; port değiştirilip
site URL'si güncellenerek tekrarlandı. Probe sonunda konteynerler, volume, imaj ve fixture
dosyaları silindi; mevcut `veriform_pgdata` volume'üne dokunulmadı.

| Ölçülen | Sonuç |
|---|---|
| `pnpm typecheck` | 0 hata |
| `vitest run` (lokal) | 300 passed / 6 skipped (47 dosya passed, 1 skipped) |
| `POST /register` + `/clients` + site + `/sites/:id/schedule` | hepsi 302, oturum çereziyle |
| token'sız / yanlış token `POST /internal/run-scheduled` | 403 / 403 |
| 1. tur (önceki tarama yok) | `200 {"scanned":1,"failed":0,"notified":0}` — DB'de 1 form / 1 alan |
| Önceki tarama 25 saat geriye alındı + fixture'a `tcno` alanı eklendi | `update scans … '25 hours'`, ikinci sayfa 2 alan |
| 2. tur (değişiklik var) | `200 {"scanned":1,"failed":0,"notified":1}` — DB'de 1 form / 2 alan |
| Panel log | `[mailer:console] → owner@probe.test \| Veriform uyarısı: … 1 değişiklik tespit edildi` |

Kod değişikliği: uç `src/panel/worker.ts` → `handleWorkerRun`'a delege ediliyor; tur artık
`notifier: mailSender.send` ile çağrılıyor ve yanıt `notified` sayacını içeriyor.
`SMTP_*` bu koşuda tanımsızdı — mail console sender'a düştü; gerçek SMTP kutu teslimatı
hâlâ ÖLÇÜLMEDİ (§11 ile aynı sınır).

## 14. Canlı ölçüm kaydı — 2026-11-18 (Secure çerez + auth throttle)

Ortam: Docker 29.9.3, Windows host. İzole `vfauth` projesi, taze `pgdata` volume'ü,
`WITH_SCANNER=0` imaj, panel `4621`, `ENABLE_SCAN_SCHEDULER=0`. Önce `SESSION_COOKIE_SECURE=1`
ile koşuldu, sonra aynı imajla `0`'a çevrilip negatif yön ölçüldü. Probe sonunda konteynerler,
volume ve imaj silindi; mevcut `veriform_pgdata` volume'üne dokunulmadı.

| Ölçülen | Sonuç |
|---|---|
| `pnpm typecheck` | 0 hata |
| `vitest run` (lokal) | 303 passed / 6 skipped (47 dosya passed, 1 skipped) |
| `POST /register` (SECURE=1) | `302`, `set-cookie: vf_session=…; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800; Secure` |
| Aynı e-posta ile 4 tekrar kayıt | dördü de `400` (zaten kayıtlı) — sayaç işliyor |
| 6. kayıt denemesi (aynı IP, 1 dk içinde) | `429` — "Çok fazla kayıt denemesi — bir dakika bekleyip tekrar deneyin" |
| Yanlış parola `POST /login` ×10 | on'u da `302 /login?error=1` |
| 11. giriş denemesi | `429` — "Çok fazla giriş denemesi — bir dakika bekleyip tekrar deneyin" |
| `GET /logout` (SECURE=1) | `set-cookie: vf_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0; Secure` |
| `SESSION_COOKIE_SECURE=0` ile kayıt | `302`, çerezde `Secure` YOK (lokal HTTP davranışı korundu) |

Kod değişikliği: `buildSessionCookie` / `buildLogoutCookie` (`src/panel/auth.ts`, birim testli),
`SESSION_COOKIE_SECURE` env (compose default `0`), `/login` POST 10/dk ve `/register` POST 5/dk
IP başına limiter (`createRateLimiter`, `/tarama` ile aynı desen). Anahtar hâlâ
`req.socket.remoteAddress`: proxy arkasında tek paylaşımlı balta (§6) — bu davranış değişmedi,
denek proxy kurulmadığı için ÖLÇÜLMEDİ notu yerinde duruyor.

## 15. Canlı ölçüm kaydı — 2026-11-18 (migration koşucusu)

Ortam: izole `vf-mig-probe` projesi, taze volume, db `15432` / panel `14620`, `WITH_SCANNER=1`
imaj. Kullanıcının `veriform_pgdata` volume'üne ve `veriform-pg` konteynerine dokunulmadı.
Probe sonunda konteynerler, volume, imaj ve geçici override dosyası silindi.

| Senaryo | Ölçülen |
|---|---|
| Legacy volume (şema elle kurulmuş, 1 kiracı, `schema_migrations` yok) + panel boot | log `[migrate] baseline (mevcut şema kaydedildi): 001_init.sql`, healthz `200 {"ok":true,"store":"postgres"}`, `Legacy Ajans` satırı korundu |
| Sıfır volume + panel boot (initdb mount'u yok) | log `[migrate] uygulandı: 001_init.sql`, healthz 200, `POST /register` → `302` ve kiracı oluştu |
| Panel restart (şema güncel) | migrate logu yok (no-op), healthz 200 |
| CLI legacy veritabanı (`node dist/migrate.mjs`, `PG_URL`) | ilk koşu `baseline … 001_init.sql`, ikinci koşu `şema güncel — iş yok`, veri korundu |
| İmaj içeriği | `dist/migrations/001_init.sql` konteynerde mevcut (build kopyası çalışıyor) |
| Eşzamanlı iki koşucu (PG entegrasyon testi) | toplam 1 uygulama, `schema_migrations` satır sayısı 1 |
| Bozuk migration (002, transaction ortasında `1/0`) | test kırmızı→yeşil: 002 kaydedilmedi, kısmi tablo rollback oldu |
| `pnpm typecheck` | 0 hata |
| `vitest run` (lokal, PG_URL'siz) | 310 passed / 10 skipped (48 dosya passed, 1 skipped) |
| `migrate.test.ts` PG_URL ile | 11/11 passed (7 birim + 4 entegrasyon) |
| `store.pg.test.ts` PG_URL ile | 6/6 passed |

TDD sırasında yakalanan gerçek yarış: `create table if not exists schema_migrations` advisory
lock'tan ÖNCE koşuyordu — eşzamanlı iki koşucu PG'nin `pg_type_typname_nsp_index` unique
ihlaliyle çöküyordu (test kırmızıyı gösterdi). Tablo oluşturma lock içine alındı, test yeşile döndü.

## 16. Canlı ölçüm kaydı — 2026-11-18 (panel nav + embed serve)

Ortam: izole `vf-ux-probe` projesi, db `15433` / panel `14621`, `WITH_SCANNER=0` imaj.
Kullanıcının `veriform_pgdata` volume'üne dokunulmadı.

| Senaryo | Ölçülen |
|---|---|
| `GET /embed.js` (oturumsuz) | `200`, `application/javascript; charset=utf-8`, 23386 bayt (imajda `dist/veriform-embed.js` fallback'i; `src/` final imajda yok) |
| Müşteri detay snippet'i (browser) | `<script src="http://127.0.0.1:14621/embed.js" data-site-token="…">` — `cdn.veriform.io` yok |
| Nav (browser) | `/clients`, müşteri detay, `/audit`, `/settings/api-keys` sayfalarında 5 link + Çıkış; nav ile geçişler çalıştı; aktif sayfa `aria-current` doğru |
| Çıkış (browser) | Çıkış → `/login`; sonrasında `/clients` → `302 /login` |
| `pnpm typecheck` | 0 hata |
| `vitest run` (lokal, PG_URL'siz) | 318 passed / 10 skipped (49 dosya passed, 1 skipped) |

## 17. Canlı ölçüm kaydı — 2026-11-24 (Blok 15: güvenlik kapanları)

Ortam: izole `vf-ux-probe` projesi, db `15433` / panel `14621`, `WITH_SCANNER=1` imaj,
migration `001`–`008` uygulanmış. `PANEL_URL=http://127.0.0.1:4620`, SMTP tanımsız (console
sender). Kullanıcının `veriform_pgdata` volume'üne dokunulmadı.

| Senaryo | Ölçülen |
|---|---|
| Kayıt: kısa şifre, tek karakter ajans adı, geçersiz e-posta | üçü de `400`; veritabanında kayıt yok |
| Kayıt: geçerli | `302` |
| `GET /verify-email?token=…` | `200`, POST formu; veritabanında `email_verified_at` hâlâ boş |
| `POST /verify-email` (aynı token) | birinci `200` "doğrulandı", ikinci "geçersiz veya süresi dolmuş" |
| Site ekleme: `file:///etc/passwd`, `http://127.0.0.1:4620/`, `http://169.254.169.254/…` | üçü de `302 /clients/<id>?site=invalid`, sayfada uyarı |
| Site ekleme: `https://example.com` | `302 /clients/<id>` |
| `/tarama`: `http://db:5432/` | `400` "taranamıyor" (DNS özel ağ adresine çözülüyor) |
| `/tarama`: `http://localhost/`, `http://169.254.169.254/` | `400` (söz dizim denetimi) |
| `/tarama`: `https://example.com` | `200`, rapor üretildi |
| DSAR güncelleme, başka kiracı | `403`; başvuru durumu `new` kaldı |
| DSAR güncelleme, site sahibi | `302`; durum `completed` |
| API anahtarı üretimi | `200`, `Location` başlığı yok; anahtar yalnız bu yanıtın gövdesinde (47 karakter), sonraki `GET` sayfasında yok |
| Şifre değişikliği | `303`; eski çerezle `/clients` → `302 /login`; yeni çerezle `200` |
| `POST /forgot-password` + `Host: evil.test` | `303`; logdaki bağlantı kökü `http://127.0.0.1:4620` (`PANEL_URL`), `evil.test` yok |
| 6 MB gövde | `413` |
| `POST /api/ingest/scan` 61 kez | `400` × 60, sonra `429` |
| `POST /dsar/<token>` 21 kez | `400` × 20, sonra `429` |
| Boot: `DATABASE_URL` + `PANEL_URL` yok | çıkış `1`, "PANEL_URL zorunlu" |
| Boot: https `PANEL_URL` + `SMTP_HOST` yok | çıkış `1`, "SMTP_HOST zorunlu" |
| Boot: https + `ALLOW_CONSOLE_MAIL=1`, http + SMTP yok | mail kapısı geçildi; DB bağlantı hatasıyla durdu (beklenen) |
| `pnpm typecheck` | 0 hata |
| `vitest run` (PG_URL'siz) | 547 passed / 23 skipped (63 dosya passed, 1 skipped) |
| `vitest run` (probe PG dahil) | 570 passed / 0 skipped (64 dosya) |

**ÖLÇÜLMEDİ:** gerçek SMTP kutu teslimatı, ters proxy arkasında `x-forwarded-proto` ile oturum
akışı (§6), tarama sırasında sayfanın özel ağ isteği yapıp yapmadığı (rota denetimi birim
testiyle kapalı, konteynerde gözlemlenmedi).

## 18. Canlı ölçüm kaydı — 2026-11-25 (panel sunucu rotaları test altında)

Değişiklik: `src/panel/server.test.ts` paneli süreç içinde ayağa kaldırıp gerçek HTTP istekleriyle
rota bağlantısını ölçer (12 test). Bu test yazılırken iki eski kusur çıktı ve düzeltildi:

- Bellek içi geliştirme modu (`pnpm panel`, Postgres'siz) Blok 15'ten beri açılmıyordu: demo
  hesabının varsayılan şifresi "demo" yeni şifre kuralına takılıyordu. Varsayılan `demo-giris` oldu.
- 5 MB üstü gövdede sunucu okumayı bırakıp bağlantıyı kapatıyordu. Okunmamış veri kalmış soket
  istemcide sıfırlanır (RST) ve 413 sayfası ulaşmazdı. Şimdi kalan gövde 5 saniyeyle sınırlı
  boşaltılır. Düzeltme öncesi Node `fetch` `ECONNRESET` alıyordu; `curl` tesadüfen yanıtı görüyordu.

| Ölçüm | Sonuç |
|---|---|
| `pnpm typecheck` | 0 hata |
| `vitest run` (PG_URL'siz) | 559 passed / 23 skipped (64 dosya passed, 1 skipped) |
| `vitest run` (probe PG dahil) | 582 passed / 0 skipped (65 dosya) |
| Konteyner (probe 14621): Blok 15 curl senaryosu | 37/37 |
| Konteyner: 6 MB gövde, `curl` / Node `fetch` | `413` / `413` + mesaj |

## 19. Canlı ölçüm kaydı — 2026-11-25 (Blok 17: RLS zorlaması)

Değişiklik: satır düzeyi güvenlik (RLS) artık etkin. Migration `009_rls_app_role.sql` giriş yapamayan
`veriform_app` rolünü kurar, kiracı tablolarına yalnız veri izni verir (DDL yok, `contact_requests` /
`account_tokens` / `schema_migrations` açık değil) ve `audit_log`, `api_keys`, `plan_change_requests`
için RLS'i açar. Depoda `tenantId` alan her metot işlem boyunca bu role geçer (`set local role` +
`app.current_tenant`), işlem bitince bağlantı sahibine döner. İki depo için ortak sözleşme testi:
`src/panel/store.tenant-scope.test.ts`. Uygulama migration'ı çalıştıran kullanıcıyla bağlanmalı
(compose ve CI: `postgres`); ikinci bir şifre yok.

Yazılırken çıkan eski kusur: `001_init.sql`'de `audit_log` için politika yazılmış ama RLS anahtarı
açılmamıştı (politika etkisizdi).

| Ölçüm | Sonuç |
|---|---|
| `pnpm typecheck` | 0 hata |
| `vitest run` (PG_URL'siz) | 562 passed / 31 skipped (65 dosya passed, 1 skipped) |
| `vitest run` (probe PG dahil) | 593 passed / 0 skipped (66 dosya) |
| probe DB: tablo sahibi / `veriform_app` (kiracı seçmeden) | 270 müşteri, 277 site / 0, 0 |
| probe DB: RLS açık kiracı tablosu | 11 / 11 |
| Konteyner (probe 14621): Blok 15 curl senaryosu | 37/37 |
| Konteyner: iki kiracılı RLS senaryosu (site, zamanlama, düzeltme, DSAR, müşteri, denetim) | 27/27; her reddin ardından A'nın verisi DB'de değişmemiş |
| Konteyner: rol kanıtı — `select on sites` rolünden geçici alınınca | sahibin kendi sitesi 403; izin geri verilince 200 |
| Sıfır veritabanından açılış (izole proje `vf-rls-fresh`, ölçüm sonunda kaldırıldı) | 9 migration, healthy 6 sn; kayıt → müşteri → site → zamanlama → DSAR → denetim; panel yeniden başlatınca 200 |
| Kiracı kapsamlı çağrı maliyeti (panel → db, 300 ardışık çağrı) | düz sorgu 0,35 ms → 1,44 ms (+1,09 ms) |

## 20. Canlı ölçüm kaydı — 2026-11-25 (compose e-posta aktarımı)

Değişiklik: `docker-compose.yml` panel ortamına `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`,
`SMTP_FROM`, `ALLOW_CONSOLE_MAIL` ve `CONTACT_OPERATOR_EMAIL` aktarımı eklendi. Hepsi `${VAR:-}`
biçiminde: tanımsızken boş geçer, açılışı durdurmaz. Önceden bu adlar compose'ta hiç yoktu; `.env`'e
yazılan değer konteynere geçmiyordu. Sonucu: https `PANEL_URL` ile panel, SMTP dolu `.env`'e rağmen
"SMTP_HOST zorunlu" diye çıkıyordu; iletişim formu da operatör adresi yerine kod varsayılanını
kullanıyordu. Koruma testi: `src/panel/compose-env.test.ts` (15 test) — mail yolunun okuduğu her ad
panel ortamında bulunmalı ve isteğe bağlı aktarılmalı.

| Ölçüm | Sonuç |
|---|---|
| `pnpm typecheck` | 0 hata |
| `vitest run` (PG_URL'siz) | 577 passed / 31 skipped (66 dosya passed, 1 skipped) |
| `vitest run` (probe PG dahil) | 608 passed / 0 skipped (67 dosya) |
| `compose config`: panel ortamındaki mail adı | 7 (değişiklik öncesi 0) |
| İzole proje `vf-env-probe`: https `PANEL_URL` + sahte SMTP | healthy, `/healthz` `ok:true`; `printenv` değerleri konteynerde görünüyor |
| Aynı proje, SMTP tanımsız | çıkış `1`, "SMTP_HOST zorunlu" |
| Eski compose (HEAD) + SMTP dolu override | çıkış `1`, aynı hata — kusurun kanıtı |
| SMTP tanımsız + `ALLOW_CONSOLE_MAIL=1` | healthy; yerel deneme kapısı compose'tan geçiyor |

Ölçüm sonunda izole proje, volume'u ve imajı kaldırıldı; `vf-ux-probe` ile `veriform-pg` dokunulmadı.

**ÖLÇÜLMEDİ:** gerçek SMTP kutu teslimatı ve ters proxy arkasında Secure çerez oturum akışı (§6).
Bu koşuda SMTP ana bilgisayarı sahteydi; yalnız açılış kapısı ve aktarım ölçüldü, mail gönderilmedi.
