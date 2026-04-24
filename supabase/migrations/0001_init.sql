-- Artist Marketplace — initial schema
-- Run this in Supabase SQL Editor after creating the project.

create extension if not exists vector;

-- ARTISTS: linked to auth.users one-to-one
create table if not exists public.artists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete cascade,
  display_name text not null,
  bio text,
  social_links jsonb default '{}'::jsonb,  -- {instagram, tiktok, website, ...}
  reach_score int default 0,               -- cached follower sum, refreshed async
  created_at timestamptz default now()
);

-- WORKS: the pieces an artist lists
create type medium_kind as enum ('music', 'illustration', 'video', 'character');
create type listing_terms as enum ('buy_outright', 'license', 'commission');

create table if not exists public.works (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.artists(id) on delete cascade,
  title text not null,
  description text,
  medium medium_kind not null,
  file_url text,                           -- Supabase Storage path or external URL
  thumbnail_url text,
  embedding vector(1536),                  -- OpenAI text-embedding-3-small
  created_at timestamptz default now()
);

-- LISTINGS: commercial terms for a work
create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.works(id) on delete cascade,
  terms listing_terms not null,
  price_cents int,
  notes text,
  created_at timestamptz default now()
);

-- Vector index for fast similarity search
create index if not exists works_embedding_idx
  on public.works using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create index if not exists works_artist_id_idx on public.works(artist_id);
create index if not exists listings_work_id_idx on public.listings(work_id);

-- Semantic search RPC: returns works ranked by cosine similarity.
-- The backend calls this then applies a diversity re-rank in Python.
create or replace function public.search_works(
  query_embedding vector(1536),
  match_count int default 50
)
returns table (
  work_id uuid,
  artist_id uuid,
  title text,
  medium medium_kind,
  similarity float
)
language sql stable
as $$
  select
    w.id as work_id,
    w.artist_id,
    w.title,
    w.medium,
    1 - (w.embedding <=> query_embedding) as similarity
  from public.works w
  where w.embedding is not null
  order by w.embedding <=> query_embedding
  limit match_count;
$$;

-- RLS
alter table public.artists enable row level security;
alter table public.works enable row level security;
alter table public.listings enable row level security;

-- Everyone can read (it's a marketplace)
create policy "artists_read_all" on public.artists for select using (true);
create policy "works_read_all" on public.works for select using (true);
create policy "listings_read_all" on public.listings for select using (true);

-- Artists can only write their own rows
create policy "artists_insert_own" on public.artists for insert
  with check (user_id = auth.uid());
create policy "artists_update_own" on public.artists for update
  using (user_id = auth.uid());

create policy "works_write_own" on public.works for all
  using (artist_id in (select id from public.artists where user_id = auth.uid()))
  with check (artist_id in (select id from public.artists where user_id = auth.uid()));

create policy "listings_write_own" on public.listings for all
  using (work_id in (
    select w.id from public.works w
    join public.artists a on a.id = w.artist_id
    where a.user_id = auth.uid()
  ))
  with check (work_id in (
    select w.id from public.works w
    join public.artists a on a.id = w.artist_id
    where a.user_id = auth.uid()
  ));
