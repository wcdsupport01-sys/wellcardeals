import { requireAdmin } from "../_shared/adminAuth.ts";
import { corsHeaders, jsonResponse, readJson, uuid } from "../_shared/http.ts";
import { accountPassword } from "../_shared/passwords.ts";
import { pushRowToSheetEnsuringTab } from "../_shared/googleSheet.ts";
import {
  ADMIN_AUDIT_LOGS_HEADERS,
  ADMIN_AUDIT_LOGS_TAB,
} from "../_shared/sheetTabs.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") return jsonResponse({ error: "POST only." }, 405);
  try {
    const { admin, user } = await requireAdmin(req);
    const { userId, password: customPassword } = await readJson(req);
    uuid(userId, "userId");
    const { data: target, error } = await admin.from("profiles").select(
      "id,role,email,full_name",
    ).eq("id", userId).maybeSingle();
    if (error) {
      return jsonResponse({ error: "Could not verify target account." }, 503);
    }
    if (!target) return jsonResponse({ error: "Account not found." }, 404);
    if (!["admin", "manager", "team_lead", "agent"].includes(target.role)) {
      return jsonResponse({
        error:
          "Use the dealer password action for dealer accounts. Buyer accounts use password recovery.",
      }, 400);
    }
    const password = accountPassword(customPassword);
    const { error: resetError } = await admin.auth.admin.updateUserById(
      userId,
      { password },
    );
    if (resetError) {
      return jsonResponse({
        error: "Password could not be reset. Please retry.",
      }, 400);
    }
    await pushRowToSheetEnsuringTab(
      ADMIN_AUDIT_LOGS_TAB,
      ADMIN_AUDIT_LOGS_HEADERS,
      [
        new Date().toISOString(),
        user.id,
        "",
        `Reset password for staff ${userId}`,
        "",
        "",
      ],
    );
    return jsonResponse({
      userId,
      fullName: target.full_name,
      email: target.email,
      password,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(
      "reset-user-password failed",
      error instanceof Error ? error.name : "unknown",
    );
    return jsonResponse(
      { error: "Password reset is temporarily unavailable." },
      500,
    );
  }
});
