-- Add stripe columns to user_invoices table
ALTER TABLE public.user_invoices
ADD COLUMN IF NOT EXISTS stripe_session_id text,
ADD COLUMN IF NOT EXISTS stripe_invoice_id text;
