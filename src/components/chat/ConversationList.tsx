import React from "react";
import type { Conversation } from "@/pages/Chat";
import { formatDistanceToNow } from "date-fns";
import { Users, MessageCircle } from "lucide-react";
import PresenceIndicator from "@/components/PresenceIndicator";
import { cn } from "@/lib/utils";

interface Props {
  conversations: Conversation[];
  loading: boolean;
  userId: string | null;
  onSelect: (id: string) => void;
}

const ConversationList: React.FC<Props> = ({ conversations, loading, userId, onSelect }) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-accent grid place-items-center mb-4">
          <MessageCircle className="h-7 w-7 text-accent-foreground" />
        </div>
        <h3 className="font-semibold font-display text-lg mb-1">No conversations yet</h3>
        <p className="text-muted-foreground text-sm">Tap + to start chatting with someone!</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {conversations.map((c, i) => {
        const otherMembers = c.members.filter((m) => m.user_id !== userId);
        const title =
          c.type === "group"
            ? c.name || "Group Chat"
            : otherMembers.map((m) => m.display_name || "Anonymous").join(", ");
        const avatar = otherMembers[0];

        return (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3.5 hover:bg-accent/50 transition-all border-b border-border/50 text-left animate-fade-up"
            )}
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <div className="relative w-12 h-12 shrink-0">
              {c.type === "group" ? (
                <div className="w-12 h-12 rounded-2xl bg-gradient-primary text-primary-foreground grid place-items-center">
                  <Users className="h-5 w-5" />
                </div>
              ) : avatar?.avatar_url ? (
                <img src={avatar.avatar_url} alt="" className="w-12 h-12 rounded-2xl object-cover" />
              ) : (
                <div className="w-12 h-12 rounded-2xl bg-gradient-primary text-primary-foreground grid place-items-center">
                  <span className="text-lg font-bold">{(avatar?.display_name || "A").charAt(0).toUpperCase()}</span>
                </div>
              )}
              {c.type === "direct" && otherMembers[0] && (
                <PresenceIndicator
                  userId={otherMembers[0].user_id}
                  size="sm"
                  className="absolute -bottom-0.5 -right-0.5"
                  lastSeenAt={otherMembers[0].last_seen_at}
                />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-baseline">
                <h3 className="font-semibold font-display text-sm truncate">{title}</h3>
                {c.last_message && (
                  <span className="text-[11px] text-muted-foreground shrink-0 ml-2">
                    {formatDistanceToNow(new Date(c.last_message.created_at), { addSuffix: true })}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground truncate mt-0.5">
                {c.last_message?.content || "No messages yet"}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default ConversationList;
