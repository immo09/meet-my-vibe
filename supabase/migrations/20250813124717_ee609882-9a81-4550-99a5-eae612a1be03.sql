-- Fix: use DO blocks for enum creation (IF NOT EXISTS not supported)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_category') THEN
    CREATE TYPE public.report_category AS ENUM ('ghosting','rude','abuse','spam','other');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'verification_status') THEN
    CREATE TYPE public.verification_status AS ENUM ('pending','approved','rejected');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'verification_method') THEN
    CREATE TYPE public.verification_method AS ENUM ('id','selfie','social');
  END IF;
END $$;

-- Roles table and helper
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  );
$$;

-- Policies for user_roles
DO $$ BEGIN
  CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  bio text,
  avatar_url text,
  verified boolean not null default false,
  reputation_score numeric(4,2) not null default 0,
  rating_count integer not null default 0,
  ghosting_strikes integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.recalc_profile_reputation(target_user uuid)
RETURNS void AS $$
DECLARE
  avg_rating numeric;
  ghosting_count int;
  rude_count int;
  abuse_count int;
  spam_count int;
  penalty numeric := 0;
  total_count int := 0;
BEGIN
  SELECT coalesce(avg(score)::numeric, 0), count(*) INTO avg_rating, total_count FROM public.ratings WHERE ratee_id = target_user;
  SELECT count(*) FILTER (WHERE category = 'ghosting')
       , count(*) FILTER (WHERE category = 'rude')
       , count(*) FILTER (WHERE category = 'abuse')
       , count(*) FILTER (WHERE category = 'spam')
  INTO ghosting_count, rude_count, abuse_count, spam_count
  FROM public.user_reports WHERE reported_id = target_user;

  penalty := (ghosting_count * 0.7) + (rude_count * 0.4) + (abuse_count * 0.6) + (spam_count * 0.3);
  avg_rating := LEAST(5, GREATEST(0, avg_rating - penalty));

  UPDATE public.profiles
    SET reputation_score = coalesce(avg_rating, 0),
        rating_count = coalesce(total_count, 0),
        ghosting_strikes = coalesce(ghosting_count, 0)
  WHERE id = target_user;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DO $$ BEGIN
  CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- RLS for profiles
DO $$ BEGIN
  CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users can delete their own profile" ON public.profiles FOR DELETE TO authenticated USING (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Posts
CREATE TABLE IF NOT EXISTS public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  content text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON public.posts(user_id);
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE TRIGGER trg_posts_updated_at BEFORE UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Posts are public" ON public.posts FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users manage their own posts" ON public.posts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Ratings
CREATE TABLE IF NOT EXISTS public.ratings (
  id uuid primary key default gen_random_uuid(),
  rater_id uuid not null references auth.users(id) on delete cascade,
  ratee_id uuid not null references auth.users(id) on delete cascade,
  score int not null check (score between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique(rater_id, ratee_id),
  check (rater_id <> ratee_id)
);
CREATE INDEX IF NOT EXISTS idx_ratings_ratee ON public.ratings(ratee_id);
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Authenticated can read ratings" ON public.ratings FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users create their own ratings" ON public.ratings FOR INSERT TO authenticated WITH CHECK (auth.uid() = rater_id AND rater_id <> ratee_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users update their own ratings" ON public.ratings FOR UPDATE TO authenticated USING (auth.uid() = rater_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users delete their own ratings" ON public.ratings FOR DELETE TO authenticated USING (auth.uid() = rater_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.after_ratings_changed()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.recalc_profile_reputation(NEW.ratee_id);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.after_ratings_deleted()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.recalc_profile_reputation(OLD.ratee_id);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DO $$ BEGIN
  CREATE TRIGGER trg_ratings_ai AFTER INSERT ON public.ratings FOR EACH ROW EXECUTE FUNCTION public.after_ratings_changed();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_ratings_au AFTER UPDATE ON public.ratings FOR EACH ROW EXECUTE FUNCTION public.after_ratings_changed();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_ratings_ad AFTER DELETE ON public.ratings FOR EACH ROW EXECUTE FUNCTION public.after_ratings_deleted();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- User reports
CREATE TABLE IF NOT EXISTS public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reported_id uuid not null references auth.users(id) on delete cascade,
  category public.report_category not null,
  notes text,
  created_at timestamptz not null default now(),
  unique(reporter_id, reported_id, category),
  check (reporter_id <> reported_id)
);
CREATE INDEX IF NOT EXISTS idx_reports_reported ON public.user_reports(reported_id);
ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Admins can read all reports" ON public.user_reports FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users can view their submitted reports" ON public.user_reports FOR SELECT TO authenticated USING (auth.uid() = reporter_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users can create reports" ON public.user_reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id AND reporter_id <> reported_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users manage their own reports" ON public.user_reports FOR UPDATE TO authenticated USING (auth.uid() = reporter_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users can delete their own reports" ON public.user_reports FOR DELETE TO authenticated USING (auth.uid() = reporter_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.after_reports_changed()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.recalc_profile_reputation(coalesce(NEW.reported_id, OLD.reported_id));
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DO $$ BEGIN
  CREATE TRIGGER trg_reports_ai AFTER INSERT ON public.user_reports FOR EACH ROW EXECUTE FUNCTION public.after_reports_changed();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_reports_au AFTER UPDATE ON public.user_reports FOR EACH ROW EXECUTE FUNCTION public.after_reports_changed();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_reports_ad AFTER DELETE ON public.user_reports FOR EACH ROW EXECUTE FUNCTION public.after_reports_changed();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Verification requests
CREATE TABLE IF NOT EXISTS public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status public.verification_status not null default 'pending',
  method public.verification_method not null,
  document_url text,
  selfie_url text,
  notes text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewer_id uuid references auth.users(id)
);
CREATE INDEX IF NOT EXISTS idx_verif_user ON public.verification_requests(user_id);
ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users can create their verification request" ON public.verification_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users can view their own verification" ON public.verification_requests FOR SELECT TO authenticated USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Admins can view all verifications" ON public.verification_requests FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Admins can update verifications" ON public.verification_requests FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Auto-create profile and default role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, coalesce(NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

DO $$ BEGIN
  CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Storage buckets and policies
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars','avatars', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('verifications','verifications', false) ON CONFLICT (id) DO NOTHING;

-- Avatars policies
DO $$ BEGIN
  CREATE POLICY "Public can read avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users can upload their own avatars" ON storage.objects FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users can update their own avatars" ON storage.objects FOR UPDATE TO authenticated USING (
    bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Verifications policies
DO $$ BEGIN
  CREATE POLICY "Owner or admin can read verifications" ON storage.objects FOR SELECT TO authenticated USING (
    bucket_id = 'verifications' AND (
      auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(),'admin')
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users upload their own verifications" ON storage.objects FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'verifications' AND auth.uid()::text = (storage.foldername(name))[1]
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users update their own verifications" ON storage.objects FOR UPDATE TO authenticated USING (
    bucket_id = 'verifications' AND auth.uid()::text = (storage.foldername(name))[1]
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Admins can delete verifications" ON storage.objects FOR DELETE TO authenticated USING (
    bucket_id = 'verifications' AND public.has_role(auth.uid(),'admin')
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Helpful index for discovery ordering
CREATE INDEX IF NOT EXISTS idx_profiles_reputation ON public.profiles(reputation_score DESC, verified DESC);
