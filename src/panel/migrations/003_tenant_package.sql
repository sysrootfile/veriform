-- Paket seçimi kayıtta saklanır; site kotası uygulama katmanında zorlanır (plans.ts).
-- Mevcut kiracılar starter varsayılır — erken erişim döneminde açılan hesaplar.
alter table tenants
  add column package text not null default 'starter'
  check (package in ('starter', 'pro', 'ultimate'));