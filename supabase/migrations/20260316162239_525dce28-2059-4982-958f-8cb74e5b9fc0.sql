-- Remove the overly permissive INSERT policy
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- Add WITH CHECK to UPDATE policy (trigger already protects but belt-and-suspenders)
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);