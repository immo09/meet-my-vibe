import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export const useStartDm = () => {
  const navigate = useNavigate();
  const [starting, setStarting] = useState<string | null>(null); // target user id

  const startDm = useCallback(async (targetUserId: string) => {
    setStarting(targetUserId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check for existing direct conversation
      const { data: myMemberships } = await supabase
        .from("conversation_members")
        .select("conversation_id")
        .eq("user_id", user.id);

      if (myMemberships && myMemberships.length > 0) {
        const convoIds = myMemberships.map((m) => m.conversation_id);
        const { data: theirMemberships } = await supabase
          .from("conversation_members")
          .select("conversation_id")
          .eq("user_id", targetUserId)
          .in("conversation_id", convoIds);

        if (theirMemberships && theirMemberships.length > 0) {
          const { data: directConvos } = await supabase
            .from("conversations")
            .select("id")
            .in("id", theirMemberships.map((m) => m.conversation_id))
            .eq("type", "direct");

          if (directConvos && directConvos.length > 0) {
            navigate(`/chat?c=${directConvos[0].id}`);
            return;
          }
        }
      }

      // Create new DM
      const { data: convo, error } = await supabase
        .from("conversations")
        .insert({ type: "direct" as const, created_by: user.id })
        .select("id")
        .single();

      if (error || !convo) throw error;

      await supabase
        .from("conversation_members")
        .insert([
          { conversation_id: convo.id, user_id: user.id },
          { conversation_id: convo.id, user_id: targetUserId },
        ]);

      navigate(`/chat?c=${convo.id}`);
    } catch (err) {
      console.error("Failed to start DM:", err);
    } finally {
      setStarting(null);
    }
  }, [navigate]);

  return { startDm, starting };
};
