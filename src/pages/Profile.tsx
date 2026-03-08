import React, { useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Camera, Loader2, ArrowLeft } from "lucide-react";

const Profile: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth", { replace: true }); return; }
      setUserId(user.id);

      const { data } = await supabase
        .from("profiles")
        .select("display_name, username, bio, avatar_url")
        .eq("id", user.id)
        .single();

      if (data) {
        setDisplayName(data.display_name ?? "");
        setUsername(data.username ?? "");
        setBio(data.bio ?? "");
        setAvatarUrl(data.avatar_url);
      }
      setLoading(false);
    })();
  }, [navigate]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please select an image file.", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 5 MB allowed.", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const filePath = `${userId}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      // Append cache-buster so the browser fetches the new image
      const freshUrl = `${publicUrl}?t=${Date.now()}`;
      setAvatarUrl(freshUrl);

      await supabase
        .from("profiles")
        .update({ avatar_url: freshUrl })
        .eq("id", userId);

      toast({ title: "Avatar updated" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: displayName || null,
          username: username || null,
          bio: bio || null,
        })
        .eq("id", userId);
      if (error) throw error;
      toast({ title: "Profile saved" });
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <Helmet>
        <title>Edit Profile</title>
        <meta name="description" content="Edit your profile, upload an avatar, and update your bio." />
      </Helmet>

      <div className="max-w-lg mx-auto p-6">
        <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>

        <h1 className="text-3xl font-bold mb-6">Edit Profile</h1>

        <Card>
          <CardContent className="p-6 space-y-6">
            {/* Avatar */}
            <div className="flex flex-col items-center gap-3">
              <button
                type="button"
                className="relative group rounded-full overflow-hidden w-24 h-24 bg-muted border-2 border-border focus:outline-none focus:ring-2 focus:ring-ring"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full grid place-items-center text-3xl font-bold text-muted-foreground">
                    {(displayName || "U").charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="absolute inset-0 bg-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity grid place-items-center">
                  {uploading ? (
                    <Loader2 className="h-6 w-6 animate-spin text-background" />
                  ) : (
                    <Camera className="h-6 w-6 text-background" />
                  )}
                </div>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
              <p className="text-sm text-muted-foreground">Click to upload photo</p>
            </div>

            {/* Fields */}
            <div className="space-y-2">
              <Label htmlFor="displayName">Display name</Label>
              <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Alex" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="alex123" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell people about yourself…" rows={3} />
            </div>

            <Button className="w-full" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save profile"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

export default Profile;
