-- Enable realtime for conversation_members table to track read status changes
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_members;