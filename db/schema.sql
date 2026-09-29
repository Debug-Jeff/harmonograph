-- Gallery table. The app creates this automatically on first use; run it by hand only if
-- your database user can't create tables.

create table if not exists curves (
  id          text primary key,
  created_by  text not null,
  title       text not null,
  params      jsonb not null,          -- { f1, f2, tuning, decay, view, palette }
  created_at  timestamptz not null default now(),
  client_hash text not null            -- salted hash of the saver's IP, for rate limiting only
);

create index if not exists curves_client_recent on curves (client_hash, created_at desc);
