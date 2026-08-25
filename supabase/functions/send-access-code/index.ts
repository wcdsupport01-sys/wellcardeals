// supabase/functions/send-access-code/index.ts
//
// Sends a dealer's access code by SMS and/or WhatsApp via Twilio, from the
// number +91 9540102163 (must be a number you own in your Twilio account,
// with WhatsApp enabled on it via Twilio's WhatsApp Sender setup).
//
// Deploy:
//   supabase functions deploy send-access-code
//
// Required secrets (Supabase Dashboard -> Edge Functions -> Secrets, or CLI):
//   supabase secrets set TWILIO_ACCOUNT_SID=xxxx
//   supabase secrets set TWILIO_AUTH_TOKEN=xxxx
//   supabase secrets set TWILIO_FROM_SMS=+919540102163
//   supabase secrets set TWILIO_FROM_WHATSAPP=whatsapp:+919540102163
//   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=xxxx   (from Project Settings -> API)
//
// Called from the frontend as:
//   supabase.functions.invoke('send-access-code', { body: { dealerId, channel: 'sms' | 'whatsapp' | 'both' } })
//
// Only an admin (checked via the caller's JWT) is allowed to trigger this —
// it looks up the dealer's phone + code itself using the service role key,
// so the frontend never needs to know the code or the dealer's raw number.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID")!;
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN")!;
const TWILIO_FROM_SMS = Deno.env.get("TWILIO_FROM_SMS") || "+919540102163";
const TWILIO_FROM_WHATSAPP = Deno.env.get("TWILIO_FROM_WHATSAPP") || "whatsapp:+919540102163";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Normalizes an Indian 10-digit number (or one already prefixed) to E.164.
function toE164India(raw: string): string {
  const digits = raw.replace(/[^\d]/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  if (raw.startsWith("+")) return raw;
  return `+${digits}`;
}

async function sendTwilioMessage(to: string, from: string, body: string) {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const auth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
  const params = new URLSearchParams({ To: to, From: from, Body: body });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.message || `Twilio error (${res.status})`);
  }
  return data;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const callerClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
    } = await callerClient.auth.getUser();
    if (!user) return jsonResponse({ error: "Not authenticated." }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: callerProfile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (!callerProfile || !["admin", "manager"].includes(callerProfile.role)) {
      return jsonResponse({ error: "Only an admin can send dealer access codes." }, 403);
    }

    const { dealerId, channel = "both" } = await req.json();
    if (!dealerId) return jsonResponse({ error: "dealerId is required." }, 400);

    const { data: dealer, error: dealerErr } = await admin
      .from("profiles")
      .select("id, role, status, phone, mobile_number, business_name, dealer_access_code")
      .eq("id", dealerId)
      .maybeSingle();

    if (dealerErr || !dealer) return jsonResponse({ error: "Dealer not found." }, 404);
    if (dealer.role !== "dealer") return jsonResponse({ error: "Target is not a dealer." }, 400);
    if (!dealer.dealer_access_code) {
      return jsonResponse(
        { error: "No access code generated yet. Call generate_dealer_access_code first." },
        400
      );
    }

    const rawPhone = dealer.phone || dealer.mobile_number;
    if (!rawPhone) return jsonResponse({ error: "Dealer has no phone number on file." }, 400);

    const to = toE164India(rawPhone);
    const message = `Your ${dealer.business_name || "dealer"} account is approved. Your live auction access code is: ${dealer.dealer_access_code}. Enter this code after logging in to start bidding. - WellCarDeals`;

    const results: Record<string, unknown> = {};

    if (channel === "sms" || channel === "both") {
      results.sms = await sendTwilioMessage(to, TWILIO_FROM_SMS, message);
    }
    if (channel === "whatsapp" || channel === "both") {
      results.whatsapp = await sendTwilioMessage(`whatsapp:${to}`, TWILIO_FROM_WHATSAPP, message);
    }

    return jsonResponse({ ok: true, to, results });
  } catch (err) {
    console.error("send-access-code error:", err);
    return jsonResponse({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});
