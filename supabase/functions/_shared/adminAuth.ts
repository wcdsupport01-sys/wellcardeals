// supabase/functions/_shared/adminAuth.ts
//
// Har admin-only Edge Function isi helper ko import karega. Ye:
//   1. Request ke Authorization header se caller ka Supabase session
//      (JWT) verify karta hai — is-user-real-and-logged-in check.
//   2. service_role client se profiles table check karta hai ki
//      role = 'admin' hai ya nahi — is-user-actually-admin check.
//   3. Dono pass ho jaaye to ek service_role client wapas karta hai jo
//      RLS ko bypass karke likh sakta hai (cars/lookups ab RLS-locked
//      hain, sirf service_role se hi insert/update/delete hoga).
//
// Koi bhi random anon-key holder isse pass nahi kar sakta — sirf woh
// user jiska profiles.role = 'admin' hai, apne login session ke saath.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Thrown as a Response so the calling function can just do:
//   try { const { admin } = await requireAdmin(req); } catch (r) { return r; }
export class AdminAuthError extends Response {}

// Generic version — verifies the caller is signed in AND that their
// profiles.role is one of `allowedRoles`. requireAdmin() (below) is just
// this pinned to ["admin"], so every existing admin-only function keeps
// working unchanged.
//
// Used for endpoints ADMIN and MANAGER both need (inventory writes, dealer
// onboarding, lookups) — TEAM LEAD is deliberately never passed in here:
// TL is read-only everywhere, so it never needs a service_role write path,
// only the normal (RLS-gated) SELECT policies granted in
// rbac_manager_teamlead_migration.sql.
export async function requireStaff(req: Request, allowedRoles: string[]) {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization") || "";

  // Step 1: verify the caller's own JWT (their real logged-in session).
  const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
  } = await callerClient.auth.getUser();

  if (!user) {
    throw new AdminAuthError(JSON.stringify({ error: "Not authenticated." }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Step 2: service_role client — used both to check the role (bypassing
  // RLS is fine here, we're reading, not trusting the caller) and to do
  // the actual write afterwards.
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: profile } = await admin
    .from("profiles")
    .select("id, role, status, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !allowedRoles.includes(profile.role)) {
    throw new AdminAuthError(JSON.stringify({ error: "You don't have access to this action." }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (profile.status === "suspended" || profile.status === "rejected") {
    throw new AdminAuthError(JSON.stringify({ error: "Your account access has been revoked." }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return { admin, user, profile };
}

export async function requireAdmin(req: Request) {
  return requireStaff(req, ["admin"]);
}
