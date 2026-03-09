import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import ConversationList from "@/components/chat/ConversationList";
import ChatView from "@/components/chat/ChatView";
import NewConversationDialog from "@/components/chat/NewConversationDialog";
import AppNavigation from "@/components/AppNavigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus } from "lucide-react";
import PresenceIndicator from "@/components/PresenceIndicator";

export interface Conversation {
  id: string;
  type: "direct" | "group";
  name: string | null;
  created_by: string;
  created_at: string;
  members: { user_id: string; display_name: string | null; avatar_url: string | null }[];
  last_message?: { content: string; created_at: string } | null;
}

const Chat: React.FC = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeConvoId, setActiveConvoId] = useState<string | null>(searchParams.get("c"));
  const [loading, setLoading] = useState(true);
  const [newDialogOpen, setNewDialogOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, []);

  const fetchConversations = async () => {
    if (!userId) return;
    setLoading(true);

    // Get conversations the user is a member of
    const { data: memberRows } = await supabase
      .from("conversation_members")
      .select("conversation_id")
      .eq("user_id", userId);

    if (!memberRows || memberRows.length === 0) {
      setConversations([]);
      setLoading(false);
      return;
    }

    const convoIds = memberRows.map((r) => r.conversation_id);

    const { data: convos } = await supabase
      .from("conversations")
      .select("*")
      .in("id", convoIds)
      .order("created_at", { ascending: false });

    if (!convos) {
      setConversations([]);
      setLoading(false);
      return;
    }

    // Fetch members + profiles for each conversation
    const { data: allMembers } = await supabase
      .from("conversation_members")
      .select("conversation_id, user_id")
      .in("conversation_id", convoIds);

    const memberUserIds = [...new Set((allMembers ?? []).map((m) => m.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url")
      .in("id", memberUserIds);

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

    // Fetch last message per conversation
    const enriched: Conversation[] = [];
    for (const c of convos) {
      const members = (allMembers ?? [])
        .filter((m) => m.conversation_id === c.id)
        .map((m) => {
          const p = profileMap.get(m.user_id);
          return { user_id: m.user_id, display_name: p?.display_name ?? null, avatar_url: p?.avatar_url ?? null };
        });

      const { data: lastMsg } = await supabase
        .from("messages")
        .select("content, created_at")
        .eq("conversation_id", c.id)
        .order("created_at", { ascending: false })
        .limit(1);

      enriched.push({
        ...c,
        type: c.type as "direct" | "group",
        members,
        last_message: lastMsg?.[0] ?? null,
      });
    }

    setConversations(enriched);
    setLoading(false);
  };

  useEffect(() => {
    if (userId) fetchConversations();
  }, [userId]);

  const activeConvo = conversations.find((c) => c.id === activeConvoId) ?? null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Helmet>
        <title>Messages — Chat with Nearby People</title>
        <meta name="description" content="Chat with people you've met nearby." />
      </Helmet>

      <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full">
        {!activeConvoId ? (
          <>
            <header className="p-4 flex items-center justify-between border-b">
              <h1 className="text-2xl font-bold">Messages</h1>
              <Button size="icon" variant="outline" onClick={() => setNewDialogOpen(true)}>
                <Plus className="h-5 w-5" />
              </Button>
            </header>
            <ConversationList
              conversations={conversations}
              loading={loading}
              userId={userId}
              onSelect={(id) => setActiveConvoId(id)}
            />
          </>
        ) : (
          <>
            <header className="p-4 flex items-center gap-3 border-b">
              <Button size="icon" variant="ghost" onClick={() => setActiveConvoId(null)}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold truncate">
                  {activeConvo?.type === "group"
                    ? activeConvo.name || "Group Chat"
                    : activeConvo?.members
                        .filter((m) => m.user_id !== userId)
                        .map((m) => m.display_name || "Anonymous")
                        .join(", ") || "Chat"}
                </h2>
                {activeConvo?.type === "direct" && (() => {
                  const other = activeConvo.members.find((m) => m.user_id !== userId);
                  return other ? <PresenceIndicator userId={other.user_id} size="sm" lastSeenAt={other.last_seen_at} showLastSeen /> : null;
                })()}
              </div>
            </header>
            <ChatView conversationId={activeConvoId} userId={userId!} />
          </>
        )}
      </div>

      <AppNavigation />

      <NewConversationDialog
        open={newDialogOpen}
        onOpenChange={setNewDialogOpen}
        userId={userId}
        onCreated={(convoId) => {
          setNewDialogOpen(false);
          fetchConversations().then(() => setActiveConvoId(convoId));
        }}
      />
    </div>
  );
};

export default Chat;
