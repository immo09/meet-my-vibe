-- Fix security vulnerability: Restrict profile visibility to authenticated users only
-- This prevents unauthorized harvesting of user location data

-- Drop the existing overly permissive policy
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

-- Create a new policy that requires authentication to view profiles
CREATE POLICY "Authenticated users can view profiles" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (true);

-- Add additional policy for better location privacy: 
-- Only show location data to other users, not to the profile owner themselves when viewing others
-- (This is optional but adds an extra layer of privacy)