-- Oturum düşürme: bu tarihten önce verilen çerezler geçersiz sayılır (şifre değişimi/sıfırlama).
alter table users add column sessions_valid_after timestamptz not null default to_timestamp(0);
