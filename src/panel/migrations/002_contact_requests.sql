-- Landing iletişim talepleri — operatör düzeyi (api_keys gibi kiracıya bağlı değil, RLS yok).
-- Ziyaretçi formu POST /contact ile yazar; operatör mail + bu tablodan okur.

create table contact_requests (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  email      text not null,
  company    text,
  package    text check (package in ('starter', 'pro', 'ultimate')),
  message    text not null,
  created_at timestamptz not null default now()
);
create index contact_requests_created_idx on contact_requests (created_at);