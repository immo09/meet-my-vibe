import React from "react";
import type { Conversation } from "@/pages/Chat";
import { formatDistanceToNow } from "date-fns";
import { Users, User } from "lucide-react";
import PresenceIndicator from "@/components/PresenceIndicator";

interface Props {
  conversations: Conversation[];
  loading: boolean;
  userId: string | null;
  onSelect: (id: string) => void;
}

const ConversationList: React.FC<Props> = ({ conversations, loading, userId, onSelect }) => {
  if (loading) {
    return (
      <div className="p-6 text-center text-muted-foreground">Loading conversations…</div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        No conversations yet. Tap + to start one!
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {conversations.map((c) => {
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
            className="w-full flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors border-b text-left"
          >
            <div className="relative w-12 h-12 shrink-0">
              <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground grid place-items-center">
                {c.type === "group" ? (
                  <Users className="h-5 w-5" />
                ) : avatar?.avatar_url ? (
                  <img src={avatar.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover" />
                ) : (
                  <span className="text-lg font-bold">{(avatar?.display_name || "A").charAt(0).toUpperCase()}</span>
                )}
              </div>
              {c.type === "direct" && otherMembers[0] && (
                <PresenceIndicator
                  userId={otherMembers[0].user_id}
                  size="sm"
                  className="absolute -bottom-0.5 -right-0.5"
                />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-baseline">
                <h3 className="font-semibold truncate">{title}</h3>
                {c.last_message && (
                  <span className="text-xs text-muted-foreground shrink-0 ml-2">
                    {formatDistanceToNow(new Date(c.last_message.created_at), { addSuffix: true })}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground truncate">
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
