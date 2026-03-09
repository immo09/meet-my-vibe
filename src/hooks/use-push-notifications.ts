import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const usePushNotifications = () => {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "denied"
  );
  const [subscribed, setSubscribed] = useState(false);
  const subscribingRef = useRef(false);

  const getVapidPublicKey = useCallback(async (): Promise<string | null> => {
    try {
      const { data, error } = await supabase.functions.invoke("push-notifications", {
        method: "GET",
      });
      if (error) throw error;
      return data?.publicKey ?? null;
    } catch (err) {
      console.error("Failed to get VAPID key:", err);
      return null;
    }
  }, []);

  const subscribe = useCallback(async () => {
    if (subscribingRef.current) return;
    subscribingRef.current = true;

    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        console.warn("Push notifications not supported");
        return;
      }

      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") return;

      const vapidPublicKey = await getVapidPublicKey();
      if (!vapidPublicKey) return;

      const registration = await navigator.serviceWorker.ready;

      // Check existing subscription
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        // Convert VAPID key to Uint8Array
        const padding = "=".repeat((4 - (vapidPublicKey.length % 4)) % 4);
        const base64 = (vapidPublicKey + padding).replace(/-/g, "+").replace(/_/g, "/");
        const rawData = atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; i++) {
          outputArray[i] = rawData.charCodeAt(i);
        }

        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: outputArray,
        });
      }

      // Store on server
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const subJson = subscription.toJSON();
      await supabase.functions.invoke("push-notifications", {
        body: {
          action: "subscribe",
          user_id: user.id,
          subscription: {
            endpoint: subJson.endpoint,
            keys: subJson.keys,
          },
        },
      });

      setSubscribed(true);
    } catch (err) {
      console.error("Push subscription failed:", err);
    } finally {
      subscribingRef.current = false;
    }
  }, [getVapidPublicKey]);

  // Auto-subscribe on mount if permission already granted
  useEffect(() => {
    if (permission === "granted" && !subscribed) {
      subscribe();
    }
  }, [permission, subscribed, subscribe]);

  return { permission, subscribed, subscribe };
};

export const sendPushNotification = async (
  conversationId: string,
  senderId: string,
  senderName: string,
  content: string
) => {
  try {
    await supabase.functions.invoke("push-notifications", {
      body: {
        action: "send",
        conversation_id: conversationId,
        sender_id: senderId,
        sender_name: senderName,
        content,
      },
    });
  } catch (err) {
    // Non-critical, don't block message sending
    console.error("Failed to send push:", err);
  }
};
