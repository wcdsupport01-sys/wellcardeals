// supabase/functions/dealer-login-lookup/index.ts
// Public (no login required — the dealer isn't logged in yet). Body: { identifier }
//
// The Dealer Login page only has ONE identifier field, which accepts either:
//   - A Dealer ID (e.g. "DLR-000123") — only exists once an application has
//     been approved, so we look it up in `profiles`.
//   - An email address — used for applicants who haven't been approved yet
//     (they have no Dealer ID) so we can still show them
//     "Application Under Review" / "Application Rejected" instead of a
//     dead end. Looked up in `dealer_applications`.
//
// Returns only { status, email, dealerId? } — never a password, never
// anything else about the account. The frontend then calls
// supabase.auth.signInWithPassword() directly with the resolved email,
// so Supabase Auth (not this function) is what actually checks the
// password.
//
// Deploy: supabase functions deploy dealer-login-lookup --no-verify-jwt

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const DEALER_ID_PATTERN = /^DLR-\d{6,}$/i;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "POST only." }, 405);

  try {
    const { identifier } = await req.json();
    const value = String(identifier || "").trim();
    if (!value) return jsonResponse({ error: "Dealer ID or email is required." }, 400);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    if (DEALER_ID_PATTERN.test(value)) {
      // Approved dealer path — look up by Dealer ID in profiles.
      const { data: profile } = await admin
        .from("profiles")
        .select("email, status, dealer_id")
        .eq("dealer_id", value.toUpperCase())
        .eq("role", "dealer")
        .maybeSingle();

      if (!profile) {
        return jsonResponse({ error: "No dealer account found for that Dealer ID." }, 404);
      }
      return jsonResponse({ status: profile.status, email: profile.email, dealerId: profile.dealer_id });
    }

    // Otherwise treat it as an email — covers applicants who are pending
    // or rejected and don't have a Dealer ID yet.
    const { data: application } = await admin
      .from("dealer_applications")
      .select("status, email, dealer_id")
      .ilike("email", value)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!application) {
      return jsonResponse({ error: "No application or dealer account found for that identifier." }, 404);
    }

    return jsonResponse({
      status: application.status,
      email: application.email,
      dealerId: application.dealer_id || null,
    });
  } catch (err) {
    console.error("dealer-login-lookup error:", err);
    return jsonResponse({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});