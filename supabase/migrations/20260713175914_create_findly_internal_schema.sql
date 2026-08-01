create schema if not exists findly_internal;

revoke all on schema findly_internal from public, anon, authenticated;

create table if not exists findly_internal.shopping_requests (
  id text primary key,
  thread_id text not null unique,
  user_id uuid,
  status text not null,
  input jsonb not null,
  result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists shopping_requests_user_created_idx
  on findly_internal.shopping_requests(user_id, created_at desc);

create table if not exists findly_internal.browser_artifacts (
  id uuid primary key default gen_random_uuid(),
  request_id text not null references findly_internal.shopping_requests(id) on delete cascade,
  kind text not null,
  storage_key text not null,
  retailer_id text,
  created_at timestamptz not null default now()
);

alter table findly_internal.shopping_requests enable row level security;
alter table findly_internal.browser_artifacts enable row level security;

comment on schema findly_internal is 'Backend-only Findly workflow state; not exposed through the Supabase Data API.';
