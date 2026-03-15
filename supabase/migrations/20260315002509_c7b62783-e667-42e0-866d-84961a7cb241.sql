-- Drop the anon-accessible SELECT policy on profiles that exposes location data
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;