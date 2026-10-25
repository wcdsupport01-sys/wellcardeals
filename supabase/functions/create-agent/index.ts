import { randomDigits } from "../_shared/passwords.ts";
import { accountPassword } from "../_shared/passwords.ts";
import { readJson, text } from "../_shared/http.ts";
// supabase/functions/create-agent/index.ts
// Admin-only. Body: { fullName: string, phone?: string, agentCode?: string, password?: string }
// Creates a brand-new Supabase Auth user for the agent. Admin can set a
// custom login ID (agentCode) and password, or leave either blank to have
// them auto-generated (agent_code e.g. "AGT-4821", random password).
// The plaintext password is returned ONCE in the response — it is never
// stored anywhere, so the admin must copy it and hand it to the agent now.
// Deploy: supabase functions deploy create-agent
import { requireAdmin, jsonResponse, corsHeaders, AdminAuthError } from "../_shared/adminAuth.ts";
import { pushRowToSheetEnsuringTab } from "../_shared/googleSheet.ts";
import { AGENTS_DIRECTORY_TAB, AGENTS_DIRECTORY_HEADERS } from "../_shared/sheetTabs.ts";





// agent_code doubles as the local part of a synthetic login email, since
// Supabase Auth requires an email — the agent never sees or uses this email,
// they only ever type their agent_code + password.
const AGENT_EMAIL_DOMAIN = "agents.wellcardeals.internal";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "POST only." }, 405);

  try {
    const { admin } = await requireAdmin(req);
    const { fullName, phone, agentCode: customAgentCode, password: customPassword } = await readJson(req);

    text(fullName, "fullName");
    if (phone != null) text(phone, "phone", 40, false);
    if (!fullName || !fullName.trim()) {
      return jsonResponse({ error: "fullName is required." }, 400);
    }

    if (customAgentCode != null) text(customAgentCode, "agentCode", 20, false);
    let agentCode = "";

    if (customAgentCode && customAgentCode.trim()) {
      const candidate = customAgentCode.trim().toUpperCase();
      if (!/^[A-Z0-9-]{3,20}$/.test(candidate)) {
        return jsonResponse(
          { error: "Agent ID can only contain letters, numbers and hyphens (3-20 characters)." },
          400
        );
      }
      const { data: existing, error: lookupError } = await admin
        .from("profiles")
        .select("id")
        .eq("agent_code", candidate)
        .maybeSingle();
      if (lookupError) return jsonResponse({ error: "Could not verify Agent ID availability." }, 503);
      if (existing) {
        return jsonResponse({ error: `Agent ID "${candidate}" is already taken.` }, 400);
      }
      agentCode = candidate;
    } else {
      // Generate a unique agent_code, retrying a handful of times on collision.
      for (let attempt = 0; attempt < 8; attempt++) {
        const candidate = `AGT-${randomDigits(4)}`;
        const { data: existing, error: lookupError } = await admin
          .from("profiles")
          .select("id")
          .eq("agent_code", candidate)
          .maybeSingle();
        if (lookupError) return jsonResponse({ error: "Could not verify Agent ID availability." }, 503);
        if (!existing) {
          agentCode = candidate;
          break;
        }
      }
      if (!agentCode) {
        return jsonResponse({ error: "Couldn't generate a unique agent ID, try again." }, 500);
      }
    }

    const password = accountPassword(customPassword);
    const email = `${agentCode.toLowerCase()}@${AGENT_EMAIL_DOMAIN}`;

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createErr || !created?.user) {
      return jsonResponse({ error: createErr?.message || "Couldn't create agent login." }, 400);
    }

    const { error: profileErr } = await admin.from("profiles").upsert({
      id: created.user.id,
      role: "agent",
      email,
      full_name: fullName.trim(),
      phone: phone || null,
      agent_code: agentCode,
      status: "approved",
    }, { onConflict: "id" });
    if (profileErr) {
      // Roll back the auth user so we don't leave an orphaned login.
      await admin.auth.admin.deleteUser(created.user.id);
      return jsonResponse({ error: profileErr.message }, 400);
    }

    // NEW — Agents_Directory entry. Deliberately does NOT include the
    // plaintext password or any token — only public-safe directory fields.
    await pushRowToSheetEnsuringTab(AGENTS_DIRECTORY_TAB, AGENTS_DIRECTORY_HEADERS, [
      new Date().toISOString(),
      created.user.id,
      agentCode,
      fullName.trim(),
      phone || "",
      email, // synthetic login email, not a real contact address — still fine as a directory reference
      new Date().toISOString(),
      "approved",
    ]);

    return jsonResponse({ agentCode, password, fullName: fullName.trim() });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("create-agent error:", err);
    return jsonResponse({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});
