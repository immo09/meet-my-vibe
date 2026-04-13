-- 1. Make chat-attachments bucket private
UPDATE storage.buckets SET public = false WHERE id = 'chat-attachments';

-- 2. Drop old permissive upload policy
DROP POLICY IF EXISTS "Authenticated users can upload chat attachments" ON storage.objects;

-- 3. New upload policy: only conversation members can upload
CREATE POLICY "Members can upload chat attachments" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chat-attachments'
    AND public.is_conversation_member(auth.uid(), (storage.foldername(name))[1]::uuid)
  );

-- 4. SELECT policy: only conversation members can download
DROP POLICY IF EXISTS "Chat attachments are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view chat attachments" ON storage.objects;
CREATE POLICY "Members can view chat attachments" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'chat-attachments'
    AND public.is_conversation_member(auth.uid(), (storage.foldername(name))[1]::uuid)
  );

-- 5. Harden profiles UPDATE policy with WITH CHECK
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND verified = (SELECT verified FROM profiles WHERE id = auth.uid())
    AND reputation_score = (SELECT reputation_score FROM profiles WHERE id = auth.uid())
    AND rating_count = (SELECT rating_count FROM profiles WHERE id = auth.uid())
    AND ghosting_strikes = (SELECT ghosting_strikes FROM profiles WHERE id = auth.uid())
  );