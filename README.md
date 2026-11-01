# Veriform

> Uyumun kanıtı. / Proof of compliance.

Web sitelerinin kişisel veri toplama gerçeğini izleyen, kanıtlayan ve müşteriye özel konfigüre edilebilen uyum katmanı. Çekirdek ürün: **form veri akış izleyici** (hangi form hangi kişisel veriyi topluyor, nereye aktarıyor). Paket: çerez uyumu (Consent Mode v2 / TCF 2.2), hash zincirli rıza kanıtı, DSAR. Dağıtım: ajanslara beyaz etiket, çok kiracılı panel.

- Pazar araştırması: [docs/kvkk-gizlilik-saas-arastirma.md](docs/kvkk-gizlilik-saas-arastirma.md)
- Proje planı (Faz 0–3, ICP, fiyat hipotezi, riskler): [docs/veriform-proje-plani.md](docs/veriform-proje-plani.md)

## Geliştirme akışı

TDD mantığında ilerleriz: **kırmızı test → yeşil implementasyon → refactor → commit/branch → PR (remote varsa)**.

```bash
pnpm install
pnpm test        # vitest run
pnpm test:watch  # vitest
```

## Mimari ilkeler

1. **İzleyici ham veri saklamaz** — script yalnızca alan adı/meta veri kaydeder; değer içeriği sunucuya hiç gitmez.
2. Multi-tenant: ajans → alt müşteri → site hiyerarşisi.
3. Kanıt kayıtları append-only ve hash zincirli; Türkiye'de saklanır.

## Durum

Faz 0 — MVP (8 hafta): embed script çekirdeği (form keşfi + PII sınıflandırma) → hedef tespiti + rapor v1 → çerez tarayıcı + Consent Mode v2 banner + rıza kanıtı → white-label ajans paneli + pilot (3–5 ajans).
