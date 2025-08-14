import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface GeolocationState {
  loading: boolean;
  error: string | null;
  position: GeolocationPosition | null;
  sharing: boolean;
}

export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({
    loading: false,
    error: null,
    position: null,
    sharing: false,
  });

  const refreshSharingStatus = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("lat,lng")
      .eq("id", user.id)
      .single();
    const d = data as any;
    setState((s) => ({ ...s, sharing: !!(d?.lat && d?.lng) }));
  }, []);

  useEffect(() => {
    refreshSharingStatus();
  }, [refreshSharingStatus]);

  const requestShare = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!("geolocation" in navigator)) return reject(new Error("Geolocation not supported"));
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        });
      }).then(async (pos) => {
        setState((s) => ({ ...s, position: pos }));
        const { latitude, longitude } = pos.coords;
        await supabase
          .from("profiles")
          .update({
            lat: latitude,
            lng: longitude,
            last_seen_at: new Date().toISOString(),
          } as any)
          .eq("id", user.id);
        setState((s) => ({ ...s, sharing: true }));
      });
    } catch (err: any) {
      setState((s) => ({ ...s, error: err.message ?? "Location error" }));
    } finally {
      setState((s) => ({ ...s, loading: false }));
    }
  }, []);

  const stopShare = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      await supabase
        .from("profiles")
        .update({ lat: null, lng: null } as any)
        .eq("id", user.id);
      setState((s) => ({ ...s, sharing: false }));
    } catch (err: any) {
      setState((s) => ({ ...s, error: err.message ?? "Error updating location" }));
    } finally {
      setState((s) => ({ ...s, loading: false }));
    }
  }, []);

  return { ...state, requestShare, stopShare };
}
