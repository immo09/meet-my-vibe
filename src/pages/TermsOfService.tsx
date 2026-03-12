import React from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const TermsOfService: React.FC = () => {
  const canonical = typeof window !== "undefined" ? window.location.href : "/terms";

  return (
    <main className="min-h-screen bg-gradient-subtle">
      <Helmet>
        <title>Terms of Service — Hangz</title>
        <meta name="description" content="Terms of service for Hangz - rules and guidelines for using our platform." />
        <link rel="canonical" href={canonical} />
        <meta name="robots" content="index, follow" />
      </Helmet>

      <div className="max-w-3xl mx-auto p-6">
        <header className="mb-8">
          <h1 className="text-4xl font-bold font-display mb-4">Terms of Service</h1>
          <p className="text-muted-foreground">Last updated: March 2026</p>
        </header>

        <div className="space-y-4">
          <Card className="border-0 shadow-card rounded-2xl">
            <CardHeader><CardTitle className="font-display">Acceptance of Terms</CardTitle></CardHeader>
            <CardContent>
              <p className="text-muted-foreground">By using Hangz, you agree to be bound by these Terms of Service. 
              If you do not agree to these terms, please do not use our service.</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-card rounded-2xl">
            <CardHeader><CardTitle className="font-display">User Conduct</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p>You agree to use our service responsibly and not to:</p>
              <ul className="list-disc ml-6 space-y-2 text-muted-foreground">
                <li>Harass, abuse, or harm other users</li>
                <li>Share inappropriate or offensive content</li>
                <li>Create fake accounts or misrepresent yourself</li>
                <li>Use the service for commercial purposes without permission</li>
                <li>Violate any applicable laws or regulations</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-card rounded-2xl">
            <CardHeader><CardTitle className="font-display">Privacy and Safety</CardTitle></CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Your safety is our priority. We provide tools to report inappropriate behavior 
              and block users. Location sharing is entirely optional and can be disabled at any time.</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-card rounded-2xl">
            <CardHeader><CardTitle className="font-display">Account Termination</CardTitle></CardHeader>
            <CardContent>
              <p className="text-muted-foreground">We reserve the right to terminate accounts that violate these terms. 
              Users may also delete their accounts at any time through the app settings.</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-card rounded-2xl">
            <CardHeader><CardTitle className="font-display">Contact</CardTitle></CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Questions about these terms? Contact us at support@hangz.app</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
};

export default TermsOfService;
