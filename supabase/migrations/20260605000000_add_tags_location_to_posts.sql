-- Add user_tags and location_id columns to scheduled_posts table
ALTER TABLE public.scheduled_posts
ADD COLUMN IF NOT EXISTS user_tags text[] DEFAULT '{}' NOT NULL,
ADD COLUMN IF NOT EXISTS location_id text;
