-- Add subscription_plan to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS subscription_plan text DEFAULT 'teste' CHECK (subscription_plan IN ('teste', 'agendapro', 'automacaopro', 'premium'));

-- Add reply_count to automations
ALTER TABLE public.instagram_automations
ADD COLUMN IF NOT EXISTS reply_count integer DEFAULT 0 NOT NULL;

-- Create user_invoices table for financial history simulation
CREATE TABLE IF NOT EXISTS public.user_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_id text NOT NULL,
  billing_cycle text NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly')),
  amount numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'paid', 'cancelled')),
  due_date timestamptz NOT NULL,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_invoices TO authenticated;
GRANT ALL ON public.user_invoices TO service_role;

ALTER TABLE public.user_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own invoices" ON public.user_invoices
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
