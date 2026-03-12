import React from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const PrivacyPolicy: React.FC = () => {
  const canonical = typeof window !== "undefined" ? window.location.href : "/privacy";

  return (
    <main className="min-h-screen bg-gradient-subtle">
      <Helmet>
        <title>Privacy Policy — Hangz</title>
        <meta name="description" content="Privacy policy for Hangz - how we collect, use, and protect your data." />
        <link rel="canonical" href={canonical} />
        <meta name="robots" content="index, follow" />
      </Helmet>

      <div className="max-w-3xl mx-auto p-6">
        <header className="mb-8">
          <h1 className="text-4xl font-bold font-display mb-4">Privacy Policy</h1>
          <p className="text-muted-foreground">Last updated: March 2026</p>
        </header>

        <div className="space-y-4">
          <Card className="border-0 shadow-card rounded-2xl">
            <CardHeader><CardTitle className="font-display">Information We Collect</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p>We collect information you provide directly to us, such as:</p>
              <ul className="list-disc ml-6 space-y-2 text-muted-foreground">
                <li>Account information (email, display name, avatar)</li>
                <li>Location data (when you choose to share it)</li>
                <li>Profile information and preferences</li>
                <li>Messages and interactions with other users</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-card rounded-2xl">
            <CardHeader><CardTitle className="font-display">How We Use Your Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p>We use the information we collect to:</p>
              <ul className="list-disc ml-6 space-y-2 text-muted-foreground">
                <li>Provide and improve our services</li>
                <li>Help you find and connect with nearby people</li>
                <li>Send you updates and notifications</li>
                <li>Ensure safety and security on our platform</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-card rounded-2xl">
            <CardHeader><CardTitle className="font-display">Data Protection</CardTitle></CardHeader>
            <CardContent>
              <p className="text-muted-foreground">We implement appropriate security measures to protect your personal information. 
              Your location data is only shared when you explicitly choose to enable location sharing, 
              and you can disable it at any time.</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-card rounded-2xl">
            <CardHeader><CardTitle className="font-display">Contact Us</CardTitle></CardHeader>
            <CardContent>
              <p className="text-muted-foreground">If you have any questions about this Privacy Policy, please contact us at privacy@hangz.app</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
};

export default PrivacyPolicy;
