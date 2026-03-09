-- Add last_read_at column to conversation_members to track read status
ALTER TABLE public.conversation_members
ADD COLUMN last_read_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Add index for better query performance
CREATE INDEX idx_conversation_members_last_read ON public.conversation_members(conversation_id, user_id, last_read_at);