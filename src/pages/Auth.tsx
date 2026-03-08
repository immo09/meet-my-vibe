import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useToast } from "@/components/ui/use-toast";

const Auth: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) navigate("/", { replace: true });
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/", { replace: true });
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const emailRedirectTo = `${window.location.origin}/`;

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo,
            data: { name: displayName }
          }
        });
        if (error) throw error;
        toast({ title: "Check your inbox", description: "Confirm your email to finish sign up." });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast({ title: "Welcome back" });
        navigate("/", { replace: true });
      }
    } catch (err: any) {
      toast({ title: "Authentication error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    try {
      const { error } = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (error) throw error;
    } catch (err: any) {
      toast({ title: "OAuth error", description: err.message, variant: "destructive" });
    }
  };

  const canonical = typeof window !== "undefined" ? window.location.href : "/auth";

  return (
    <main className="min-h-screen bg-background">
      <Helmet>
        <title>Login or Sign Up — Secure Account Access</title>
        <meta name="description" content="Sign in or create an account securely with email or Google, GitHub, Twitter." />
        <link rel="canonical" href={canonical} />
      </Helmet>
      <div className="max-w-md mx-auto p-6">
        <h1 className="text-3xl font-bold text-center mb-2">Account</h1>
        <p className="text-center text-muted-foreground mb-6">Access your account to find verified matches.</p>

        <Card>
          <CardContent className="p-6">
            <div className="grid grid-cols-3 gap-2 mb-4">
              <Button variant={mode === "login" ? "default" : "outline"} onClick={() => setMode("login")}>Login</Button>
              <Button variant={mode === "signup" ? "default" : "outline"} onClick={() => setMode("signup")}>Sign Up</Button>
              <Button variant="secondary" onClick={() => navigate("/", { replace: true })}>Home</Button>
            </div>

            <form onSubmit={handleEmailAuth} className="space-y-4">
              {mode === "signup" && (
                <div className="space-y-2">
                  <Label htmlFor="name">Display name</Label>
                  <Input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Alex" />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>{loading ? "Please wait..." : (mode === "signup" ? "Create account" : "Sign in")}</Button>
            </form>

            <div className="my-6"><Separator /></div>
            <div className="space-y-2">
              <Button className="w-full" variant="outline" onClick={signInWithGoogle}>Continue with Google</Button>
            </div>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground mt-4 text-center">Tip: Ensure Site URL and Redirect URLs are configured in Supabase Auth settings.</p>
      </div>
    </main>
  );
};

export default Auth;
