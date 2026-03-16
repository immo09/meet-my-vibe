-- Fix verification_requests INSERT to enforce pending status
DROP POLICY IF EXISTS "Users can submit verification requests" ON public.verification_requests;
CREATE POLICY "Users can submit verification requests" ON public.verification_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id 
    AND status = 'pending' 
    AND reviewer_id IS NULL 
    AND reviewed_at IS NULL
  );

-- Tighten profiles INSERT to only allow setting safe columns
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = id
    AND verified = false
    AND reputation_score = 0
    AND rating_count = 0
    AND ghosting_strikes = 0
  );