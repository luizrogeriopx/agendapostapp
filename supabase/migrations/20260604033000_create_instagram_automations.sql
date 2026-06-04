-- Create instagram_automations table to store auto-reply configurations for Instagram media
create table if not exists public.instagram_automations (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  account_id uuid references public.instagram_accounts(id) on delete cascade not null,
  media_id text not null,
  media_permalink text,
  media_thumbnail text,
  media_caption text,
  trigger_words text[] not null, -- Empty array means trigger on any comment
  comment_reply text not null,
  dm_reply text not null,
  is_active boolean default true not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Ensure there is at most one automation configuration per media_id and account
alter table public.instagram_automations drop constraint if exists unique_account_media;
alter table public.instagram_automations add constraint unique_account_media unique (account_id, media_id);

-- Enable RLS
alter table public.instagram_automations enable row level security;

-- Policies for RLS
drop policy if exists "Users can manage their own automations" on public.instagram_automations;
create policy "Users can manage their own automations"
  on public.instagram_automations
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Add update trigger for updated_at field
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_instagram_automations_updated_at on public.instagram_automations;
create trigger set_instagram_automations_updated_at
  before update on public.instagram_automations
  for each row
  execute function public.handle_updated_at();
