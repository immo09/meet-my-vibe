import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { SmilePlus } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const EMOJI_OPTIONS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

interface Reaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
}

interface Props {
  messageId: string;
  userId: string;
  mine: boolean;
}

const MessageReactions: React.FC<Props> = ({ messageId, userId, mine }) => {
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Fetch reactions for this message
  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("message_reactions")
        .select("id, message_id, user_id, emoji")
        .eq("message_id", messageId);
      if (data) setReactions(data);
    };
    fetch();
  }, [messageId]);

  // Realtime updates for this message's reactions
  useEffect(() => {
    const channel = supabase
      .channel(`reactions:${messageId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "message_reactions",
          filter: `message_id=eq.${messageId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const r = payload.new as Reaction;
            setReactions((prev) => {
              if (prev.some((x) => x.id === r.id)) return prev;
              return [...prev, r];
            });
          } else if (payload.eventType === "DELETE") {
            const old = payload.old as { id: string };
            setReactions((prev) => prev.filter((x) => x.id !== old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [messageId]);

  const toggleReaction = useCallback(
    async (emoji: string) => {
      const existing = reactions.find(
        (r) => r.emoji === emoji && r.user_id === userId
      );

      if (existing) {
        // Remove
        await supabase
          .from("message_reactions")
          .delete()
          .eq("id", existing.id);
        setReactions((prev) => prev.filter((r) => r.id !== existing.id));
      } else {
        // Add
        const { data } = await supabase
          .from("message_reactions")
          .insert({ message_id: messageId, user_id: userId, emoji })
          .select("id, message_id, user_id, emoji")
          .single();
        if (data) {
          setReactions((prev) => {
            if (prev.some((x) => x.id === data.id)) return prev;
            return [...prev, data];
          });
        }
      }
      setPickerOpen(false);
    },
    [messageId, userId, reactions]
  );

  // Group reactions by emoji
  const grouped = reactions.reduce<
    Record<string, { count: number; userReacted: boolean }>
  >((acc, r) => {
    if (!acc[r.emoji]) acc[r.emoji] = { count: 0, userReacted: false };
    acc[r.emoji].count++;
    if (r.user_id === userId) acc[r.emoji].userReacted = true;
    return acc;
  }, {});

  return (
    <div className={cn("flex items-center gap-1 mt-0.5 flex-wrap", mine ? "justify-end" : "justify-start")}>
      {/* Existing reactions as chips */}
      {Object.entries(grouped).map(([emoji, { count, userReacted }]) => (
        <button
          key={emoji}
          onClick={() => toggleReaction(emoji)}
          className={cn(
            "inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full border transition-colors",
            userReacted
              ? "bg-primary/15 border-primary/30 text-foreground"
              : "bg-muted/50 border-border/50 text-muted-foreground hover:bg-muted"
          )}
        >
          <span>{emoji}</span>
          <span className="text-[10px] font-medium">{count}</span>
        </button>
      ))}

      {/* Add reaction button */}
      <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
        <PopoverTrigger asChild>
          <button
            className="inline-flex items-center justify-center w-6 h-6 rounded-full text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/50 transition-colors opacity-0 group-hover:opacity-100"
            aria-label="Add reaction"
          >
            <SmilePlus className="h-3.5 w-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto p-1.5 flex gap-1"
          side={mine ? "left" : "right"}
          align="start"
        >
          {EMOJI_OPTIONS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => toggleReaction(emoji)}
              className="text-lg hover:scale-125 transition-transform p-1 rounded hover:bg-muted"
            >
              {emoji}
            </button>
          ))}
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default MessageReactions;
