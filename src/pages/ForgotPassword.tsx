import React, { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, Mail } from "lucide-react";

const ForgotPassword: React.FC = () => {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
      toast({ title: "Email sent", description: "Check your inbox for a password reset link." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-subtle flex items-center justify-center p-6">
      <Helmet>
        <title>Forgot Password — Hangz</title>
        <meta name="description" content="Reset your Hangz account password." />
      </Helmet>
      <div className="w-full max-w-sm animate-fade-up">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold font-display text-gradient mb-2">Hangz</h1>
          <p className="text-muted-foreground text-sm">Reset your password</p>
        </div>

        <Card className="border-0 shadow-card rounded-2xl">
          <CardContent className="p-6">
            {sent ? (
              <div className="text-center space-y-4 py-4">
                <div className="w-14 h-14 rounded-full bg-accent grid place-items-center mx-auto">
                  <Mail className="h-6 w-6 text-accent-foreground" />
                </div>
                <p className="text-foreground font-medium">Check your email for a reset link.</p>
                <Link to="/auth" className="text-primary text-sm font-medium hover:underline">Back to login</Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <p className="text-sm text-muted-foreground text-center">
                  Enter your email and we'll send you a reset link.
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs">Email</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required className="rounded-xl" />
                </div>
                <Button type="submit" className="w-full rounded-xl" disabled={loading}>
                  {loading ? "Sending…" : "Send reset link"}
                </Button>
                <p className="text-center text-xs">
                  <Link to="/auth" className="text-primary hover:underline">Back to login</Link>
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

export default ForgotPassword;
