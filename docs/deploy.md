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
| `WORKER_TOKEN` | hayır | `/internal/run-scheduled` tetikleyici anahtarı. **Ayarlanmazsa uç her çağrıda 403 döner** (fail-closed) | `openssl rand -hex 16` |
| `DATABASE_URL` | hayır | doluysa Postgres store, boşsa in-memory. compose otomatik kurar | — |
| `PORT` / `HOST` | hayır | varsayılan `4620` / `0.0.0.0` | — |
| `ENABLE_SCAN_SCHEDULER` | hayır | `1` ise panel süreci içinde `setInterval` tarama döngüsü açılır | — |
| `SCAN_CHECK_INTERVAL_MS` | hayır | döngü aralığı, varsayılan `300000` (5 dk) | — |
| `CHROMIUM_EXECUTABLE_PATH` | scanner imajında | compose `/usr/bin/chromium-browser` veriyor | — |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | hayır | `SMTP_HOST` yoksa mail gönderilmez, console'a log düşer | SMTP sağlayıcın |
| `PANEL_URL` | hayır | bildirim e-postalarındaki panel linkleri | `https://panel.ajans.com` |

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

`/healthz` `{"ok":true,"store":"postgres"}` döner (`src/panel/server.ts:154`). `store:"memory"` görürsen
`DATABASE_URL` set edilmemiş demektir — prod'da bu veri kaybı demek, durdur ve `.env`'i düzelt.

Boot sırasında konteyner loglarında şunları beklersin:
- `[sched] sürekli izleme döngüsü: 300000ms aralıkla` — yalnız `ENABLE_SCAN_SCHEDULER=1` ise.
- `WORKER_TOKEN ayarlı değil` uyarısı — token boşsa çıkar; dahili döngü kullanıyorsan normal,
  harici cron kullanacaksan hatadır.

**Ölçüldü (2026-11-07, Docker 29.9.2 / compose v5.6.1):** `docker compose up -d --build` → imaj 177 paketli
chromium kurulumuyla build oldu, `veriform-db-1 Up (healthy)` + `veriform-panel-1 Up (healthy)`,
`docker inspect` health `healthy`, `curl /healthz` → `{"ok":true,"store":"postgres"}`, log'da
`[sched] sürekli izleme döngüsü: 300000ms aralıkla`. Build + boot + ilk tarama ~4 dk sürdü (chromium indirme dahil).

**/healthz kör noktası (ölçüldü):** `/healthz` yalnız sürecin ayakta olduğunu söylüyor — veritabanına
sorgu atmıyor. Postgres parolası bozukken (aşağıdaki volume tuzağı) `{"ok":true,"store":"postgres"}`
ve HEALTHCHECK `healthy` kalmaya devam etti, Writes ise 4xx/5xx verdi. Yani compose `healthy` tek
başına "sistem çalışıyor" kanıtı değil; yayında en az bir gerçek okuma (`/clients` 302'si ya da bir
tarama kaydı) de doğrulanmalı. Kalıcı çözüm healthz'e `select 1` eklemek — kod tarafında yapılmadı.

## 3. Şema

`src/panel/schema.sql` 182 satır, `IF NOT EXISTS` içermez — **tek seferlik init içindir**.

- Compose yolu: `./src/panel/schema.sql:/docker-entrypoint-initdb.d/01-schema.sql:ro` mount'u,
  Postgres yalnızca **boş `pgdata` volume'ünde** bu dosyayı uygular. Volume doluysa ikinci boot'ta
  şema hiç uygulanmaz (sessizce atlanır).
- CI/manuel yol: `PG_URL=… node scripts/apply-schema.mjs`. Dikkat: bu script `PG_URL` okur,
  panel `DATABASE_URL` okur — aynı veritabanına iki farklı değişken adıyla bağlanıyorsun.
- İkinci kez uygularsan `relation "tenants" already exists` alırsın. Bu hata boşa çalıştırma
  işaretidir, şemanın gerçekten uygulanmadığı anlamına gelmez; tablo listesini
  (`tenants, clients, users, audit_log, api_keys, sites, scans, consent_receipts, dsar_requests, corrections`)
  `psql`/`pg` ile sayarak doğrula.
- Şemada sonraki değişiklik = migration yazılmalı. Bugün migration aracı yok; bu bir yayınlama
  eşiği, el yordamı `ALTER` ile geçme.

**Volume tuzağı (ölçüldü):** `POSTGRES_PASSWORD` yalnız `pgdata` **boşken** init sırasında Postgres'e
gider. Var olan bir volume ile `.env`'deki parolayı değiştirirsen konteynerler `healthy` kalır,
panel boot eder, `/healthz` yeşildir — ama her yazma `password authentication failed for user
"postgres"` ile patlar ve kullanıcı generic "Kayıt başarısız" görür. Elimde 2026-11-04'ten kalma bir
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
3. Oturum çerezi 7 gün (`Max-Age`), `HttpOnly`, `SameSite=Lax`.
4. `/clients` → müşteri ekle → site ekle → siteden embed snippet + ingest token'ı al.

