import React, { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { formatDistance, haversineDistanceKm } from "@/lib/geo";
import LocationShare from "@/components/location/LocationShare";
import RateUserDialog from "@/components/RateUserDialog";
import { useStartDm } from "@/hooks/use-start-dm";
import AppNavigation from "@/components/AppNavigation";
import PresenceIndicator from "@/components/PresenceIndicator";
import { MapPin, Star, Users } from "lucide-react";

interface NearbyProfile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  verified: boolean;
  reputation_score: number;
  rating_count: number;
  distance_km: number | null;
  bio: string | null;
  status_message: string | null;
  ghosting_strikes: number;
  last_seen_at: string | null;
  username: string | null;
}

const Nearby: React.FC = () => {
  const [me, setMe] = useState<{ id: string } | null>(null);
  const [currentPos, setCurrentPos] = useState<GeolocationPosition | null>(null);
  const [profiles, setProfiles] = useState<NearbyProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [rateTarget, setRateTarget] = useState<{ id: string; name: string } | null>(null);
  const { startDm, starting } = useStartDm();

  useEffect(() => {
    (async () => {
      const [{ data: { user } }, permission] = await Promise.all([
        supabase.auth.getUser(),
        (async () => {
          try {
            if (navigator?.permissions?.query) return await navigator.permissions.query({ name: "geolocation" as any });
          } catch {}
          return null as any;
        })(),
      ]);
      if (user) setMe({ id: user.id });

      if (permission?.state === "granted" || permission?.state === "prompt") {
        if ("geolocation" in navigator) {
          navigator.geolocation.getCurrentPosition(
            (pos) => setCurrentPos(pos),
            () => setCurrentPos(null),
            { enableHighAccuracy: true, timeout: 10000 }
          );
        }
      }
    })();
  }, []);

  // Fetch nearby profiles using secure RPC (hides exact coordinates)
  const fetchNearby = async (lat?: number, lng?: number) => {
    setLoading(true);
    if (lat != null && lng != null) {
      const { data, error } = await supabase.rpc("get_nearby_profiles", {
        _lat: lat,
        _lng: lng,
        _radius_km: 50,
      });
      if (!error) setProfiles((data as any) ?? []);
    } else {
      setProfiles([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (currentPos) {
      fetchNearby(currentPos.coords.latitude, currentPos.coords.longitude);
    }
  }, [currentPos]);

  // Profiles are already sorted by distance and exclude current user from the RPC
  const sorted = profiles;

  const canonical = typeof window !== "undefined" ? window.location.href : "/nearby";

  return (
    <main className="min-h-screen bg-gradient-subtle flex flex-col">
      <Helmet>
        <title>Nearby People — Hangz</title>
        <meta name="description" content="Share your location to discover nearby people and spark hangouts." />
        <link rel="canonical" href={canonical} />
      </Helmet>

      {/* Header */}
      <header className="glass border-b sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold font-display text-gradient">Nearby</h1>
            <p className="text-xs text-muted-foreground">Discover people around you</p>
          </div>
          <div className="flex items-center gap-1.5 bg-accent rounded-full px-3 py-1">
            <Users className="h-3.5 w-3.5 text-accent-foreground" />
            <span className="text-xs font-medium text-accent-foreground">{sorted.length} nearby</span>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto w-full p-4 pb-24 space-y-4">
        <LocationShare />

        <section className="space-y-3" aria-busy={loading}>
          {loading && (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
            </div>
          )}

          {sorted.map((p, i) => (
            <Card
              key={p.id}
              className="card-hover border-0 rounded-2xl animate-fade-up"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      {p.avatar_url ? (
                        <img
                          src={p.avatar_url}
                          alt={`${p.display_name || "User"} avatar`}
                          className="w-14 h-14 rounded-2xl object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-2xl bg-gradient-primary text-primary-foreground grid place-items-center text-lg font-bold">
                          {(p.display_name || "U").charAt(0).toUpperCase()}
                        </div>
                      )}
                      <PresenceIndicator userId={p.id} size="sm" className="absolute -bottom-0.5 -right-0.5" />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold font-display inline-flex items-center gap-2">
                        {p.display_name || "Anonymous"}
                        {p.verified && (
                          <Badge className="rounded-full bg-accent text-accent-foreground text-[10px] border-0">
                            ✓ Verified
                          </Badge>
                        )}
                      </h2>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Star className="h-3.5 w-3.5 text-primary fill-primary" />
                          {(p.reputation_score ?? 0).toFixed(1)}
                        </span>
                        <span>·</span>
                        <span>{p.rating_count ?? 0} ratings</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="inline-flex items-center gap-1 bg-accent rounded-full px-2.5 py-1">
                      <MapPin className="h-3 w-3 text-accent-foreground" />
                      <span className="text-xs font-medium text-accent-foreground">
                        {p.distance_km == null ? "—" : formatDistance(p.distance_km)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="hero" className="flex-1 rounded-xl" onClick={() => startDm(p.id)} disabled={starting === p.id}>
                    {starting === p.id ? "Opening…" : "👋 Say hi"}
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 rounded-xl"
                    onClick={() => setRateTarget({ id: p.id, name: p.display_name || "Anonymous" })}
                  >
                    ⭐ Rate
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {!loading && sorted.length === 0 && (
            <Card className="border-0 shadow-card rounded-2xl">
              <CardContent className="p-10 text-center">
                <div className="w-16 h-16 rounded-full bg-accent grid place-items-center mx-auto mb-4">
                  <MapPin className="h-7 w-7 text-accent-foreground" />
                </div>
                <h3 className="font-semibold font-display text-lg mb-2">No one nearby yet</h3>
                <p className="text-muted-foreground text-sm">Enable location sharing above to discover people around you.</p>
              </CardContent>
            </Card>
          )}
        </section>
      </div>

      <AppNavigation />

      <RateUserDialog
        open={!!rateTarget}
        onOpenChange={(open) => { if (!open) setRateTarget(null); }}
        rateeId={rateTarget?.id ?? ""}
        rateeName={rateTarget?.name ?? ""}
        onRated={() => {
          (async () => {
            const { data } = await supabase
              .from("profiles")
              .select("id, display_name, avatar_url, verified, reputation_score, rating_count, lat, lng")
              .not("lat", "is", null)
              .not("lng", "is", null)
              .limit(100);
            if (data) setProfiles(data as any);
          })();
        }}
      />
    </main>
  );
};

export default Nearby;
