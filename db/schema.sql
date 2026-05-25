-- ============================================================
-- Payment Agent — Supabase schema
-- Run this in the Supabase SQL editor to set up the database.
-- ============================================================

-- One row per payment attempt (successful or failed)
create table if not exists transactions (
  id           uuid        primary key default gen_random_uuid(),
  created_at   timestamptz not null    default now(),
  recipient    text        not null,
  amount_usdc  numeric(18, 6) not null,
  memo         text,
  tx_hash      text,                   -- null if the tx failed before broadcast
  success      boolean     not null    default false
);

-- One row per UTC calendar day — tracks cumulative USDC spent
create table if not exists daily_limits (
  date          date        primary key,
  total_spent   numeric(18, 6) not null default 0,
  last_updated  timestamptz not null    default now()
);

-- Index for fast daily lookups
create index if not exists transactions_created_at_idx
  on transactions (created_at desc);
