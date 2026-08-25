// supabase/functions/reset-dealer-password/index.ts
// Admin/manager-only. Body: { dealerId: uuid, password?: string }
//
// Dealers can NEVER set or change their own password — the self-service
// "set password" step (that used to run on first login) has been removed
// because it kept getting mixed up on the dealer's end. Only an admin or
// manager can issue a dealer a password now, via this function. Generates
// a fresh random password (or accepts an admin-chosen one), sets it
// directly on the dealer's Supabase Auth user, and returns it ONCE in the
// response. Exactly like reset-agent-password, the plaintext password is
// never written to any table — if it isn't copied now, the only way to
// recover access is to reset again.
//
// NOTE: `dealerId` here is the profiles.id (uuid / auth user id), not the
// human-readable Dealer ID string (DLR-000123) shown in the UI.
//
// Deploy: supabase functions deploy reset-dealer-password
import { requireStaff, jsonResponse, corsHeaders, AdminAuthError } from "../_shared/adminAuth.ts";
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
    // Admin AND manager can reset a dealer's password (same staff tier
    // that can approve/reject dealer applications) — team_lead is
    // deliberately excluded, it's read-only everywhere.
    const { admin, user, profile } = await requireStaff(req, ["admin", "manager"]);
    const { dealerId, password: customPassword } = await req.json();

    if (!dealerId) return jsonResponse({ error: "dealerId is required." }, 400);

    const { data: dealerProfile, error: dealerErr } = await admin
      .from("profiles")
      .select("id, role, status, full_name, business_name, dealer_id")
      .eq("id", dealerId)
      .maybeSingle();

    if (dealerErr || !dealerProfile) return jsonResponse({ error: "Dealer not found." }, 404);
    if (dealerProfile.role !== "dealer") {
      return jsonResponse({ error: "This user is not a dealer." }, 400);
    }

    if (customPassword && customPassword.trim() && customPassword.trim().length < 8) {
      return jsonResponse({ error: "Password must be at least 8 characters." }, 400);
    }
    const newPassword =
      customPassword && customPassword.trim() ? customPassword.trim() : randomPassword(10);

    const { error: updateErr } = await admin.auth.admin.updateUserById(dealerId, {
      password: newPassword,
    });
    if (updateErr) return jsonResponse({ error: updateErr.message }, 400);

    // Audit log — records THAT a reset happened and WHO did it, never the
    // password itself.
    await pushRowToSheetEnsuringTab(ADMIN_AUDIT_LOGS_TAB, ADMIN_AUDIT_LOGS_HEADERS, [
      new Date().toISOString(),
      user?.id ?? "",
      profile?.full_name ?? user?.email ?? "",
      `Reset password for dealer ${dealerProfile.dealer_id ?? dealerProfile.id} (${
        dealerProfile.business_name || dealerProfile.full_name || ""
      })`,
      "",
      "",
    ]);

    return jsonResponse({
      dealerId: dealerProfile.dealer_id,
      businessName: dealerProfile.business_name || dealerProfile.full_name,
      password: newPassword,
    });
  } catch (err) {
    if (err instanceof AdminAuthError) return err;
    console.error("reset-dealer-password error:", err);
    return jsonResponse({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});
