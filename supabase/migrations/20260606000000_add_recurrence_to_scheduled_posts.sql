-- Add recurrence columns to scheduled_posts table
ALTER TABLE public.scheduled_posts
ADD COLUMN IF NOT EXISTS is_recurring boolean DEFAULT false NOT NULL,
ADD COLUMN IF NOT EXISTS recurrence_interval text,
ADD COLUMN IF NOT EXISTS recurrence_end_type text,
ADD COLUMN IF NOT EXISTS recurrence_end_date timestamptz;
