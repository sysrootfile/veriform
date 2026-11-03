-- Veriform Panel Şeması — Postgres 15+
-- Bu şema, createInMemoryPanelStore ile aynı sözleşmeyi uygular (src/panel/store.ts).
-- Multi-tenancy: tablo başına RLS; API katmanı her bağlantıda
-- SET app.current_tenant = '<uuid>' ayarlar. Panel admin rolü bypass eder.

create extension if not exists "pgcrypto";

create table tenants (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  kind        text not null check (kind in ('agency', 'direct')),
  brand_color     text,
  brand_logo_url  text,
  created_at  timestamptz not null default now()
);

create table clients (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants (id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);
create index clients_tenant_idx on clients (tenant_id);

-- Kiracı sahibi girişi: scrypt hash'li şifre (bkz. src/panel/auth.ts)
create table users (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants (id) on delete cascade,
  email         text not null unique,
  password_hash text not null,
  role          text not null default 'owner' check (role in ('owner', 'auditor')),
  created_at    timestamptz not null default now()
);
create index users_tenant_idx on users (tenant_id);

-- Panel eylemlerinin denetim izi (uyum ürünü için audit trail)
create table audit_log (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants (id) on delete cascade,
  action     text not null,
  detail     jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index audit_tenant_idx on audit_log (tenant_id, created_at);

create table sites (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references clients (id) on delete cascade,
  url           text not null,
  ingest_token  text not null unique,
  banner_config jsonb,
  created_at    timestamptz not null default now()
);
create index sites_client_idx on sites (client_id);

-- Taramalar: rapor JSON-safe sözleşmeyle (src/report/types.ts) jsonb olarak saklanır.
create table scans (
  id               uuid primary key default gen_random_uuid(),
  site_id          uuid not null references sites (id) on delete cascade,
  scanned_at       timestamptz not null default now(),
  report           jsonb not null,
  cookies          jsonb not null default '[]',
  observed_targets jsonb not null default '[]'
);
create index scans_site_idx on scans (site_id, scanned_at);

-- Rıza kanıtları: client kanıtı (selfHash'li attestasyon) + sunucu zincir bağları.
-- chain_hash = sha256(canonical_json({receipt, prev_chain_hash})) — bkz. src/panel/chain.ts
create table consent_receipts (
  id              uuid primary key default gen_random_uuid(),
  site_id         uuid not null references sites (id) on delete cascade,
  received_at     timestamptz not null default now(),
  receipt         jsonb not null,
  prev_chain_hash text not null,
  chain_hash      text not null
);
create index receipts_site_idx on consent_receipts (site_id, received_at);

-- Veri sahibi başvuruları (DSAR) — deadline KVKK m.13: alım + 30 gün
create table dsar_requests (
  id            uuid primary key default gen_random_uuid(),
  site_id       uuid not null references sites (id) on delete cascade,
  type          text not null,
  subject_name  text not null,
  subject_email text not null,
  message       text,
  received_at   timestamptz not null default now(),
  deadline_at   timestamptz not null,
  status        text not null default 'new' check (status in ('new', 'in-review', 'completed', 'rejected')),
  extended      boolean not null default false,
  responded_at  timestamptz,
  response_note text
);
create index dsar_site_idx on dsar_requests (site_id, received_at);

-- İnsan onaylı düzeltme haritası: gelecek taramalara otomatik uygulanır
create table corrections (
  id         uuid primary key default gen_random_uuid(),
  site_id    uuid not null references sites (id) on delete cascade,
  field_name text not null,
  category   text not null,
  created_at timestamptz not null default now(),
  unique (site_id, field_name)
);

-- ---- RLS: kiracı izolasyonu -------------------------------------------------

alter table tenants enable row level security;
alter table clients enable row level security;
alter table sites  enable row level security;
alter table scans  enable row level security;
alter table consent_receipts enable row level security;
alter table users   enable row level security;
alter table dsar_requests enable row level security;
alter table corrections enable row level security;

create policy tenant_self on tenants
  using (id = current_setting('app.current_tenant', true)::uuid);

create policy tenant_users on users
  using (tenant_id = current_setting('app.current_tenant', true)::uuid)
  with check (tenant_id = current_setting('app.current_tenant', true)::uuid);

create policy tenant_clients on clients
  using (tenant_id = current_setting('app.current_tenant', true)::uuid)
  with check (tenant_id = current_setting('app.current_tenant', true)::uuid);

create policy tenant_sites on sites
  using (
    exists (
      select 1 from clients c
      where c.id = sites.client_id
        and c.tenant_id = current_setting('app.current_tenant', true)::uuid
    )
  )
  with check (
    exists (
      select 1 from clients c
      where c.id = sites.client_id
        and c.tenant_id = current_setting('app.current_tenant', true)::uuid
    )
  );

create policy tenant_scans on scans
  using (
    exists (
      select 1
      from sites s join clients c on c.id = s.client_id
      where s.id = scans.site_id
        and c.tenant_id = current_setting('app.current_tenant', true)::uuid
    )
  );

create policy tenant_receipts on consent_receipts
  using (
    exists (
      select 1
      from sites s join clients c on c.id = s.client_id
      where s.id = consent_receipts.site_id
        and c.tenant_id = current_setting('app.current_tenant', true)::uuid
    )
  );

create policy tenant_dsars on dsar_requests
  using (
    exists (
      select 1
      from sites s join clients c on c.id = s.client_id
      where s.id = dsar_requests.site_id
        and c.tenant_id = current_setting('app.current_tenant', true)::uuid
    )
  );

create policy tenant_corrections on corrections
  using (
    exists (
      select 1
      from sites s join clients c on c.id = s.client_id
      where s.id = corrections.site_id
        and c.tenant_id = current_setting('app.current_tenant', true)::uuid
    )
  );

create policy tenant_audit on audit_log
  using (tenant_id = current_setting('app.current_tenant', true)::uuid);

-- Not: app.current_tenant ayarlanmamışsa (null) hiçbir satır dönmez —
-- varsayılan reddet, ürünün rıza ilkesiyle aynı.
