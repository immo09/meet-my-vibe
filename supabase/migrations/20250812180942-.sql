-- 1) Enums and roles
create type if not exists public.app_role as enum ('admin', 'moderator', 'user');
create type if not exists public.report_category as enum ('ghosting','rude','abuse','spam','other');
create type if not exists public.verification_status as enum ('pending','approved','rejected');
create type if not exists public.verification_method as enum ('id','selfie','social');

-- 2) Roles table and helper
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique(user_id, role)
);
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles where user_id = _user_id and role = _role
  );
$$;

-- Policies for user_roles
create policy if not exists "Users can view their own roles" on public.user_roles
for select to authenticated using (auth.uid() = user_id);
create policy if not exists "Admins manage roles" on public.user_roles
for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- 3) Profiles
create table if not exists public.profiles (
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
alter table public.profiles enable row level security;

create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create or replace function public.recalc_profile_reputation(target_user uuid)
returns void as $$
declare
  avg_rating numeric;
  ghosting_count int;
  rude_count int;
  abuse_count int;
  spam_count int;
  penalty numeric := 0;
  total_count int := 0;
begin
  select coalesce(avg(score)::numeric, 0), count(*) into avg_rating, total_count from public.ratings where ratee_id = target_user;
  select count(*) filter (where category = 'ghosting')
       , count(*) filter (where category = 'rude')
       , count(*) filter (where category = 'abuse')
       , count(*) filter (where category = 'spam')
  into ghosting_count, rude_count, abuse_count, spam_count
  from public.user_reports where reported_id = target_user;

  penalty := (ghosting_count * 0.7) + (rude_count * 0.4) + (abuse_count * 0.6) + (spam_count * 0.3);
  -- basic bounded score between 0 and 5
  avg_rating := LEAST(5, GREATEST(0, avg_rating - penalty));

  update public.profiles
    set reputation_score = coalesce(avg_rating, 0),
        rating_count = coalesce(total_count, 0),
        ghosting_strikes = coalesce(ghosting_count, 0)
  where id = target_user;
end;
$$ language plpgsql security definer set search_path = public;

create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.update_updated_at_column();

-- RLS for profiles
create policy if not exists "Profiles are viewable by everyone" on public.profiles for select using (true);
create policy if not exists "Users can insert their own profile" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy if not exists "Users can update their own profile" on public.profiles for update to authenticated using (auth.uid() = id);
create policy if not exists "Users can delete their own profile" on public.profiles for delete to authenticated using (auth.uid() = id);

-- 4) Posts (example real data)
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  content text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_posts_user_id on public.posts(user_id);
alter table public.posts enable row level security;
create trigger trg_posts_updated_at before update on public.posts for each row execute function public.update_updated_at_column();
create policy if not exists "Posts are public" on public.posts for select using (true);
create policy if not exists "Users manage their own posts" on public.posts for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 5) Ratings
create table if not exists public.ratings (
  id uuid primary key default gen_random_uuid(),
  rater_id uuid not null references auth.users(id) on delete cascade,
  ratee_id uuid not null references auth.users(id) on delete cascade,
  score int not null check (score between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique(rater_id, ratee_id),
  check (rater_id <> ratee_id)
);
create index if not exists idx_ratings_ratee on public.ratings(ratee_id);
alter table public.ratings enable row level security;
create policy if not exists "Authenticated can read ratings" on public.ratings for select to authenticated using (true);
create policy if not exists "Users create their own ratings" on public.ratings for insert to authenticated with check (auth.uid() = rater_id and rater_id <> ratee_id);
create policy if not exists "Users update their own ratings" on public.ratings for update to authenticated using (auth.uid() = rater_id);
create policy if not exists "Users delete their own ratings" on public.ratings for delete to authenticated using (auth.uid() = rater_id);

create or replace function public.after_ratings_changed()
returns trigger as $$
begin
  perform public.recalc_profile_reputation(new.ratee_id);
  return null;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.after_ratings_deleted()
returns trigger as $$
begin
  perform public.recalc_profile_reputation(old.ratee_id);
  return null;
end;
$$ language plpgsql security definer set search_path = public;

create trigger trg_ratings_ai after insert on public.ratings for each row execute function public.after_ratings_changed();
create trigger trg_ratings_au after update on public.ratings for each row execute function public.after_ratings_changed();
create trigger trg_ratings_ad after delete on public.ratings for each row execute function public.after_ratings_deleted();

-- 6) User reports
create table if not exists public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reported_id uuid not null references auth.users(id) on delete cascade,
  category public.report_category not null,
  notes text,
  created_at timestamptz not null default now(),
  unique(reporter_id, reported_id, category),
  check (reporter_id <> reported_id)
);
create index if not exists idx_reports_reported on public.user_reports(reported_id);
alter table public.user_reports enable row level security;
create policy if not exists "Admins can read all reports" on public.user_reports for select to authenticated using (public.has_role(auth.uid(),'admin'));
create policy if not exists "Users can view their submitted reports" on public.user_reports for select to authenticated using (auth.uid() = reporter_id);
create policy if not exists "Users can create reports" on public.user_reports for insert to authenticated with check (auth.uid() = reporter_id and reporter_id <> reported_id);
create policy if not exists "Users manage their own reports" on public.user_reports for update to authenticated using (auth.uid() = reporter_id);
create policy if not exists "Users can delete their own reports" on public.user_reports for delete to authenticated using (auth.uid() = reporter_id);

