// supabase/functions/record-signup/index.ts
// Called right after a buyer/dealer signup succeeds. Any signed-in user can
// call this -- it only ever records the CALLER's own profile (never lets
// someone push arbitrary rows), and is entirely best-effort: it never
// throws in a way that would block the signup flow.
// Deploy: supabase functions deploy record-signup
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { pushRowToSheetBestEffort } from "../_shared/googleSheet.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SIGNUPS_TAB = Deno.env.get("GOOGLE_SHEET_SIGNUPS_TAB") || "Signups";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") || "";
    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
    } = await callerClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Not authenticated." }), { status: 401, headers: corsHeaders });

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: profile } = await admin
      .from("profiles")
      .select("id, role, email, full_name, phone, business_name, status, created_at")
      .eq("id", user.id)
      .maybeSingle();

    if (profile) {
      await pushRowToSheetBestEffort(SIGNUPS_TAB, [
        profile.created_at || new Date().toISOString(),
        profile.role,
        profile.full_name || profile.business_name || "",
        profile.email || "",
        profile.phone || "",
        profile.status || "",
      ]);
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("record-signup error (non-fatal):", err);
    // Still 200 -- this must never block the signup flow on the frontend.
    return new Response(JSON.stringify({ ok: false }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
