import React, { useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Camera, Loader2, ArrowLeft, Shield, Star, AlertTriangle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import AppNavigation from "@/components/AppNavigation";

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
  const [statusMessage, setStatusMessage] = useState("");
  const [verified, setVerified] = useState(false);
  const [reputationScore, setReputationScore] = useState(0);
  const [ratingCount, setRatingCount] = useState(0);
  const [ghostingStrikes, setGhostingStrikes] = useState(0);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth", { replace: true }); return; }
      setUserId(user.id);

      const { data } = await supabase
        .from("profiles")
        .select("display_name, username, bio, avatar_url, status_message, verified, reputation_score, rating_count, ghosting_strikes")
        .eq("id", user.id)
        .single();

      if (data) {
        setDisplayName(data.display_name ?? "");
        setUsername(data.username ?? "");
        setBio(data.bio ?? "");
        setAvatarUrl(data.avatar_url);
        setStatusMessage(data.status_message ?? "");
        setVerified(data.verified);
        setReputationScore(data.reputation_score);
        setRatingCount(data.rating_count);
        setGhostingStrikes(data.ghosting_strikes);
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
          status_message: statusMessage || null,
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
      <main className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-subtle flex flex-col">
      <Helmet>
        <title>Edit Profile — Hangz</title>
        <meta name="description" content="Edit your profile, upload an avatar, and update your bio." />
      </Helmet>

      {/* Hero header */}
      <div className="bg-gradient-primary pt-12 pb-20 px-4 relative">
        <Button variant="ghost" size="sm" className="absolute top-4 left-4 text-primary-foreground hover:bg-primary-foreground/10" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <h1 className="text-2xl font-bold font-display text-primary-foreground text-center">Your Profile</h1>
      </div>

      <div className="max-w-lg mx-auto w-full px-4 -mt-14 pb-24 space-y-4">
        {/* Avatar card */}
        <Card className="border-0 shadow-card rounded-2xl overflow-visible">
          <CardContent className="p-6 flex flex-col items-center -mt-10">
            <button
              type="button"
              className="relative group rounded-2xl overflow-hidden w-24 h-24 bg-muted border-4 border-card shadow-elegant focus:outline-none focus:ring-2 focus:ring-ring"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-primary grid place-items-center text-3xl font-bold text-primary-foreground">
                  {(displayName || "U").charAt(0).toUpperCase()}
                </div>
              )}
              <div className="absolute inset-0 bg-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity grid place-items-center">
                {uploading ? (
                  <Loader2 className="h-6 w-6 animate-spin text-primary-foreground" />
                ) : (
                  <Camera className="h-6 w-6 text-primary-foreground" />
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
            <p className="text-xs text-muted-foreground mt-2">Tap to change photo</p>

            {/* Stats row */}
            <div className="flex items-center gap-6 mt-4 pt-4 border-t border-border w-full justify-center">
              <div className="text-center">
                <div className="flex items-center gap-1 justify-center text-primary">
                  <Star className="h-4 w-4 fill-current" />
                  <span className="text-lg font-bold font-display">{reputationScore.toFixed(1)}</span>
                </div>
                <p className="text-xs text-muted-foreground">{ratingCount} ratings</p>
              </div>
              <div className="w-px h-8 bg-border" />
              <div className="text-center">
                {verified ? (
                  <Badge className="rounded-full bg-accent text-accent-foreground border-0 gap-1">
                    <Shield className="h-3 w-3" /> Verified
                  </Badge>
                ) : (
                  <Badge variant="outline" className="rounded-full gap-1 text-muted-foreground">
                    Not verified
                  </Badge>
                )}
              </div>
              {ghostingStrikes > 0 && (
                <>
                  <div className="w-px h-8 bg-border" />
                  <div className="text-center">
                    <div className="flex items-center gap-1 justify-center text-destructive">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      <span className="text-sm font-semibold">{ghostingStrikes}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">strikes</p>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Form card */}
        <Card className="border-0 shadow-card rounded-2xl">
          <CardContent className="p-6 space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="displayName" className="text-xs font-medium">Display name</Label>
              <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Alex" className="rounded-xl" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="username" className="text-xs font-medium">Username</Label>
              <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="alex123" className="rounded-xl" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="status" className="text-xs font-medium">Status</Label>
              <Select value={statusMessage} onValueChange={setStatusMessage}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Set your status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Available">🟢 Available</SelectItem>
                  <SelectItem value="Away">🟡 Away</SelectItem>
                  <SelectItem value="Busy">🔴 Busy</SelectItem>
                  <SelectItem value="Do Not Disturb">⛔ Do Not Disturb</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bio" className="text-xs font-medium">Bio</Label>
              <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell people about yourself…" rows={3} className="rounded-xl" />
            </div>

            <Button className="w-full rounded-xl" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save profile"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <AppNavigation />
    </main>
  );
};

export default Profile;
