-- Create webhook_logs table for debugging incoming Meta Webhooks
create table if not exists public.webhook_logs (
  id uuid default gen_random_uuid() primary key,
  received_at timestamptz default now() not null,
  payload jsonb not null,
  error text
);

grant all on public.webhook_logs to service_role;
grant all on public.webhook_logs to authenticated;
