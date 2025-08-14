import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, MapPin } from "lucide-react";
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
    <Card>
      <CardContent className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MapPin className="h-5 w-5 text-primary" />
          <div>
            <div className="font-medium">Share your location</div>
            <p className="text-sm text-muted-foreground">Enable to discover people nearby.</p>
          </div>
        </div>
        {sharing ? (
          <Button variant="secondary" onClick={onStop} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Stop sharing
          </Button>
        ) : (
          <Button onClick={onShare} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Share location
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default LocationShare;
