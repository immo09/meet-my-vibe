import React, { useMemo, useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { MapPin, User } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import RateUserDialog from "@/components/RateUserDialog";
import { useStartDm } from "@/hooks/use-start-dm";
import AppNavigation from "@/components/AppNavigation";
import PresenceIndicator from "@/components/PresenceIndicator";

type AnswerOption = { text: string; traits: string[] };
interface Question {
  question: string;
  answers: AnswerOption[];
}

const personalityQuestions: Question[] = [
  {
    question: "How do you prefer to spend your free time?",
    answers: [
      { text: "Exploring new places and trying adventures", traits: ["adventurous", "outgoing"] },
      { text: "Reading a book or watching movies at home", traits: ["introverted", "calm"] },
      { text: "Hanging out with friends at social events", traits: ["social", "energetic"] },
      { text: "Working on creative projects or hobbies", traits: ["creative", "focused"] },
    ],
  },
  {
    question: "When meeting new people, you usually:",
    answers: [
      { text: "Strike up conversations easily", traits: ["outgoing", "confident"] },
      { text: "Wait for them to approach you first", traits: ["reserved", "thoughtful"] },
      { text: "Look for common interests to bond over", traits: ["analytical", "friendly"] },
      { text: "Prefer group settings over one-on-one", traits: ["social", "comfortable"] },
    ],
  },
  {
    question: "Your ideal hangout would be:",
    answers: [
      { text: "Trying a new restaurant or café", traits: ["foodie", "explorer"] },
      { text: "Going to a concert or festival", traits: ["music-lover", "energetic"] },
      { text: "Walking in nature or hiking", traits: ["nature-lover", "active"] },
      { text: "Visiting museums or art galleries", traits: ["cultural", "thoughtful"] },
    ],
  },
  {
    question: "How do you handle spontaneous plans?",
    answers: [
      { text: "Love them! The more spontaneous the better", traits: ["spontaneous", "flexible"] },
      { text: "Enjoy them occasionally", traits: ["adaptable", "balanced"] },
      { text: "Prefer some advance notice", traits: ["organized", "planned"] },
      { text: "Like to plan everything in advance", traits: ["structured", "careful"] },
    ],
  },
  {
    question: "What motivates you most?",
    answers: [
      { text: "Learning new things and gaining experiences", traits: ["curious", "growth-minded"] },
      { text: "Building meaningful relationships", traits: ["empathetic", "caring"] },
      { text: "Achieving personal goals", traits: ["ambitious", "determined"] },
      { text: "Helping others and making a difference", traits: ["altruistic", "compassionate"] },
    ],
  },
  {
    question: "In a group conversation, you tend to:",
    answers: [
      { text: "Lead the discussion", traits: ["leader", "confident"] },
      { text: "Listen and contribute when you have something valuable to add", traits: ["thoughtful", "wise"] },
      { text: "Ask questions to keep others talking", traits: ["curious", "supportive"] },
      { text: "Share stories and make people laugh", traits: ["funny", "entertaining"] },
    ],
  },
  {
    question: "How do you recharge after a long day?",
    answers: [
      { text: "Spending time alone with your thoughts", traits: ["introspective", "independent"] },
      { text: "Calling friends or family", traits: ["social", "connected"] },
      { text: "Doing something physical or active", traits: ["active", "energetic"] },
      { text: "Engaging in a hobby or creative activity", traits: ["creative", "passionate"] },
    ],
  },
  {
    question: "What's your approach to trying new things?",
    answers: [
      { text: "Always eager to try something new", traits: ["adventurous", "open-minded"] },
      { text: "Research it first, then give it a shot", traits: ["cautious", "informed"] },
      { text: "Only if friends recommend it", traits: ["trusted", "social"] },
      { text: "Prefer sticking to what you know", traits: ["traditional", "consistent"] },
    ],
  },
  {
    question: "How would friends describe your energy level?",
    answers: [
      { text: "High energy and always on the go", traits: ["energetic", "dynamic"] },
      { text: "Balanced - energetic when needed, calm when not", traits: ["balanced", "adaptable"] },
      { text: "Calm and steady", traits: ["calm", "reliable"] },
      { text: "Varies depending on the situation", traits: ["flexible", "situational"] },
    ],
  },
  {
    question: "What matters most to you in a hangout?",
    answers: [
      { text: "Having deep, meaningful conversations", traits: ["deep", "intellectual"] },
      { text: "Laughing and having fun", traits: ["fun", "lighthearted"] },
      { text: "Sharing new experiences together", traits: ["experiential", "bonding"] },
      { text: "Just enjoying each other's company", traits: ["easygoing", "present"] },
    ],
  },
];

const QUIZ_DONE_KEY = "mmv_quiz_done";

const Index = () => {
  const quizDone = localStorage.getItem(QUIZ_DONE_KEY) === "1";
  type Step = "welcome" | "personality" | "main";
  const [step, setStep] = useState<Step>(quizDone ? "main" : "welcome");
  const [currentQ, setCurrentQ] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [answers, setAnswers] = useState<AnswerOption[]>([]);
  const [traits, setTraits] = useState<Record<string, number>>({});

  const [profileOpen, setProfileOpen] = useState(false);
  const [rateTarget, setRateTarget] = useState<{ id: string; name: string } | null>(null);
  const { startDm, starting } = useStartDm();
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [myProfile, setMyProfile] = useState<any>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const [profilesRes, myRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, display_name, bio, avatar_url, verified, reputation_score, rating_count")
          .neq("id", user.id)
          .order("verified", { ascending: false })
          .order("reputation_score", { ascending: false })
          .limit(20),
        supabase
          .from("profiles")
          .select("display_name, avatar_url, bio, status_message")
          .eq("id", user.id)
          .single(),
      ]);

      setLoadingProfiles(false);
      if (!profilesRes.error) setProfiles(profilesRes.data ?? []);
      if (!myRes.error && myRes.data) setMyProfile(myRes.data);
    })();
  }, []);

  const totalQ = personalityQuestions.length;
  const progress = Math.round(((currentQ + 1) / totalQ) * 100);

  const startTest = () => setStep("personality");

  const onNext = () => {
    if (selectedIndex == null) return;
    const question = personalityQuestions[currentQ];
    const answer = question.answers[selectedIndex];
    const nextAnswers = [...answers, answer];
    setAnswers(nextAnswers);

    if (currentQ + 1 < totalQ) {
      setCurrentQ((q) => q + 1);
      setSelectedIndex(null);
    } else {
      const t: Record<string, number> = {};
      nextAnswers.forEach((a) => a.traits.forEach((tr) => (t[tr] = (t[tr] || 0) + 1)));
      setTraits(t);
      localStorage.setItem(QUIZ_DONE_KEY, "1");
      setStep("main");
    }
  };

  const topTraits = useMemo(
    () =>
      Object.entries(traits)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([k]) => k),
    [traits]
  );

  const canonical = typeof window !== "undefined" ? window.location.href : "/";

  return (
    <>
      <Helmet>
        <title>Meet My Vibe — Find Your Perfect Match Nearby</title>
        <meta name="description" content="Find your perfect hangout match nearby with personality-based matching and interests." />
        <link rel="canonical" href={canonical} />
        <meta property="og:title" content="Meet My Vibe — Find Your Perfect Match" />
        <meta property="og:description" content="Discover compatible people nearby and plan fun hangouts." />
      </Helmet>

      {step === "welcome" && (
        <section className="min-h-screen bg-gradient-primary flex items-center justify-center p-6">
          <div className="text-center text-primary-foreground max-w-xl">
            <div className="mb-10">
              <h1 className="text-5xl font-bold mb-4">🎯 Meet My Vibe</h1>
              <p className="text-lg/7 opacity-90">Find your perfect match nearby and hang out!</p>
            </div>
            <Button size="lg" variant="hero" onClick={startTest}>
              Get Started
            </Button>
          </div>
        </section>
      )}

      {step === "personality" && (
        <main className="min-h-screen bg-background">
          <div className="max-w-2xl mx-auto p-6">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold mb-2">Personality Profile</h2>
              <p className="text-muted-foreground">Help us find your perfect hangout matches</p>
              <div className="mt-4 bg-muted rounded-full h-2">
                <div
                  className="bg-gradient-primary h-2 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Question {currentQ + 1} of {totalQ}
              </p>
            </div>

            <Card className="shadow-sm">
              <CardContent className="p-6">
                <h3 className="text-xl font-semibold mb-6">
                  {personalityQuestions[currentQ].question}
                </h3>

                <RadioGroup
                  value={selectedIndex?.toString() ?? ""}
                  onValueChange={(val) => setSelectedIndex(parseInt(val))}
                >
                  <div className="space-y-3">
                    {personalityQuestions[currentQ].answers.map((a, idx) => (
                      <label
                        key={idx}
                        className="flex items-center gap-3 p-4 border rounded-xl cursor-pointer hover:bg-muted/50 transition-colors"
                      >
                        <RadioGroupItem value={idx.toString()} />
                        <span>{a.text}</span>
                      </label>
                    ))}
                  </div>
                </RadioGroup>

                <div className="text-center mt-6">
                  <Button size="lg" className="min-w-40" onClick={onNext} disabled={selectedIndex == null}>
                    {currentQ + 1 === totalQ ? "Finish" : "Next"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      )}

      {step === "main" && (
        <div className="min-h-screen bg-background flex flex-col">
          <header className="bg-card shadow-sm border-b">
            <div className="max-w-4xl mx-auto px-4 py-4">
              <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">🎯 Meet My Vibe</h1>
                <Button variant="secondary" size="icon" onClick={() => setProfileOpen(true)} aria-label="Open profile">
                  <User className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </header>

          <main className="flex-1 max-w-4xl mx-auto p-4 w-full">
            <section className="space-y-4">
              {loadingProfiles && (
                <p className="text-center text-muted-foreground py-8">Loading people…</p>
              )}

              {!loadingProfiles && profiles.length === 0 && (
                <Card>
                  <CardContent className="p-8 text-center">
                    <p className="text-muted-foreground">No people nearby yet. Share your location on the <Link to="/nearby" className="text-primary underline">Nearby</Link> page to be discovered!</p>
                  </CardContent>
                </Card>
              )}

              {profiles.map((p) => (
                <Card key={p.id} className="card-hover">
                  <CardContent className="p-6">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          {p.avatar_url ? (
                            <img
                              src={p.avatar_url}
                              alt={`${p.display_name || "User"} avatar`}
                              className="w-16 h-16 rounded-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground grid place-items-center text-xl font-bold">
                              {(p.display_name || "U").charAt(0).toUpperCase()}
                            </div>
                          )}
                          <PresenceIndicator userId={p.id} size="sm" className="absolute -bottom-0.5 -right-0.5" />
                        </div>
                        <div>
                          <h3 className="text-xl font-semibold inline-flex items-center gap-2">
                            {p.display_name || "Anonymous"}
                            {p.verified && (
                              <Badge variant="secondary" className="rounded-full">
                                Verified
                              </Badge>
                            )}
                          </h3>
                          <p className="text-muted-foreground inline-flex items-center gap-1">
                            <MapPin className="h-4 w-4" /> Nearby
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-primary">
                          {(p.reputation_score ?? 0).toFixed(1)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          reputation · {p.rating_count ?? 0} ratings
                        </div>
                      </div>
                    </div>

                    {p.bio && <p className="text-muted-foreground mb-4">{p.bio}</p>}

                    <div className="flex gap-2">
                      <Button variant="hero" className="flex-1" onClick={() => startDm(p.id)} disabled={starting === p.id}>
                        {starting === p.id ? "Opening…" : "👋 Say hi"}
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => setRateTarget({ id: p.id, name: p.display_name || "Anonymous" })}
                      >
                        ⭐ Rate
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </section>

            <footer className="mt-12 pt-8 border-t border-border text-center">
              <div className="flex justify-center gap-6 text-sm text-muted-foreground">
                <Link to="/privacy" className="hover:text-foreground transition-colors">
                  Privacy Policy
                </Link>
                <Link to="/terms" className="hover:text-foreground transition-colors">
                  Terms of Service
                </Link>
              </div>
            </footer>
          </main>

          <AppNavigation />
        </div>
      )}

      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Your Profile</DialogTitle>
            <DialogDescription>Overview of your personality and interests</DialogDescription>
          </DialogHeader>

          <div className="text-center">
            {myProfile?.avatar_url ? (
              <img
                src={myProfile.avatar_url}
                alt="Your avatar"
                className="w-20 h-20 rounded-full object-cover mx-auto mb-3"
              />
            ) : (
              <div className="w-20 h-20 bg-primary rounded-full grid place-items-center text-primary-foreground text-2xl font-bold mx-auto mb-3">
                {(myProfile?.display_name || "U").charAt(0).toUpperCase()}
              </div>
            )}
            <h4 className="text-lg font-semibold">{myProfile?.display_name || "Anonymous"}</h4>
            {myProfile?.bio && <p className="text-muted-foreground">{myProfile.bio}</p>}
            {myProfile?.status_message && (
              <Badge variant="outline" className="mt-2">{myProfile.status_message}</Badge>
            )}
          </div>

          <div className="space-y-4 mt-4">
            <div>
              <h5 className="font-semibold mb-2">Personality Traits</h5>
              <div className="flex flex-wrap gap-2">
                {topTraits.length ? (
                  topTraits.map((t) => (
                    <Badge key={t} className="rounded-full" variant="outline">
                      {t}
                    </Badge>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Complete the personality test to see your traits.</p>
                )}
              </div>
            </div>
            <Link to="/profile">
              <Button variant="outline" className="w-full mt-2">Edit Profile</Button>
            </Link>
          </div>
        </DialogContent>
      </Dialog>

      <RateUserDialog
        open={!!rateTarget}
        onOpenChange={(open) => {
          if (!open) setRateTarget(null);
        }}
        rateeId={rateTarget?.id ?? ""}
        rateeName={rateTarget?.name ?? ""}
        onRated={() => {
          (async () => {
            const { data } = await supabase
              .from("profiles")
              .select("id, display_name, bio, avatar_url, verified, reputation_score, rating_count")
              .neq("id", userId ?? "")
              .order("verified", { ascending: false })
              .order("reputation_score", { ascending: false })
              .limit(20);
            if (data) setProfiles(data);
          })();
        }}
      />
    </>
  );
};

export default Index;
