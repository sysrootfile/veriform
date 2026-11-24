-- İzleme kodu bağlantı sinyali: embed config çekiminde damgalanır.
alter table sites add column embed_last_seen_at timestamptz;