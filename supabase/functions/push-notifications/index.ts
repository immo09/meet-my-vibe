import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const url = new URL(req.url);

  try {
    // GET — return VAPID public key (generate & store if first time)
    if (req.method === "GET") {
      let { data: keys } = await supabaseAdmin
        .from("vapid_keys")
        .select("public_key")
        .eq("id", 1)
        .single();

      if (!keys) {
        // Generate new VAPID key pair
        const vapidKeys = webpush.generateVAPIDKeys();

        await supabaseAdmin.from("vapid_keys").insert({
          id: 1,
          public_key: vapidKeys.publicKey,
          private_key: vapidKeys.privateKey,
        });

        keys = { public_key: vapidKeys.publicKey };
      }

      return new Response(JSON.stringify({ publicKey: keys.public_key }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST — subscribe or send
    if (req.method === "POST") {
      const body = await req.json();

      // Store push subscription
      if (body.action === "subscribe") {
        const { user_id, subscription } = body;
        if (!user_id || !subscription?.endpoint) {
          return new Response(JSON.stringify({ error: "Missing fields" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        await supabaseAdmin.from("push_subscriptions").upsert(
          {
            user_id,
            endpoint: subscription.endpoint,
            p256dh: subscription.keys.p256dh,
            auth: subscription.keys.auth,
          },
          { onConflict: "user_id,endpoint" }
        );

        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Send push to conversation members (except sender)
      if (body.action === "send") {
        const { conversation_id, sender_id, sender_name, content } = body;

        // Get VAPID keys first
        const { data: vapidKeys } = await supabaseAdmin
          .from("vapid_keys")
          .select("public_key, private_key")
          .eq("id", 1)
          .single();

        if (!vapidKeys) {
          return new Response(JSON.stringify({ error: "VAPID keys not initialised" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        webpush.setVapidDetails(
          "mailto:noreply@meet-my-vibe.lovable.app",
          vapidKeys.public_key,
          vapidKeys.private_key
        );

        // Get conversation members except sender
        const { data: members } = await supabaseAdmin
          .from("conversation_members")
          .select("user_id")
          .eq("conversation_id", conversation_id)
          .neq("user_id", sender_id);

        if (!members || members.length === 0) {
          return new Response(JSON.stringify({ sent: 0 }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const memberIds = members.map((m: { user_id: string }) => m.user_id);

        const { data: subscriptions } = await supabaseAdmin
          .from("push_subscriptions")
          .select("*")
          .in("user_id", memberIds);

        if (!subscriptions || subscriptions.length === 0) {
          return new Response(JSON.stringify({ sent: 0 }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const payload = JSON.stringify({
          title: sender_name || "New message",
          body: content?.substring(0, 200) || "Sent an attachment",
          data: { conversation_id },
        });

        let sent = 0;
        const expiredEndpoints: string[] = [];

        for (const sub of subscriptions) {
          try {
            await webpush.sendNotification(
              {
                endpoint: sub.endpoint,
                keys: { p256dh: sub.p256dh, auth: sub.auth },
              },
              payload,
              { TTL: 86400 }
            );
            sent++;
          } catch (err: any) {
            console.error(`Push failed for endpoint: ${err.statusCode} ${err.message}`);
            if (err.statusCode === 410 || err.statusCode === 404) {
              expiredEndpoints.push(sub.endpoint);
            }
          }
        }

        // Clean up expired subscriptions
        if (expiredEndpoints.length > 0) {
          await supabaseAdmin
            .from("push_subscriptions")
            .delete()
            .in("endpoint", expiredEndpoints);
        }

        return new Response(JSON.stringify({ sent }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Push notification error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
