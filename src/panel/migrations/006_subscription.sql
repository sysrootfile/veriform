-- Blok 12: abonelik yaşam döngüsü (ödemesiz) — deneme süresi + plan geçiş talepleri.
alter table tenants add column trial_ends_at timestamptz;

create table plan_change_requests (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants (id) on delete cascade,
  from_package text not null check (from_package in ('starter', 'pro', 'ultimate')),
  to_package   text not null check (to_package in ('starter', 'pro', 'ultimate')),
  status       text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at   timestamptz not null default now(),
  decided_at   timestamptz
);
create index plan_change_requests_tenant_idx on plan_change_requests (tenant_id);
-- Kiracı başına tek bekleyen talep: kısmi unique index DB düzeyinde garanti eder.
create unique index plan_change_requests_one_pending
  on plan_change_requests (tenant_id) where status = 'pending';