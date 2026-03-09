
-- Add reply_to_id to messages (self-referential, nullable)
ALTER TABLE public.messages
ADD COLUMN reply_to_id UUID REFERENCES public.messages(id) ON DELETE SET NULL;
