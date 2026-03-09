import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Listens for new messages across all conversations and shows
 * in-app toast notifications when the user is NOT viewing that conversation.
 */
const InAppNotificationListener = () => {
  const location = useLocation();
  const activeConvoRef = useRef<string | null>(null);

  // Track which conversation is currently active
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    activeConvoRef.current = location.pathname === "/chat" ? params.get("c") : null;
  }, [location]);

  useEffect(() => {
    let userId: string | null = null;

    const setup = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      userId = user.id;

      // Get all conversation IDs the user is part of
      const { data: memberships } = await supabase
        .from("conversation_members")
        .select("conversation_id")
        .eq("user_id", user.id);

      if (!memberships || memberships.length === 0) return;

      const channel = supabase
        .channel("global-messages")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
          },
          (payload) => {
            const msg = payload.new as {
              id: string;
              sender_id: string;
              conversation_id: string;
              content: string;
            };

            // Don't notify for own messages
            if (msg.sender_id === userId) return;

            // Don't notify if currently viewing this conversation
            if (msg.conversation_id === activeConvoRef.current) return;

            // Check if this is a conversation we're part of
            const isMember = memberships.some(
              (m) => m.conversation_id === msg.conversation_id
            );
            if (!isMember) return;

            toast(msg.content?.substring(0, 80) || "New message", {
              description: "Tap to view",
              action: {
                label: "Open",
                onClick: () => {
                  window.location.href = `/chat?c=${msg.conversation_id}`;
                },
              },
              duration: 5000,
            });
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    const cleanup = setup();
    return () => {
      cleanup.then((fn) => fn?.());
    };
  }, []);

  return null;
};

export default InAppNotificationListener;
