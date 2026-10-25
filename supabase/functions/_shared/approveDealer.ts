import { requireStaff, jsonResponse, corsHeaders } from "./adminAuth.ts";
import { readJson, uuid } from "./http.ts";
import { randomPassword } from "./passwords.ts";
import { backendCommand } from "./backendCommand.ts";

export async function approveDealer(req: Request) {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "POST only." }, 405);
  try {
    const { admin, user } = await requireStaff(req, ["admin", "manager"]);
    const { applicationId } = await readJson(req);
    uuid(applicationId, "applicationId");
    const { data: application, error } = await admin.from("dealer_applications").select("*").eq("id", applicationId).maybeSingle();
    if (error) return jsonResponse({ error: "Application unavailable. Retry loading it." }, 503);
    if (!application) return jsonResponse({ error: "Application not found." }, 404);
    if (application.status === "approved") return jsonResponse({ error: "Already approved. Use the authorized password reset if credentials were lost." }, 409);
    const tempPassword = randomPassword(16);
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: application.email, password: tempPassword, email_confirm: true,
      // Trusted binding cannot be edited through self-service user metadata.
      app_metadata: { dealer_application_id: applicationId },
      user_metadata: { full_name: application.dealer_name, business_name: application.business_name, role: "dealer" },
    });
    if (createError || !created?.user) return jsonResponse({ error: "Could not create a new dealer login. An existing email/account requires separate review; its password and permissions have not been changed." }, 409);
    const id = created.user.id;
    let result;
    try {
      result = await backendCommand(admin, user.id, req, "dealer_finalize", { application_id: applicationId, auth_user_id: id });
    } catch {
      // A lost reply is not proof of rollback. Never delete/reset a login that
      // may already be linked to a successfully committed dealer approval.
      const { data: receipt, error: receiptError } = await admin.from("dealer_applications").select("*").eq("id", applicationId).maybeSingle();
      if (!receiptError && receipt?.status === "approved" && receipt.auth_user_id === id) result = receipt;
      else return jsonResponse({ error: "Login provisioning needs reconciliation. Do not create another account; review this application and use the authorized reset after linking.", applicationId, provisioningUserId: id }, 503);
    }
    return jsonResponse({ ok: true, ...result, tempPassword, emailSent: false });
  } catch (failure) {
    if (failure instanceof Response) return failure;
    return jsonResponse({ error: "Dealer approval unavailable. Reload the application before retrying." }, 503);
  }
}
