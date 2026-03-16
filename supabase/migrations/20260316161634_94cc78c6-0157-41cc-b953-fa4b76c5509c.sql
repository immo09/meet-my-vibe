-- Replace broad profiles SELECT with own-profile-only policy
DROP POLICY IF EXISTS "Authenticated can view basic profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

-- Users can only see their own full profile directly
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

-- Create a view for other users' public data (no lat/lng)
CREATE OR REPLACE VIEW public.public_profiles AS
  SELECT id, display_name, username, avatar_url, bio, status_message,
         verified, reputation_score, rating_count, ghosting_strikes, last_seen_at
  FROM public.profiles;

GRANT SELECT ON public.public_profiles TO authenticated;
GRANT SELECT ON public.public_profiles TO anon;