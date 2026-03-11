
-- 1. Protect system fields on profiles from user manipulation
CREATE OR REPLACE FUNCTION public.protect_profile_system_fields()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    NEW.verified := OLD.verified;
    NEW.reputation_score := OLD.reputation_score;
    NEW.rating_count := OLD.rating_count;
    NEW.ghosting_strikes := OLD.ghosting_strikes;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_protect_profile_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_system_fields();

-- 2. Drop anon-accessible profiles policy if it exists
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
