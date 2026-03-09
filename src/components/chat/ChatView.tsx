import React, { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface Message {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

interface Props {
  conversationId: string;
  userId: string;
}

const ChatView: React.FC<Props> = ({ conversationId, userId }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Fetch existing messages
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("messages")
        .select("id, sender_id, content, created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(200);
      if (data) setMessages(data);

      // Mark conversation as read
      await supabase
        .from("conversation_members")
        .update({ last_read_at: new Date().toISOString() })
        .eq("conversation_id", conversationId)
        .eq("user_id", userId);
    })();
  }, [conversationId, userId]);

  // Subscribe to realtime
  useEffect(() => {
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const msg = payload.new as Message;
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });

          // Mark as read when new message arrives (user is viewing conversation)
          supabase
            .from("conversation_members")
            .update({ last_read_at: new Date().toISOString() })
            .eq("conversation_id", conversationId)
            .eq("user_id", userId)
            .then();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, userId]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const text = newMsg.trim();
    if (!text) return;
    setSending(true);
    setNewMsg("");

    await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: userId,
      content: text,
    });

    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg) => {
          const mine = msg.sender_id === userId;
          return (
            <div key={msg.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[75%] rounded-2xl px-4 py-2",
                  mine
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "bg-muted text-foreground rounded-bl-md"
                )}
              >
                <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                <p className={cn("text-[10px] mt-1", mine ? "text-primary-foreground/60" : "text-muted-foreground")}>
                  {format(new Date(msg.created_at), "HH:mm")}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t p-3 flex gap-2">
        <Input
          value={newMsg}
          onChange={(e) => setNewMsg(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message…"
          className="flex-1"
        />
        <Button size="icon" onClick={handleSend} disabled={sending || !newMsg.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default ChatView;
