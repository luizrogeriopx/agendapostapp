-- Add role column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role text DEFAULT 'user' CHECK (role IN ('user', 'admin'));

-- Ensure any null profiles get set to user
UPDATE public.profiles SET role = 'user' WHERE role IS NULL;

-- Automatically elevate the user with email containing luizrogeriopx or name containing Luiz to admin
UPDATE public.profiles
SET role = 'admin'
WHERE id IN (
  SELECT id FROM auth.users
  WHERE email LIKE '%luizrogeriopx%'
     OR raw_user_meta_data->>'name' LIKE '%Luiz%'
     OR raw_user_meta_data->>'full_name' LIKE '%Luiz%'
  LIMIT 1
);
