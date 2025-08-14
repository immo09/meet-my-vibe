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

// Types
type AnswerOption = { text: string; traits: string[] };
interface Question {
  question: string;
  answers: AnswerOption[];
}

interface Person {
  name: string;
  age: number;
  distance: string;
  avatar: string;
  bio: string;
  traits: string[];
  interests: string[];
  compatibility: number;
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

const mockPeople: Person[] = [
  {
    name: "Sarah",
    age: 28,
    distance: "0.3 mi",
    avatar: "S",
    bio: "Digital nomad who loves coffee shops and weekend hikes",
    traits: ["adventurous", "outgoing", "creative", "coffee-lover"],
    interests: ["☕ Coffee", "🥾 Hiking", "📸 Photography", "✈️ Travel"],
    compatibility: 92,
  },
  {
    name: "Mike",
    age: 25,
    distance: "0.5 mi",
    avatar: "M",
    bio: "Local foodie and music enthusiast. Always up for concerts!",
    traits: ["foodie", "music-lover", "social", "energetic"],
    interests: ["🎵 Music", "🍕 Food", "🎸 Guitar", "🍺 Craft Beer"],
    compatibility: 88,
  },
  {
    name: "Emma",
    age: 30,
    distance: "0.7 mi",
    avatar: "E",
    bio: "Yoga instructor and nature lover. Let's explore the outdoors!",
    traits: ["nature-lover", "calm", "active", "mindful"],
    interests: ["🧘 Yoga", "🌿 Nature", "📚 Reading", "🥗 Healthy Food"],
    compatibility: 85,
  },
  {
    name: "David",
    age: 26,
    distance: "0.8 mi",
    avatar: "D",
    bio: "Tech guy who loves board games and trying new restaurants",
    traits: ["analytical", "thoughtful", "social", "curious"],
    interests: ["🎲 Board Games", "💻 Tech", "🍜 Food", "🧩 Puzzles"],
    compatibility: 83,
  },
  {
    name: "Lisa",
    age: 29,
    distance: "1.1 mi",
    avatar: "L",
    bio: "Artist and museum enthusiast. Let's check out galleries!",
    traits: ["creative", "cultural", "thoughtful", "artistic"],
    interests: ["🎨 Art", "🏛️ Museums", "📖 Books", "🎭 Theater"],
    compatibility: 79,
  },
  {
    name: "Jake",
    age: 24,
    distance: "1.2 mi",
    avatar: "J",
    bio: "Fitness enthusiast and adventure seeker. Always ready for action!",
    traits: ["active", "energetic", "adventurous", "determined"],
    interests: ["🏋️ Fitness", "🏃 Running", "🚴 Cycling", "⛰️ Climbing"],
    compatibility: 76,
  },
];

const Index = () => {
  type Step = "welcome" | "personality" | "main";
  const [step, setStep] = useState<Step>("welcome");
  const [currentQ, setCurrentQ] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [answers, setAnswers] = useState<AnswerOption[]>([]);
  const [traits, setTraits] = useState<Record<string, number>>({});

  const [hangoutOpen, setHangoutOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [hangoutMsg, setHangoutMsg] = useState("");
  const [hangoutCount, setHangoutCount] = useState(3);
const [profiles, setProfiles] = useState<any[]>([]);
const [loadingProfiles, setLoadingProfiles] = useState(false);

useEffect(() => {
  (async () => {
    setLoadingProfiles(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, bio, avatar_url, verified, reputation_score, rating_count')
      .order('verified', { ascending: false })
      .order('reputation_score', { ascending: false })
      .limit(20);
    if (!error) setProfiles(data ?? []);
    setLoadingProfiles(false);
  })();
}, []);

const totalQ = personalityQuestions.length;
const progress = Math.round(((currentQ + 1) / totalQ) * 100);
  const sortedPeople = useMemo(() => {
    return [...mockPeople].sort((a, b) => b.compatibility - a.compatibility);
  }, []);

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
      // compute traits
      const t: Record<string, number> = {};
      nextAnswers.forEach((a) => a.traits.forEach((tr) => (t[tr] = (t[tr] || 0) + 1)));
      setTraits(t);
      setStep("main");
    }
  };

  const openHangout = (person: Person) => {
    setSelectedPerson(person);
    setHangoutOpen(true);
  };

  const sendHangout = () => {
    // Increment count and close
    setHangoutCount((c) => c + 1);
    setHangoutOpen(false);
    setHangoutMsg("");
    // Use Sonner toast (Toaster is already mounted in App)
    import("sonner").then(({ toast }) => {
      toast.success("Hangout request sent!");
    });
  };

  const topTraits = useMemo(() =>
    Object.entries(traits)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([k]) => k),
  [traits]);

