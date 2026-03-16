-- Create a function to list public profiles (for discovery/search)
CREATE OR REPLACE FUNCTION public.list_public_profiles(_exclude_user_id uuid DEFAULT NULL, _limit integer DEFAULT 50)
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
  WHERE (_exclude_user_id IS NULL OR p.id != _exclude_user_id)
  ORDER BY p.verified DESC, p.reputation_score DESC
  LIMIT _limit;
$$;