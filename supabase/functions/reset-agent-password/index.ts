// supabase/functions/reset-agent-password/index.ts
// Admin-only. Body: { agentId: uuid, password?: string }
//
// Replaces the removed agent-self-service "change password" flow. Agents
// can NEVER set their own password anymore — only an admin can, via this
// function. Generates a fresh random password (or accepts an admin-chosen
// one), sets it directly on the agent's Supabase Auth user, and returns it
// ONCE in the response. Exactly like create-agent, the plaintext password
// is never written to any table — if it isn't copied now, the only way to
// recover access is to reset again.
//
// Deploy: supabase functions deploy reset-agent-password
import { requireAdmin, jsonResponse, corsHeaders, AdminAuthError } from "../_shared/adminAuth.ts";
import { pushRowToSheetEnsuringTab } from "../_shared/googleSheet.ts";
import { ADMIN_AUDIT_LOGS_TAB, ADMIN_AUDIT_LOGS_HEADERS } from "../_shared/sheetTabs.ts";

function randomPassword(length = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "POST only." }, 405);

  try {
    const { admin, user, profile } = await requireAdmin(req);
    const { agentId, password: customPassword } = await req.json();

    if (!agentId) return jsonResponse({ error: "agentId is required." }, 400);

    const { data: agentProfile, error: agentErr } = await admin
      .from("profiles")
      .select("id, role, full_name, agent_code")
      .eq("id", agentId)
      .maybeSingle();

    if (agentErr || !agentProfile) return jsonResponse({ error: "Agent not found." }, 404);
    if (agentProfile.role !== "agent") {
      return jsonResponse({ error: "This user is not an agent." }, 400);
    }

    if (customPassword && customPassword.trim() && customPassword.trim().length < 6) {
      return jsonResponse({ error: "Password must be at least 6 characters." }, 400);
    }
    const newPassword =
      customPassword && customPassword.trim() ? customPassword.trim() : randomPassword(10);

    const { error: updateErr } = await admin.auth.admin.updateUserById(agentId, {
      password: newPassword,
    });
    if (updateErr) return jsonResponse({ error: updateErr.message }, 400);

    // Audit log — records THAT a reset happened and WHO did it, never the
    // password itself.
    await pushRowToSheetEnsuringTab(ADMIN_AUDIT_LOGS_TAB, ADMIN_AUDIT_LOGS_HEADERS, [
      new Date().toISOString(),
      user?.id ?? "",
      profile?.full_name ?? user?.email ?? "",
      `Reset password for agent ${agentProfile.agent_code} (${agentProfile.full_name})`,
      "",
      "",
    ]);

    return jsonResponse({
      agentCode: agentProfile.agent_code,
      fullName: agentProfile.full_name,
      password: newPassword,
    });
  } catch (err) {
    if (err instanceof AdminAuthError) return err;
    console.error("reset-agent-password error:", err);
    return jsonResponse({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});
