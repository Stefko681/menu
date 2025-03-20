-- Supabase Row Level Security (RLS) Policies for Children Table

-- First, enable Row Level Security on the children table
ALTER TABLE public.children ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to insert their own children
CREATE POLICY "Users can add their own children"
  ON public.children
  FOR INSERT
  WITH CHECK (auth.uid() = parent_id);

-- Create policy to allow users to select only their own children
CREATE POLICY "Users can view their own children"
  ON public.children
  FOR SELECT
  USING (auth.uid() = parent_id);

-- Create policy to allow users to update only their own children
CREATE POLICY "Users can update their own children"
  ON public.children
  FOR UPDATE
  USING (auth.uid() = parent_id);

-- Create policy to allow users to delete only their own children
CREATE POLICY "Users can delete their own children"
  ON public.children
  FOR DELETE
  USING (auth.uid() = parent_id);

-- Create policy to allow admins to manage all children
-- This assumes you have a 'profiles' table with a 'role' column
CREATE POLICY "Admins can manage all children"
  ON public.children
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Instructions for implementation:
-- 1. Go to your Supabase dashboard
-- 2. Navigate to the SQL Editor
-- 3. Paste and execute these commands
-- 4. Verify the policies are applied in the Auth > Policies section

-- Note: If you already have conflicting policies, you may need to drop them first:
-- DROP POLICY IF EXISTS "policy_name" ON public.children;