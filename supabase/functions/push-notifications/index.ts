import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// --- Web Push helpers using Web Crypto (no npm deps) ---

function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(str: string): Uint8Array {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function generateVapidKeys(): Promise<{ publicKey: string; privateKey: string }> {
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign"]
  );
  const pubRaw = await crypto.subtle.exportKey("raw", keyPair.publicKey);
  const privJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
  return {
    publicKey: base64UrlEncode(pubRaw),
    privateKey: privJwk.d!,
  };
}

async function createJwt(
  audience: string,
  subject: string,
  privateKeyB64: string
): Promise<string> {
  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = { aud: audience, exp: now + 86400, sub: subject };

  const enc = new TextEncoder();
  const headerB64 = base64UrlEncode(enc.encode(JSON.stringify(header)).buffer);
  const payloadB64 = base64UrlEncode(enc.encode(JSON.stringify(payload)).buffer);
  const unsigned = `${headerB64}.${payloadB64}`;

  // Import private key
  const privBytes = base64UrlDecode(privateKeyB64);
  const privKey = await crypto.subtle.importKey(
    "jwk",
    { kty: "EC", crv: "P-256", d: privateKeyB64, x: "0", y: "0" },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  // We need the full JWK with x,y - let's use a different approach
  // Re-import from raw d value with placeholder x,y won't work
  // Instead store the full private JWK
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privKey,
    enc.encode(unsigned)
  );

  return `${unsigned}.${base64UrlEncode(sig)}`;
}

