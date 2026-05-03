create table if not exists logs (
  id uuid primary key default gen_random_uuid(),
  couple_id text not null,
  log_date date not null,
  data jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (couple_id, log_date)
);

alter table logs enable row level security;

-- The app writes through Vercel API routes using the Supabase service role key.
-- Do not expose the service role key in browser code.
