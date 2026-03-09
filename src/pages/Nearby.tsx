import React, { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { formatDistance, haversineDistanceKm } from "@/lib/geo";
import LocationShare from "@/components/location/LocationShare";
import RateUserDialog from "@/components/RateUserDialog";
import { useStartDm } from "@/hooks/use-start-dm";
import AppNavigation from "@/components/AppNavigation";

interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  verified: boolean;
  reputation_score: number;
  rating_count: number;
  lat: number | null;
  lng: number | null;
}

const Nearby: React.FC = () => {
  const [me, setMe] = useState<{ id: string } | null>(null);
  const [currentPos, setCurrentPos] = useState<GeolocationPosition | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [rateTarget, setRateTarget] = useState<{ id: string; name: string } | null>(null);
  const { startDm, starting } = useStartDm();

  useEffect(() => {
    (async () => {
      const [{ data: { user } }, permission] = await Promise.all([
        supabase.auth.getUser(),
        (async () => {
          try {
            // @ts-ignore
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

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url, verified, reputation_score, rating_count, lat, lng")
        .not("lat", "is", null)
        .not("lng", "is", null)
        .limit(100);
      if (!error) setProfiles((data as any) ?? []);
      setLoading(false);
    })();
  }, []);

  const enriched = useMemo(() => {
    if (!currentPos) return profiles.map((p) => ({ ...p, distanceKm: null as number | null }));
    const { latitude, longitude } = currentPos.coords;
    return profiles.map((p) => ({
      ...p,
      distanceKm: p.lat && p.lng ? haversineDistanceKm(latitude, longitude, p.lat, p.lng) : null,
    }));
  }, [profiles, currentPos]);

  const sorted = useMemo(() => {
    return [...enriched]
      .filter((p) => (me ? p.id !== me.id : true))
      .sort((a, b) => {
        if (a.distanceKm == null) return 1;
        if (b.distanceKm == null) return -1;
        return a.distanceKm - b.distanceKm;
      });
  }, [enriched, me]);

  const canonical = typeof window !== "undefined" ? window.location.href : "/nearby";

  return (
    <main className="min-h-screen bg-background">
      <Helmet>
        <title>Nearby People — Find People Near You</title>
        <meta name="description" content="Share your location to discover nearby people and spark hangouts." />
        <link rel="canonical" href={canonical} />
      </Helmet>

      <div className="max-w-3xl mx-auto p-6">
        <header className="mb-4">
          <h1 className="text-3xl font-bold">Nearby People</h1>
          <p className="text-muted-foreground">Enable location to see who’s around you.</p>
        </header>

        <LocationShare />

        <div className="my-6"><Separator /></div>

        <section className="space-y-4" aria-busy={loading}>
          {sorted.map((p) => (
            <Card key={p.id} className="card-hover">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex items-center gap-4">
                    {p.avatar_url ? (
                      <img
                        src={p.avatar_url}
                        alt={`${p.display_name || 'User'} avatar`}
                        className="w-14 h-14 rounded-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-primary text-primary-foreground grid place-items-center text-lg font-bold">
                        {(p.display_name || 'U').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <h2 className="text-lg font-semibold inline-flex items-center gap-2">
                        {p.display_name || 'Anonymous'}
                        {p.verified && <Badge variant="secondary" className="rounded-full">Verified</Badge>}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {p.reputation_score?.toFixed(1)} reputation · {p.rating_count ?? 0} ratings
                      </p>
                    </div>
                  </div>
                  <div className="text-right min-w-20">
                    <div className="text-sm text-muted-foreground">Distance</div>
                    <div className="font-medium">{p.distanceKm == null ? '—' : formatDistance(p.distanceKm)}</div>
                  </div>
                </div>
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

          {!loading && sorted.length === 0 && (
            <p className="text-sm text-muted-foreground">No nearby people yet. Try enabling location sharing.</p>
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
          // Refresh profiles to show updated reputation
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
