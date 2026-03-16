-- Create a secure function to look up public profile data (no lat/lng)
CREATE OR REPLACE FUNCTION public.get_public_profiles(_user_ids uuid[])
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
  last_seen_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.display_name, p.username, p.avatar_url, p.bio, p.status_message,
         p.verified, p.reputation_score, p.rating_count, p.ghosting_strikes, p.last_seen_at
  FROM profiles p
  WHERE p.id = ANY(_user_ids);
$$;

-- Drop the view since we'll use the function instead
DROP VIEW IF EXISTS public.public_profiles;