create or replace function public.after_reports_changed()
returns trigger as $$
begin
  perform public.recalc_profile_reputation(coalesce(new.reported_id, old.reported_id));
  return null;
end;
$$ language plpgsql security definer set search_path = public;

create trigger trg_reports_ai after insert on public.user_reports for each row execute function public.after_reports_changed();
create trigger trg_reports_au after update on public.user_reports for each row execute function public.after_reports_changed();
create trigger trg_reports_ad after delete on public.user_reports for each row execute function public.after_reports_changed();

-- 7) Verification requests
create table if not exists public.verification_requests (
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
create index if not exists idx_verif_user on public.verification_requests(user_id);
alter table public.verification_requests enable row level security;
create policy if not exists "Users can create their verification request" on public.verification_requests for insert to authenticated with check (auth.uid() = user_id);
create policy if not exists "Users can view their own verification" on public.verification_requests for select to authenticated using (auth.uid() = user_id);
create policy if not exists "Admins can view all verifications" on public.verification_requests for select to authenticated using (public.has_role(auth.uid(),'admin'));
create policy if not exists "Admins can update verifications" on public.verification_requests for update to authenticated using (public.has_role(auth.uid(),'admin'));

-- 8) Auto-create profile and default role on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)))
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'user')
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 9) Storage buckets and policies
insert into storage.buckets (id, name, public) values ('avatars','avatars', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('verifications','verifications', false) on conflict (id) do nothing;

-- Avatars policies
create policy if not exists "Public can read avatars" on storage.objects for select using (bucket_id = 'avatars');
create policy if not exists "Users can upload their own avatars" on storage.objects for insert to authenticated with check (
  bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]
);
create policy if not exists "Users can update their own avatars" on storage.objects for update to authenticated using (
  bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]
);

-- Verifications policies
create policy if not exists "Owner or admin can read verifications" on storage.objects for select to authenticated using (
  bucket_id = 'verifications' and (
    auth.uid()::text = (storage.foldername(name))[1] or public.has_role(auth.uid(),'admin')
  )
);
create policy if not exists "Users upload their own verifications" on storage.objects for insert to authenticated with check (
  bucket_id = 'verifications' and auth.uid()::text = (storage.foldername(name))[1]
);
create policy if not exists "Users update their own verifications" on storage.objects for update to authenticated using (
  bucket_id = 'verifications' and auth.uid()::text = (storage.foldername(name))[1]
);
create policy if not exists "Admins can delete verifications" on storage.objects for delete to authenticated using (
  bucket_id = 'verifications' and public.has_role(auth.uid(),'admin')
);

-- 10) Helpful indexes
create index if not exists idx_profiles_reputation on public.profiles(reputation_score desc, verified desc);
