create table if not exists findly_internal.retailer_search_cache (
  cache_key text primary key,
  retailer_id text not null,
  result jsonb not null,
  observed_at timestamptz not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists retailer_search_cache_expires_idx
  on findly_internal.retailer_search_cache(expires_at);

alter table findly_internal.retailer_search_cache enable row level security;

revoke all on findly_internal.retailer_search_cache from public, anon, authenticated;

comment on table findly_internal.retailer_search_cache is
  'Backend-only short-lived cache of successfully verified retailer search responses.';
