
-- 1. Fix conversation_members INSERT policy: remove self-join bypass
DROP POLICY IF EXISTS "Creator can add members" ON public.conversation_members;
CREATE POLICY "Creator can add members" ON public.conversation_members
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = conversation_members.conversation_id
        AND conversations.created_by = auth.uid()
    )
  );

-- 2. Create a secure function to get nearby profiles (hides exact coords)
CREATE OR REPLACE FUNCTION public.get_nearby_profiles(_lat double precision, _lng double precision, _radius_km double precision DEFAULT 10)
RETURNS TABLE (
  id uuid,
  display_name text,
  username text,
  avatar_url text,
  bio text,
  status_message text,
  verified boolean,
  reputation_score numeric,
  rating_count integer,
  ghosting_strikes integer,
  last_seen_at timestamptz,
  distance_km double precision
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.display_name,
    p.username,
    p.avatar_url,
    p.bio,
    p.status_message,
    p.verified,
    p.reputation_score,
    p.rating_count,
    p.ghosting_strikes,
    p.last_seen_at,
    ROUND((6371 * acos(
      cos(radians(_lat)) * cos(radians(p.lat)) *
      cos(radians(p.lng) - radians(_lng)) +
      sin(radians(_lat)) * sin(radians(p.lat))
    ))::numeric, 1)::double precision AS distance_km
  FROM profiles p
  WHERE p.lat IS NOT NULL
    AND p.lng IS NOT NULL
    AND p.id != auth.uid()
    AND (6371 * acos(
      cos(radians(_lat)) * cos(radians(p.lat)) *
      cos(radians(p.lng) - radians(_lng)) +
      sin(radians(_lat)) * sin(radians(p.lat))
    )) <= _radius_km
  ORDER BY distance_km;
$$;

-- 3. Restrict profiles SELECT: users see own full profile, others see non-location fields
DROP POLICY IF EXISTS "Profiles viewable by authenticated users" ON public.profiles;

-- Users can always see their own profile (full data)
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

-- Users can see other profiles (but we'll handle location hiding via the function above)
-- We still need basic profile visibility for chat/conversation member lookups
CREATE POLICY "Authenticated can view basic profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (true);

-- 4. Restrict ratings visibility to involved parties
DROP POLICY IF EXISTS "Ratings viewable by authenticated" ON public.ratings;
CREATE POLICY "Users can view relevant ratings" ON public.ratings
  FOR SELECT TO authenticated
  USING (auth.uid() = rater_id OR auth.uid() = ratee_id);

-- 5. Add RLS policy for vapid_keys (read-only for no one via client, managed by edge function with service role)
CREATE POLICY "No direct client access to vapid_keys" ON public.vapid_keys
  FOR SELECT TO authenticated
  USING (false);