  const canonical = typeof window !== "undefined" ? window.location.href : "/";

  return (
    <>
      <Helmet>
        <title>Hangout — Find Your Perfect Match Nearby</title>
        <meta name="description" content="Find your perfect hangout match nearby with personality-based matching and interests." />
        <link rel="canonical" href={canonical} />
        <meta property="og:title" content="Hangout — Find Your Perfect Match" />
        <meta property="og:description" content="Discover compatible people nearby and plan fun hangouts." />
      </Helmet>

      {step === "welcome" && (
        <section className="min-h-screen bg-gradient-primary flex items-center justify-center p-6">
          <div className="text-center text-primary-foreground max-w-xl">
            <div className="mb-10">
              <h1 className="text-5xl font-bold mb-4">🎯 Hangout</h1>
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
                Question <span>{currentQ + 1}</span> of <span>{totalQ}</span>
              </p>
            </div>

            <Card className="shadow-sm">
              <CardContent className="p-6">
                <h3 className="text-xl font-semibold mb-6">
                  {personalityQuestions[currentQ].question}
                </h3>

                <RadioGroup value={selectedIndex?.toString() ?? ""} onValueChange={(val) => setSelectedIndex(parseInt(val))}>
                  <div className="space-y-3">
                    {personalityQuestions[currentQ].answers.map((a, idx) => (
                      <label key={idx} className="flex items-center gap-3 p-4 border rounded-xl cursor-pointer hover:bg-muted/50 transition-colors">
                        <RadioGroupItem value={idx.toString()} />
                        <span>{a.text}</span>
                      </label>
                    ))}
                  </div>
                </RadioGroup>

                <div className="text-center mt-6">
                  <Button size="lg" className="min-w-40" onClick={onNext} disabled={selectedIndex == null}>
                    Next
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      )}

      {step === "main" && (
        <div className="min-h-screen bg-background">
          <header className="bg-card shadow-sm border-b">
            <div className="max-w-4xl mx-auto px-4 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold">🎯 Hangout</h1>
                  <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-sm">
                    <MapPin className="h-4 w-4" /> San Francisco
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Link to="/nearby">
                    <Button variant="secondary">Nearby</Button>
                  </Link>
                  <Button variant="secondary" size="icon" onClick={() => setProfileOpen(true)} aria-label="Open profile">
                    <User className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </div>
          </header>

          <main className="max-w-4xl mx-auto p-4">
            <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <Card className="text-center">
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-primary">{mockPeople.length}</div>
                  <div className="text-sm text-muted-foreground">Nearby</div>
                </CardContent>
              </Card>
              <Card className="text-center">
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-primary">
                    {Math.round(sortedPeople.reduce((s, p) => s + p.compatibility, 0) / sortedPeople.length)}%
                  </div>
                  <div className="text-sm text-muted-foreground">Avg Match</div>
                </CardContent>
              </Card>
              <Card className="text-center">
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-primary">{hangoutCount}</div>
                  <div className="text-sm text-muted-foreground">Hangouts</div>
                </CardContent>
              </Card>
            </section>

            <section className="space-y-4">
              {profiles.length > 0 ? (
                profiles.map((p) => (
                  <Card key={p.id} className="card-hover">
                    <CardContent className="p-6">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
                        <div className="flex items-center gap-4">
                          {p.avatar_url ? (
                            <img src={p.avatar_url} alt={`${p.display_name || 'User'} avatar`} className="w-16 h-16 rounded-full object-cover" loading="lazy" />
                          ) : (
                            <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground grid place-items-center text-xl font-bold">
                              {(p.display_name || 'U').charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <h3 className="text-xl font-semibold inline-flex items-center gap-2">
                              {p.display_name || 'Anonymous'}
                              {p.verified && <Badge variant="secondary" className="rounded-full">Verified</Badge>}
                            </h3>
                            <p className="text-muted-foreground inline-flex items-center gap-1">
                              <MapPin className="h-4 w-4" /> Nearby
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-primary">{(p.reputation_score ?? 0).toFixed(1)}</div>
                          <div className="text-sm text-muted-foreground">reputation · {p.rating_count ?? 0} ratings</div>
                        </div>
                      </div>

                      {p.bio && <p className="text-muted-foreground mb-4">{p.bio}</p>}

                      <Button variant="hero" className="w-full">
                        👋 Say hi
                      </Button>
                    </CardContent>
                  </Card>
                ))
              ) : (
                sortedPeople.map((person) => (
                  <Card key={person.name} className="card-hover">
                    <CardContent className="p-6">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground grid place-items-center text-xl font-bold">
                            {person.avatar}
                          </div>
                          <div>
                            <h3 className="text-xl font-semibold">{person.name}, {person.age}</h3>
                            <p className="text-muted-foreground inline-flex items-center gap-1">
                              <MapPin className="h-4 w-4" /> {person.distance} away
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-primary">{Math.round(person.compatibility)}%</div>
                          <div className="text-sm text-muted-foreground">match</div>
                        </div>
                      </div>

                      <p className="text-muted-foreground mb-4">{person.bio}</p>

                      <div className="flex flex-wrap gap-2 mb-4">
                        {person.interests.map((interest, i) => (
                          <Badge key={i} variant="secondary" className="rounded-full">{interest}</Badge>
                        ))}
                      </div>

                      <Button variant="hero" className="w-full" onClick={() => openHangout(person)}>
                        💬 Ask to Hangout
                      </Button>
                    </CardContent>
                  </Card>
                ))
              )}
            </section>
          </main>
        </div>
      )}

      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Your Profile</DialogTitle>
            <DialogDescription>Overview of your personality and interests</DialogDescription>
          </DialogHeader>

          <div className="text-center">
            <div className="w-20 h-20 bg-primary rounded-full grid place-items-center text-primary-foreground text-2xl font-bold mx-auto mb-3">
              A
            </div>
            <h4 className="text-lg font-semibold">Alex (You)</h4>
            <p className="text-muted-foreground">Adventure seeker & coffee lover</p>
          </div>

          <div className="space-y-4 mt-4">
            <div>
              <h5 className="font-semibold mb-2">Personality Traits</h5>
              <div className="flex flex-wrap gap-2">
                {topTraits.length ? (
                  topTraits.map((t) => (
                    <Badge key={t} className="rounded-full" variant="outline">{t}</Badge>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Complete the personality test to see your traits.</p>
                )}
              </div>
            </div>
            <div>
              <h5 className="font-semibold mb-2">Interests</h5>
              <div className="flex flex-wrap gap-2">
                {[
                  "☕ Coffee",
                  "🏃 Running",
                  "🎵 Music",
                  "🍕 Food",
                ].map((i) => (
                  <Badge key={i} variant="secondary" className="rounded-full">{i}</Badge>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={hangoutOpen} onOpenChange={setHangoutOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Send Hangout Request</DialogTitle>
          </DialogHeader>

          {selectedPerson && (
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-primary rounded-full grid place-items-center text-primary-foreground font-bold">
                {selectedPerson.avatar}
              </div>
              <div>
                <h4 className="font-semibold">{selectedPerson.name}</h4>
                <p className="text-sm text-muted-foreground">{Math.round(selectedPerson.compatibility)}% match</p>
              </div>
            </div>
          )}

          <Textarea
            value={hangoutMsg}
            onChange={(e) => setHangoutMsg(e.target.value)}
            rows={4}
            placeholder="Hey! Want to grab coffee or explore the city together?"
          />

          <div className="flex gap-3 mt-4">
            <Button variant="secondary" className="flex-1" onClick={() => setHangoutOpen(false)}>Cancel</Button>
            <Button className="flex-1" onClick={sendHangout}>Send Request</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Index;
