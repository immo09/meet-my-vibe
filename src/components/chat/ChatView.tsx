import React, { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Paperclip, X, FileText, Check, CheckCheck } from "lucide-react";
import MessageReactions from "@/components/chat/MessageReactions";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";
import { sendPushNotification } from "@/hooks/use-push-notifications";

interface Message {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  attachment_url: string | null;
  attachment_type: string | null;
}

interface Props {
  conversationId: string;
  userId: string;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const isImageType = (type: string | null) =>
  type?.startsWith("image/") ?? false;

const ChatView: React.FC<Props> = ({ conversationId, userId }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [othersTyping, setOthersTyping] = useState<Set<string>>(new Set());
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [membersLastRead, setMembersLastRead] = useState<Record<string, string>>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Generate preview for pending file
  useEffect(() => {
    if (!pendingFile) {
      setPreviewUrl(null);
      return;
    }
    if (pendingFile.type.startsWith("image/")) {
      const url = URL.createObjectURL(pendingFile);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreviewUrl(null);
  }, [pendingFile]);

  // Fetch existing messages
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("messages")
        .select("id, sender_id, content, created_at, attachment_url, attachment_type")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(200);
      if (data) setMessages(data);

      await supabase
        .from("conversation_members")
        .update({ last_read_at: new Date().toISOString() })
        .eq("conversation_id", conversationId)
        .eq("user_id", userId);
    })();
  }, [conversationId, userId]);

  // Subscribe to realtime messages
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

          setOthersTyping((prev) => {
            const next = new Set(prev);
            next.delete(msg.sender_id);
            return next;
          });

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

  // Fetch members' last_read_at for read receipts
  useEffect(() => {
    const fetchMembers = async () => {
      const { data } = await supabase
        .from("conversation_members")
        .select("user_id, last_read_at")
        .eq("conversation_id", conversationId)
        .neq("user_id", userId);
      if (data) {
        const map: Record<string, string> = {};
        data.forEach((m) => {
          if (m.last_read_at) map[m.user_id] = m.last_read_at;
        });
        setMembersLastRead(map);
      }
    };
    fetchMembers();

    // Subscribe to conversation_members changes for read receipt updates
    const channel = supabase
      .channel(`read-receipts:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversation_members",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const updated = payload.new as { user_id: string; last_read_at: string | null };
          if (updated.user_id === userId) return;
          if (updated.last_read_at) {
            setMembersLastRead((prev) => ({
              ...prev,
              [updated.user_id]: updated.last_read_at!,
            }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, userId]);

  // Typing indicator channel
  useEffect(() => {
    const channel = supabase
      .channel(`typing:${conversationId}`)
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (payload.user_id === userId) return;
        setOthersTyping((prev) => new Set(prev).add(payload.user_id));
        setTimeout(() => {
          setOthersTyping((prev) => {
            const next = new Set(prev);
            next.delete(payload.user_id);
            return next;
          });
        }, 3000);
      })
      .subscribe();

    typingChannelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      typingChannelRef.current = null;
    };
  }, [conversationId, userId]);

  const broadcastTyping = useCallback(() => {
    typingChannelRef.current?.send({
      type: "broadcast",
      event: "typing",
      payload: { user_id: userId },
    });
  }, [userId]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, othersTyping]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMsg(e.target.value);
    broadcastTyping();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      toast.error("File is too large. Maximum size is 10 MB.");
      return;
    }
    setPendingFile(file);
    // Reset input so same file can be re-selected
    e.target.value = "";
  };

  const uploadFile = async (file: File): Promise<{ url: string; type: string } | null> => {
    const ext = file.name.split(".").pop() || "bin";
    const path = `${conversationId}/${crypto.randomUUID()}.${ext}`;

    const { error } = await supabase.storage
      .from("chat-attachments")
      .upload(path, file, { contentType: file.type });

    if (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload file");
      return null;
    }

    const { data: publicUrlData } = supabase.storage
      .from("chat-attachments")
      .getPublicUrl(path);

    return { url: publicUrlData.publicUrl, type: file.type };
  };

  const handleSend = async () => {
    const text = newMsg.trim();
    if (!text && !pendingFile) return;
    setSending(true);
    setNewMsg("");

    let attachmentUrl: string | null = null;
    let attachmentType: string | null = null;

    if (pendingFile) {
      const result = await uploadFile(pendingFile);
      if (result) {
        attachmentUrl = result.url;
        attachmentType = result.type;
      }
      setPendingFile(null);
    }

    await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: userId,
      content: text || (attachmentUrl ? "" : ""),
      attachment_url: attachmentUrl,
      attachment_type: attachmentType,
    });

    // Trigger push notification (non-blocking)
    sendPushNotification(conversationId, userId, "New message", text || "Sent an attachment");

    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const renderAttachment = (msg: Message) => {
    if (!msg.attachment_url) return null;

    if (isImageType(msg.attachment_type)) {
      return (
        <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer" className="block mt-1">
          <img
            src={msg.attachment_url}
            alt="Shared image"
            className="max-w-full rounded-lg max-h-60 object-cover"
            loading="lazy"
          />
        </a>
      );
    }

    // Generic file
    const fileName = msg.attachment_url.split("/").pop() || "File";
    return (
      <a
        href={msg.attachment_url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 mt-1 p-2 rounded-lg bg-background/20 hover:bg-background/30 transition-colors"
      >
        <FileText className="h-4 w-4 shrink-0" />
        <span className="text-xs truncate underline">{decodeURIComponent(fileName)}</span>
      </a>
    );
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, idx) => {
          const mine = msg.sender_id === userId;
          // Read receipt: check if any other member has read past this message
          const isRead = mine && Object.values(membersLastRead).some(
            (lastRead) => new Date(lastRead) >= new Date(msg.created_at)
          );
          // Only show read receipt on the last consecutive own message that's been read
          const nextMsg = messages[idx + 1];
          const showReadReceipt = mine && isRead && (!nextMsg || nextMsg.sender_id !== userId || !Object.values(membersLastRead).some(
            (lastRead) => new Date(lastRead) >= new Date(nextMsg.created_at)
          ));

          return (
            <div key={msg.id} className={cn("group flex flex-col", mine ? "items-end" : "items-start")}>
              <div
                className={cn(
                  "max-w-[75%] rounded-2xl px-4 py-2",
                  mine
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "bg-muted text-foreground rounded-bl-md"
                )}
              >
                {msg.content && (
                  <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                )}
                {renderAttachment(msg)}
                <div className={cn("flex items-center gap-1 mt-1", mine ? "justify-end" : "")}>
                  <span className={cn("text-[10px]", mine ? "text-primary-foreground/60" : "text-muted-foreground")}>
                    {format(new Date(msg.created_at), "HH:mm")}
                  </span>
                  {mine && (
                    isRead
                      ? <CheckCheck className="h-3 w-3 text-primary-foreground/80" />
                      : <Check className="h-3 w-3 text-primary-foreground/40" />
                  )}
                </div>
              </div>
              {showReadReceipt && (
                <span className="text-[10px] text-muted-foreground mt-0.5 mr-1">Read</span>
              )}
              <MessageReactions messageId={msg.id} userId={userId} mine={mine} />
            </div>
          );
        })}

        {/* Typing indicator */}
        {othersTyping.size > 0 && (
          <div className="flex justify-start">
            <div className="bg-muted text-muted-foreground rounded-2xl rounded-bl-md px-4 py-2 flex items-center gap-1">
              <span className="flex gap-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:300ms]" />
              </span>
              <span className="text-xs ml-1">typing…</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Pending file preview */}
      {pendingFile && (
        <div className="border-t px-3 pt-2 flex items-center gap-2">
          {previewUrl ? (
            <img src={previewUrl} alt="Preview" className="h-16 w-16 rounded-lg object-cover" />
          ) : (
            <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center">
              <FileText className="h-6 w-6 text-muted-foreground" />
            </div>
          )}
          <span className="text-sm truncate flex-1 text-muted-foreground">{pendingFile.name}</span>
          <Button size="icon" variant="ghost" onClick={() => setPendingFile(null)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Input */}
      <div className="border-t p-3 flex gap-2">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/*,.pdf,.doc,.docx,.txt,.zip"
          onChange={handleFileSelect}
        />
        <Button
          size="icon"
          variant="ghost"
          onClick={() => fileInputRef.current?.click()}
          disabled={sending}
          className="shrink-0"
        >
          <Paperclip className="h-4 w-4" />
        </Button>
        <Input
          value={newMsg}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Type a message…"
          className="flex-1"
        />
        <Button
          size="icon"
          onClick={handleSend}
          disabled={sending || (!newMsg.trim() && !pendingFile)}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default ChatView;