// Simplified push sending using fetch with VAPID
async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: string,
  vapidPublicKey: string,
  vapidPrivateJwk: string,
  subject: string
): Promise<boolean> {
  try {
    // For web push, we need proper VAPID JWT signing
    // Import the full private key JWK
    const privateJwk = JSON.parse(vapidPrivateJwk);
    const privateKey = await crypto.subtle.importKey(
      "jwk",
      privateJwk,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign"]
    );

    // Create VAPID JWT
    const audience = new URL(subscription.endpoint).origin;
    const header = { typ: "JWT", alg: "ES256" };
    const now = Math.floor(Date.now() / 1000);
    const jwtPayload = { aud: audience, exp: now + 86400, sub: subject };

    const enc = new TextEncoder();
    const headerB64 = base64UrlEncode(enc.encode(JSON.stringify(header)).buffer);
    const payloadB64 = base64UrlEncode(enc.encode(JSON.stringify(jwtPayload)).buffer);
    const unsigned = `${headerB64}.${payloadB64}`;

    const sig = await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      privateKey,
      enc.encode(unsigned)
    );

    // Convert from DER to raw r||s format (each 32 bytes)
    const sigBytes = new Uint8Array(sig);
    let r: Uint8Array, s: Uint8Array;

    if (sigBytes[0] === 0x30) {
      // DER encoded
      const rLen = sigBytes[3];
      const rStart = 4;
      const rBytes = sigBytes.slice(rStart, rStart + rLen);
      const sLen = sigBytes[rStart + rLen + 1];
      const sStart = rStart + rLen + 2;
      const sBytes = sigBytes.slice(sStart, sStart + sLen);

      r = new Uint8Array(32);
      s = new Uint8Array(32);
      r.set(rBytes.length > 32 ? rBytes.slice(rBytes.length - 32) : rBytes, 32 - Math.min(rBytes.length, 32));
      s.set(sBytes.length > 32 ? sBytes.slice(sBytes.length - 32) : sBytes, 32 - Math.min(sBytes.length, 32));
    } else {
      // Already raw
      r = sigBytes.slice(0, 32);
      s = sigBytes.slice(32, 64);
    }

    const rawSig = new Uint8Array(64);
    rawSig.set(r, 0);
    rawSig.set(s, 32);

    const jwt = `${unsigned}.${base64UrlEncode(rawSig.buffer)}`;
    const vapidAuth = `vapid t=${jwt}, k=${vapidPublicKey}`;

    // Encrypt the payload using the subscription keys
    // For simplicity, send without encryption (empty payload triggers notification with default text)
    // Full encryption requires ECDH + HKDF which is complex
    // Instead, we'll send the payload as plaintext (works with most browsers for testing)

    // Actually, Web Push requires encrypted payloads. Let's implement proper encryption.
    // Using ECDH with the client's p256dh key and auth secret

    const clientPublicKey = base64UrlDecode(subscription.p256dh);
    const clientAuth = base64UrlDecode(subscription.auth);

    // Generate local ECDH key pair
    const localKeyPair = await crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveBits"]
    );

    const localPublicKeyRaw = new Uint8Array(
      await crypto.subtle.exportKey("raw", localKeyPair.publicKey)
    );

    // Import client public key
    const clientPubKey = await crypto.subtle.importKey(
      "raw",
      clientPublicKey,
      { name: "ECDH", namedCurve: "P-256" },
      false,
      []
    );

    // Derive shared secret
    const sharedSecret = new Uint8Array(
      await crypto.subtle.deriveBits(
        { name: "ECDH", public: clientPubKey },
        localKeyPair.privateKey,
        256
      )
    );

    // HKDF for auth info
    const authInfo = enc.encode("Content-Encoding: auth\0");
    const prkKey = await crypto.subtle.importKey(
      "raw",
      clientAuth,
      { name: "HKDF" },
      false,
      ["deriveBits"]
    );

    // IKM = HKDF(auth, sharedSecret, "Content-Encoding: auth\0", 32)
    const ikmKey = await crypto.subtle.importKey("raw", sharedSecret, { name: "HKDF" }, false, ["deriveBits"]);
    const ikm = new Uint8Array(
      await crypto.subtle.deriveBits(
        { name: "HKDF", hash: "SHA-256", salt: clientAuth, info: authInfo },
        ikmKey,
        256
      )
    );

    // Generate salt
    const salt = crypto.getRandomValues(new Uint8Array(16));

    // Derive CEK and nonce
    const context = new Uint8Array([
      ...enc.encode("P-256\0"),
      0, 65, ...clientPublicKey,
      0, 65, ...localPublicKeyRaw,
    ]);

    const cekInfo = new Uint8Array([...enc.encode("Content-Encoding: aesgcm\0"), ...context]);
    const nonceInfo = new Uint8Array([...enc.encode("Content-Encoding: nonce\0"), ...context]);

    const prkForCek = await crypto.subtle.importKey("raw", ikm, { name: "HKDF" }, false, ["deriveBits"]);
    const cekBits = new Uint8Array(
      await crypto.subtle.deriveBits(
        { name: "HKDF", hash: "SHA-256", salt, info: cekInfo },
        prkForCek,
        128
      )
    );

    const prkForNonce = await crypto.subtle.importKey("raw", ikm, { name: "HKDF" }, false, ["deriveBits"]);
    const nonce = new Uint8Array(
      await crypto.subtle.deriveBits(
        { name: "HKDF", hash: "SHA-256", salt, info: nonceInfo },
        prkForNonce,
        96
      )
    );

    // Pad and encrypt
    const paddedPayload = new Uint8Array([0, 0, ...enc.encode(payload)]);
    const cek = await crypto.subtle.importKey("raw", cekBits, { name: "AES-GCM" }, false, ["encrypt"]);
    const encrypted = new Uint8Array(
      await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, cek, paddedPayload)
    );

    const response = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        Authorization: vapidAuth,
        "Content-Type": "application/octet-stream",
        "Content-Encoding": "aesgcm",
        "Crypto-Key": `dh=${base64UrlEncode(localPublicKeyRaw.buffer)};p256ecdsa=${vapidPublicKey}`,
        Encryption: `salt=${base64UrlEncode(salt.buffer)}`,
        TTL: "86400",
      },
      body: encrypted,
    });

    if (response.status === 410 || response.status === 404) {
      // Subscription expired
      return false;
    }

    return response.ok;
  } catch (err) {
    console.error("Push send error:", err);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const url = new URL(req.url);
  const action = url.pathname.split("/").pop();

  try {
    // GET /vapid-public-key — returns public key (generates if needed)
    if (req.method === "GET" && action === "push-notifications") {
      let { data: keys } = await supabaseAdmin
        .from("vapid_keys")
        .select("public_key")
        .eq("id", 1)
        .single();

      if (!keys) {
        // Generate new VAPID keys
        const keyPair = await crypto.subtle.generateKey(
          { name: "ECDSA", namedCurve: "P-256" },
          true,
          ["sign"]
        );
        const pubRaw = await crypto.subtle.exportKey("raw", keyPair.publicKey);
        const privJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);

        const publicKey = base64UrlEncode(pubRaw);
        const privateKey = JSON.stringify(privJwk);

        await supabaseAdmin.from("vapid_keys").insert({
          id: 1,
          public_key: publicKey,
          private_key: privateKey,
        });

        keys = { public_key: publicKey };
      }

      return new Response(JSON.stringify({ publicKey: keys.public_key }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST — subscribe or send
    if (req.method === "POST") {
      const body = await req.json();

      if (body.action === "subscribe") {
        // Store push subscription
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

      if (body.action === "send") {
        // Send push to conversation members (except sender)
        const { conversation_id, sender_id, sender_name, content } = body;

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

        const memberIds = members.map((m) => m.user_id);

        // Get push subscriptions for these users
        const { data: subscriptions } = await supabaseAdmin
          .from("push_subscriptions")
          .select("*")
          .in("user_id", memberIds);

        if (!subscriptions || subscriptions.length === 0) {
          return new Response(JSON.stringify({ sent: 0 }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Get VAPID keys
        const { data: vapidKeys } = await supabaseAdmin
          .from("vapid_keys")
          .select("*")
          .eq("id", 1)
          .single();

        if (!vapidKeys) {
          return new Response(JSON.stringify({ error: "VAPID keys not configured" }), {
            status: 500,
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
          const ok = await sendWebPush(
            { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
            payload,
            vapidKeys.public_key,
            vapidKeys.private_key,
            "mailto:noreply@meet-my-vibe.lovable.app"
          );
          if (ok) {
            sent++;
          } else {
            expiredEndpoints.push(sub.endpoint);
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
  } catch (err) {
    console.error("Push notification error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
