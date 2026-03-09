
-- Create chat-attachments storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-attachments', 'chat-attachments', true);

-- Allow conversation members to upload files
CREATE POLICY "Authenticated users can upload chat attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'chat-attachments');

-- Allow anyone to view chat attachments (public bucket)
CREATE POLICY "Anyone can view chat attachments"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'chat-attachments');

-- Add attachment columns to messages table
ALTER TABLE public.messages
ADD COLUMN attachment_url TEXT DEFAULT NULL,
ADD COLUMN attachment_type TEXT DEFAULT NULL;
