-- Run this once in the connected Supabase project's SQL Editor.
-- The Replit Supabase connector can read/write tables through PostgREST,
-- but it cannot create database tables or run arbitrary DDL.

create table if not exists public.somobay_state (
  id integer primary key,
  state jsonb not null,
  updated_at timestamptz not null default timezone('utc', now()),
  constraint somobay_state_singleton check (id = 1)
);

grant select, insert, update on table public.somobay_state to anon, authenticated;

comment on table public.somobay_state is
  'Shared state snapshot for the Somobay Somiti mobile app. The API server is the only application writer.';