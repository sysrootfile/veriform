-- RLS'i etkin kılan uygulama rolü (migration 009)
-- Panele gelen kiracı oturumundan yapılan her sorgu bu rolle koşar
-- (src/panel/store.pg.ts asTenant): rol satır sahibi değildir, bu yüzden
-- 001'de tanımlı politikalar gerçekten uygulanır. Rol işlem (transaction)
-- bitince bağlantı sahibine döner.
--
-- Uygulama, migration'ı çalıştıran kullanıcıyla bağlanır (compose ve CI: postgres).
-- İkinci bir şifre yoktur; ayrı bir bağlantı hesabı ileride sertleştirme olarak eklenebilir.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'veriform_app') then
    create role veriform_app nosuperuser nocreaterole nocreatedb nologin noinherit;
  end if;
  execute format('grant veriform_app to %I', current_user);
end
$$;

grant usage on schema public to veriform_app;

-- Yalnız kiracı verisi. contact_requests (operatör), account_tokens (belirteç),
-- schema_migrations (migration koşucusu) bu role açık değildir.
grant select                     on tenants             to veriform_app;
grant select, insert, update, delete on clients         to veriform_app;
grant select, insert, update    on sites                to veriform_app;
grant select                     on scans               to veriform_app;
grant select                     on consent_receipts    to veriform_app;
grant select, update             on users               to veriform_app;
grant select, update             on dsar_requests       to veriform_app;
grant select, insert, update     on corrections         to veriform_app;
grant select, insert             on audit_log           to veriform_app;
grant select, insert, update     on api_keys            to veriform_app;
grant select, insert             on plan_change_requests to veriform_app;

-- 001'de audit_log için politika yazılmış ama RLS anahtarı açılmamış: etkin değil.
alter table audit_log enable row level security;
drop policy if exists tenant_audit on audit_log;
create policy tenant_audit on audit_log
  using (tenant_id = current_setting('app.current_tenant', true)::uuid)
  with check (tenant_id = current_setting('app.current_tenant', true)::uuid);

alter table api_keys enable row level security;
drop policy if exists tenant_api_keys on api_keys;
create policy tenant_api_keys on api_keys
  using (tenant_id = current_setting('app.current_tenant', true)::uuid)
  with check (tenant_id = current_setting('app.current_tenant', true)::uuid);

alter table plan_change_requests enable row level security;
drop policy if exists tenant_plan_change_requests on plan_change_requests;
create policy tenant_plan_change_requests on plan_change_requests
  using (tenant_id = current_setting('app.current_tenant', true)::uuid)
  with check (tenant_id = current_setting('app.current_tenant', true)::uuid);
