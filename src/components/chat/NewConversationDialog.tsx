import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";

interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
  onCreated: (conversationId: string) => void;
}

const NewConversationDialog: React.FC<Props> = ({ open, onOpenChange, userId, onCreated }) => {
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [groupName, setGroupName] = useState("");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!open || !userId) return;
    setSelected([]);
    setGroupName("");
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .neq("id", userId)
        .limit(50);
      setProfiles(data ?? []);
      setLoading(false);
    })();
  }, [open, userId]);

  const toggleUser = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleCreate = async () => {
    if (!userId || selected.length === 0) return;
    setCreating(true);

    try {
      const isGroup = selected.length > 1;
      const type = isGroup ? "group" : "direct";

      // For direct messages, check if conversation already exists
      if (!isGroup) {
        const { data: existingMembers } = await supabase
          .from("conversation_members")
          .select("conversation_id")
          .eq("user_id", userId);

        if (existingMembers && existingMembers.length > 0) {
          const convoIds = existingMembers.map((m) => m.conversation_id);
          const { data: otherMembers } = await supabase
            .from("conversation_members")
            .select("conversation_id")
            .eq("user_id", selected[0])
            .in("conversation_id", convoIds);

          if (otherMembers && otherMembers.length > 0) {
            // Check if any of these are direct conversations
            const { data: directConvos } = await supabase
              .from("conversations")
              .select("id")
              .in("id", otherMembers.map((m) => m.conversation_id))
              .eq("type", "direct");

            if (directConvos && directConvos.length > 0) {
              onCreated(directConvos[0].id);
              setCreating(false);
              return;
            }
          }
        }
      }

      // Create conversation
      const { data: convo, error } = await supabase
        .from("conversations")
        .insert({
          type,
          name: isGroup ? groupName.trim() || null : null,
          created_by: userId,
        })
        .select("id")
        .single();

      if (error || !convo) throw error || new Error("Failed to create conversation");

      // Add members (creator + selected)
      const members = [userId, ...selected].map((uid) => ({
        conversation_id: convo.id,
        user_id: uid,
      }));

      const { error: memberError } = await supabase
        .from("conversation_members")
        .insert(members);

      if (memberError) throw memberError;

      onCreated(convo.id);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>New Conversation</DialogTitle>
          <DialogDescription>Select people to chat with</DialogDescription>
        </DialogHeader>

        {selected.length > 1 && (
          <Input
            placeholder="Group name (optional)"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
          />
        )}

        <div className="max-h-64 overflow-y-auto space-y-1">
          {loading ? (
            <div className="flex justify-center p-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : profiles.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No users found</p>
          ) : (
            profiles.map((p) => (
              <label
                key={p.id}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
              >
                <Checkbox
                  checked={selected.includes(p.id)}
                  onCheckedChange={() => toggleUser(p.id)}
                />
                {p.avatar_url ? (
                  <img src={p.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground grid place-items-center text-sm font-bold">
                    {(p.display_name || "A").charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="font-medium">{p.display_name || "Anonymous"}</span>
              </label>
            ))
          )}
        </div>

        <Button onClick={handleCreate} disabled={creating || selected.length === 0}>
          {creating ? "Creating…" : selected.length > 1 ? "Create Group" : "Start Chat"}
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default NewConversationDialog;
