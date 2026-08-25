// supabase/functions/create-staff-user/index.ts
// Admin-only. Body: { fullName: string, email: string, phone?: string, role: "admin"|"manager"|"team_lead", password?: string }
//
// Part of ADMIN's "Full user management (Add ... for anyone)" power. Unlike
// create-agent (synthetic @agents.wellcardeals.internal login), staff here
// log in with a real email + password on /admin-login, same as an Admin
// does today — role alone decides what they can see once signed in.
//
// Deliberately can NEVER be used to create a "dealer" or "buyer" — those
// still go through their own public sign-up flows; this is only for the
// three internal/staff roles.
// Deploy: supabase functions deploy create-staff-user
import { requireAdmin, jsonResponse, corsHeaders, AdminAuthError } from "../_shared/adminAuth.ts";
import { pushRowToSheetEnsuringTab } from "../_shared/googleSheet.ts";
import { STAFF_DIRECTORY_TAB, STAFF_DIRECTORY_HEADERS } from "../_shared/sheetTabs.ts";

const CREATABLE_ROLES = new Set(["admin", "manager", "team_lead"]);

function randomPassword(length = 12) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  let out = "";
  for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "POST only." }, 405);

  try {
    const { admin, user, profile } = await requireAdmin(req);
    const { fullName, email, phone, role, password: customPassword } = await req.json();

    if (!fullName || !fullName.trim()) {
      return jsonResponse({ error: "fullName is required." }, 400);
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return jsonResponse({ error: "A valid email is required." }, 400);
    }
    if (!CREATABLE_ROLES.has(role)) {
      return jsonResponse({ error: "role must be one of: admin, manager, team_lead." }, 400);
    }

    if (customPassword && customPassword.trim() && customPassword.trim().length < 6) {
      return jsonResponse({ error: "Password must be at least 6 characters." }, 400);
    }
    const password = customPassword && customPassword.trim() ? customPassword.trim() : randomPassword(12);
    const normalizedEmail = email.trim().toLowerCase();

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
    });
    if (createErr || !created?.user) {
      return jsonResponse({ error: createErr?.message || "Couldn't create the login." }, 400);
    }

    const { error: profileErr } = await admin.from("profiles").insert({
      id: created.user.id,
      role,
      email: normalizedEmail,
      full_name: fullName.trim(),
      phone: phone || null,
      status: "approved",
    });
    if (profileErr) {
      // Roll back the auth user so we don't leave an orphaned login.
      await admin.auth.admin.deleteUser(created.user.id);
      return jsonResponse({ error: profileErr.message }, 400);
    }

    console.log(
      `[create-staff-user] ${profile?.full_name || user?.email} created ${role} account ${normalizedEmail} (${created.user.id})`
    );

    // NEW — Staff_Directory entry, mirrors Agents_Directory's pattern.
    // Deliberately no plaintext password here either.
    await pushRowToSheetEnsuringTab(STAFF_DIRECTORY_TAB, STAFF_DIRECTORY_HEADERS, [
      new Date().toISOString(),
      created.user.id,
      role,
      fullName.trim(),
      phone || "",
      normalizedEmail,
      new Date().toISOString(),
      "approved",
      profile?.full_name || user?.email || "",
    ]);

    return jsonResponse({ email: normalizedEmail, password, fullName: fullName.trim(), role });
  } catch (err) {
    if (err instanceof AdminAuthError) return err;
    console.error("create-staff-user error:", err);
    return jsonResponse({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});
