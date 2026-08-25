// supabase/functions/_shared/agentAuth.ts
//
// adminAuth.ts jaisa hi pattern, bas admin ki jagah agent check karta hai:
//   1. Caller ka JWT verify karta hai (real logged-in session).
//   2. service_role client se profiles table check karta hai ki
//      role = 'agent' AND status = 'approved' hai ya nahi.
//   3. Pass ho jaaye to ek service_role client wapas karta hai jo RLS
//      bypass karke likh sakta hai.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { corsHeaders } from "./adminAuth.ts";

export { corsHeaders };

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export class AgentAuthError extends Response {}

export async function requireAgent(req: Request) {
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

  if (!user) {
    throw new AgentAuthError(JSON.stringify({ error: "Not authenticated." }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: profile } = await admin
    .from("profiles")
    .select("id, role, status, agent_code, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "agent") {
    throw new AgentAuthError(JSON.stringify({ error: "Agent access required." }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (profile.status !== "approved") {
    throw new AgentAuthError(JSON.stringify({ error: "This agent account is not active." }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return { admin, user, profile };
}