-- Allow members to update their own last_read_at
CREATE POLICY "Members can update own last_read_at"
ON public.conversation_members
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);