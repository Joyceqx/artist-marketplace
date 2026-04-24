-- Schema alignment: replaces fields that lived in web/lib/mock.ts.
-- Idempotent — safe to re-run.

-- Two-tier attestation: self-declared (free, default) vs verified (paid).
do $$ begin
  create type attestation_tier as enum ('self_declared', 'verified');
exception when duplicate_object then null; end $$;

alter table public.artists
  add column if not exists location text,
  add column if not exists attestation_tier attestation_tier
    not null default 'self_declared';

-- Per-work starting license price.
alter table public.works
  add column if not exists price_from_cents int not null default 4000;

-- Useful for the directory / artist profile listings.
create index if not exists artists_attestation_tier_idx
  on public.artists(attestation_tier);
create index if not exists works_price_from_cents_idx
  on public.works(price_from_cents);