**Güvenlik uyarısı (kodda ölçüldü):** `/register` ve `/login` throttle'suz — bellek içi rate limiter
yalnız kamu `/tarama` POST'unda (`server.ts:90`). Şifre scrypt ile hash'leniyor ama parola deneme
hızı sunucu tarafında sınırsız. Ters proxy'de `/register` ve `/login` için rate-limit koy ya da
kendi ajansın dışında `/register`'ı kapat. Ayrıca `vf_session` çerezinde `Secure` bayrağı yok
(`server.ts:131`) — düz HTTP'ye inen ilk istekte çerez gider. TLS aşağıda zorunlu.

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
# yanıt: {"scanned":3,"failed":0}
```

crontab için saate uygun aralık: `*/5 * * * *`. **Bilinen fark:** bu uç `runScheduledScans(store)`
çağrısını `notifier` vermeden yapıyor (`server.ts:440`), yani değişiklik uyarı e-postaları **bu yoldan
gitmez**. Harici cron modeline geçeceksen önce o satırın `notifier`'a bağlanması gerekir.

Her iki yolda da SMTP tanımsızsa mail log'a düşer — bildirim bekliyorsan `SMTP_*` set et.

**Worker ucu konteynerde ölçüldü** (`WORKER_TOKEN` set iken):

| Çağrı | Sonuç |
|---|---|
| token başlıksız `POST /internal/run-scheduled` | `403` |
| `x-worker-token: yanlis-token-degeri` | `403` |
| doğru token, vakti gelen 1 site | `200 {"scanned":1,"failed":0}` — 3,2 sn |
| hemen ikinci çağrı (aynı site, 24 sa dolmadı) | `200 {"scanned":0,"failed":0}` |

Aynı turda konteynerin kendi chromium'u (`/usr/bin/chromium-browser`) ile gerçek sayfa yüklendi:
`https://example.com/` kaydı `formCount 0 / fieldCount 0` üretti (o sayfada form yok), host'a
kurduğum fixture sayfası (`http://host.docker.internal:8099/`) ise `formCount 1 / fieldCount 2 /
categoryCounts [email, tckn] / destinations 1` üretti. Yani embed enjeksiyonu + form keşfi + PII
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
bedenlerine göre yükselt. Sonrasında `PANEL_URL=https://panel.ajans.com` ver; compose hâlâ
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

## 7. Güncelleme ve rotasyon

```bash
git pull && docker compose build panel && docker compose up -d   # kesinti: birkaç saniye
```

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

- [ ] `curl /healthz` → `{"ok":true,"store":"postgres"}` — **bu tek başına yetmez**, DB'ye sorgu atmıyor
- [ ] Uygulama tarafı gerçek okuma/yazma: `/register` 302 döndü mü (400 = Postgres bağlantısı kırık)
- [ ] `pgdata` volume'ü ile `POSTGRES_PASSWORD` uyumlu mu (eski volume + yeni parola = sessiz kırık)
- [ ] `/register` ile tek hesap açıldı, anonim `/clients` → 302 `/login`
- [ ] Site + embed + ingest token'ı ile gerçek tarama kaydı (`/tarama` ya da panel)
- [ ] `WORKER_TOKEN` ya set ya bilinçli olarak boş (uç 403) — hangisi seçildiyse cron da ona göre
- [ ] Ters proxy HTTPS + HTTP→HTTPS yönlendirmesi, `4620` internete kapalı
- [ ] SMTP: test bildirimi gerçekten kutuya düştü mü
- [ ] Yedek komutu cron'landı ve **geri yükleme de denendi** (denenmemiş yedek yedek değildir)
- [ ] `LICENSE` dosyasındaki `Licensor` placeholder'ı hukuki ünvanla dolduruldu
- [ ] Repoya public kararında: `docs/pilot-ajans-listesi.md` ve `docs/red-team-dogrulama.md`
  history'den çıkarıldı (private→public tüm commit'leri açar)

## 10. Bilinen sınırlar

- Migration aracı yok; şema değişikliği elle ve riskli.
- `runScheduledScans` tek süreçte `setInterval` — çok kopyalı (scaled) deploy'ta aynı site
  birden fazla taranabilir. Faz 1'de ayrı worker konteynerine taşınacak.
- `dist/` gitignored; imaj her boot'ta `pnpm build:panel` çıktısını kendisi üretiyor (Dockerfile multi-stage).
- Rate limiter bellek içi ve anahtarı `req.socket.remoteAddress`: panel yeniden başladığında sayaçlar
  sıfırlanır, çok kopyada paylaşılır değil, ters proxy arkasında tek balta haline gelir (§6).
- `/healthz` veritabanına sorgu atmıyor: kırık Postgres bağlantısında da `ok:true` ve konteyner
  `healthy` (§2 ve §3'te ölçüldü). Prod izlemesi tek başına healthz'e güvenmemeli.
- Compose `build` kullanıyor, `image:` satırı yok → etiketli rollback kurulu değil (§8).
- `vf_session`'da `Secure` bayrağı yok; `/register` ve `/login`'de throttle yok (§4).
- `/internal/run-scheduled` turu `notifier` vermeden çalışıyor → cron modelinde uyarı e-postası yok (§5).

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
