-- Blok 9: hesap yaşam döngüsü — e-posta doğrulama + tek kullanımlık hesap token'ları.
alter table users add column email_verified_at timestamptz;

create table account_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  purpose text not null check (purpose in ('verify-email', 'reset-password')),
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index account_tokens_user_idx on account_tokens (user_id);