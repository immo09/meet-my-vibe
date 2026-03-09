import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useUnreadCount = (userId: string | null) => {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!userId) {
      setUnreadCount(0);
      return;
    }

    const fetchUnreadCount = async () => {
      // Get all conversations the user is a member of
      const { data: memberRows } = await supabase
        .from("conversation_members")
        .select("conversation_id, last_read_at")
        .eq("user_id", userId);

      if (!memberRows || memberRows.length === 0) {
        setUnreadCount(0);
        return;
      }

      let totalUnread = 0;

      // For each conversation, count messages after last_read_at
      for (const member of memberRows) {
        const { count } = await supabase
          .from("messages")
          .select("*", { count: "exact", head: true })
          .eq("conversation_id", member.conversation_id)
          .neq("sender_id", userId) // Don't count own messages
          .gt("created_at", member.last_read_at || "1970-01-01");

        totalUnread += count || 0;
      }

      setUnreadCount(totalUnread);
    };

    fetchUnreadCount();

    // Subscribe to new messages
    const channel = supabase
      .channel("unread-messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        () => {
          fetchUnreadCount();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversation_members",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          fetchUnreadCount();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [userId]);

  return unreadCount;
};
