-- Reconciled from remote migration history (applied out-of-band on 2026-11-19).
-- Enables pg_net for the one-time brand asset seed. Preserved verbatim so the
-- repository migration chain matches supabase_migrations.schema_migrations.

drop schema if exists net;
create extension pg_net;
