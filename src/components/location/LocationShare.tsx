import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, MapPin, Navigation } from "lucide-react";
import { useGeolocation } from "@/hooks/use-geolocation";

const LocationShare: React.FC = () => {
  const { toast } = useToast();
  const { sharing, loading, error, requestShare, stopShare } = useGeolocation();

  const onShare = async () => {
    await requestShare();
    if (!error) toast({ title: "Location updated", description: "We'll show people near you." });
  };

  const onStop = async () => {
    await stopShare();
    if (!error) toast({ title: "Location sharing disabled" });
  };

  return (
    <Card className={`border-0 rounded-2xl overflow-hidden ${sharing ? "shadow-card" : "shadow-card"}`}>
      <CardContent className="p-0">
        <div className={`p-4 flex items-center justify-between gap-3 ${sharing ? "bg-accent/50" : ""}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl grid place-items-center ${sharing ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground"}`}>
              {sharing ? <Navigation className="h-5 w-5" /> : <MapPin className="h-5 w-5" />}
            </div>
            <div>
              <div className="font-medium font-display text-sm">{sharing ? "Location active" : "Share your location"}</div>
              <p className="text-xs text-muted-foreground">{sharing ? "People can see you nearby" : "Enable to discover people nearby"}</p>
            </div>
          </div>
          {sharing ? (
            <Button variant="outline" size="sm" onClick={onStop} disabled={loading} className="rounded-xl">
              {loading && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />} Stop
            </Button>
          ) : (
            <Button size="sm" onClick={onShare} disabled={loading} className="rounded-xl">
              {loading && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />} Enable
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default LocationShare;
