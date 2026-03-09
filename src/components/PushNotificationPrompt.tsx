import { useEffect } from "react";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";
import { toast } from "sonner";

const PushNotificationPrompt = () => {
  const { permission, subscribed, subscribe } = usePushNotifications();

  useEffect(() => {
    // Register service worker on mount
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(console.error);
    }
  }, []);

  if (typeof Notification === "undefined" || permission === "granted" || permission === "denied") {
    return null;
  }

  const handleEnable = async () => {
    await subscribe();
    if (Notification.permission === "granted") {
      toast.success("Push notifications enabled!");
    } else if (Notification.permission === "denied") {
      toast.error("Notifications were blocked. You can enable them in browser settings.");
    }
  };

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-card border rounded-xl shadow-lg p-4 flex items-center gap-3 max-w-sm mx-4">
      <Bell className="h-5 w-5 text-primary shrink-0" />
      <div className="flex-1">
        <p className="text-sm font-medium">Enable notifications?</p>
        <p className="text-xs text-muted-foreground">Get notified when you receive new messages.</p>
      </div>
      <Button size="sm" onClick={handleEnable}>
        Enable
      </Button>
    </div>
  );
};

export default PushNotificationPrompt;
