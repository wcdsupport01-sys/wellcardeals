import { randomPassword as generateTempPassword } from "../_shared/passwords.ts";
import { readJson, uuid, escapeHtml } from "../_shared/http.ts";
// supabase/functions/approve-dealer-application/index.ts
// Admin/manager-only. Body: { applicationId: uuid }
//
// This is PHASE 7: unlike the old approve_dealer_application() SQL RPC
// (which only flipped status + handed out a Dealer ID), this Edge Function
// does the full job in one shot:
//   1. Generates the Dealer ID (DLR-000001 style) via generate_dealer_id().
//   2. Generates a secure random temporary password.
//   3. Creates the actual auth.users account for this dealer via the Admin
//      API — Supabase Auth hashes and stores the password itself (bcrypt),
//      there's no separate "hash it ourselves" step needed or safer than
//      that.
//   4. Upserts a profiles row (role='dealer', status='approved',
//      dealer_id) so the dealer can log in.
//   5. Marks the dealer_applications row approved + links auth_user_id.
//   6. Emails the dealer their Dealer ID + temp password + login URL via
//      Resend (same provider already used for auth SMTP).
//
// Deploy: supabase functions deploy approve-dealer-application
// Required secret: supabase secrets set RESEND_API_KEY=xxxx
// (SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are already
// set automatically by Supabase for every Edge Function.)

import { requireStaff, jsonResponse, corsHeaders, AdminAuthError } from "../_shared/adminAuth.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const LOGIN_URL = Deno.env.get("DEALER_LOGIN_URL") || "https://wellcardeals.com/dealer-login";
const FROM_EMAIL = Deno.env.get("DEALER_EMAIL_FROM") || "WellCarDeal <no-reply@wellcardeals.com>";

// Avoids visually-ambiguous characters (0/O, 1/l/I) since this gets typed
// by hand off an email/SMS at least once.




async function sendDealerCredentialsEmail(opts: {
  to: string;
  dealerName: string;
  businessName: string;
  dealerId: string;
  tempPassword: string;
}) {
  if (!RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not set — skipping credentials email.");
    return { skipped: true };
  }

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #111827;">
      <h2 style="margin-bottom: 4px;">Your dealer account is approved</h2>
      <p style="color: #4B5563;">Hi ${escapeHtml(opts.dealerName)}, ${escapeHtml(opts.businessName)} has been approved on WellCarDeal.</p>
      <div style="background: #F3F4F6; border-radius: 12px; padding: 16px 20px; margin: 20px 0;">
        <p style="margin: 4px 0;"><strong>Dealer ID:</strong> ${escapeHtml(opts.dealerId)}</p>
        <p style="margin: 4px 0;"><strong>Temporary Password:</strong> ${escapeHtml(opts.tempPassword)}</p>
      </div>
      <p><a href="${LOGIN_URL}" style="background:#1E4FD9;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block;">Log in now</a></p>
      <p style="color: #6B7280; font-size: 13px; margin-top: 20px;">
        For security, you'll be asked to set a new password the first time you log in.
        Please don't share this email with anyone.
      </p>
    </div>
  `;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: opts.to,
      subject: "Your WellCarDeal dealer login details",
      html,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("Resend error:", errText);
    // Don't fail the whole approval just because the email didn't go out —
    // the admin can still see/relay the credentials manually if needed.
    return { skipped: false, error: errText };
  }
  return { skipped: false, ok: true };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "POST only." }, 405);

  try {
    const { admin } = await requireStaff(req, ["admin", "manager"]);
    const { applicationId } = await readJson(req);
    uuid(applicationId, "applicationId");
    if (!applicationId) return jsonResponse({ error: "applicationId is required." }, 400);

    const { data: application, error: appErr } = await admin
      .from("dealer_applications")
      .select("*")
      .eq("id", applicationId)
      .maybeSingle();

    if (appErr || !application) {
      return jsonResponse({ error: "Application not found." }, 404);
    }
    if (application.status === "approved") {
      return jsonResponse({ error: "This application is already approved." }, 400);
    }

    // 1. Dealer ID
    const { data: dealerId, error: idErr } = await admin.rpc("generate_dealer_id");
    if (idErr || !dealerId) {
      return jsonResponse({ error: idErr?.message || "Couldn't generate Dealer ID." }, 500);
    }

    // 2. Temp password
    const tempPassword = generateTempPassword(16);

    // 3. Create (or reuse, if this email already has an auth account) the
    //    dealer's login.
    let authUserId: string;
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: application.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: application.dealer_name,
        business_name: application.business_name,
      },
    });

    if (createErr || !created?.user) {
      return jsonResponse({ error: "Could not create a new dealer login. If this email already has an account, review that account separately; it has not been changed." }, 409);
    }
    authUserId = created.user.id;

    // 4. profiles row
    const { error: profileErr } = await admin.from("profiles").upsert(
      {
        id: authUserId,
        role: "dealer",
        status: "approved",
        email: application.email,
        full_name: application.dealer_name,
        phone: application.mobile_number,
        business_name: application.business_name,
        dealer_id: dealerId,
      },
      { onConflict: "id" }
    );
    if (profileErr) {
      const { error: cleanupError } = await admin.auth.admin.deleteUser(authUserId);
      if (cleanupError) console.error("Dealer provisioning cleanup requires review", authUserId);
      return jsonResponse({ error: "Dealer profile could not be saved. Review this application before retrying." }, 503);
    }

    // 5. dealer_applications row
    const { data: updatedApp, error: updateErr } = await admin
      .from("dealer_applications")
      .update({ status: "approved", dealer_id: dealerId, auth_user_id: authUserId })
      .eq("id", applicationId)
      .select()
      .single();
    if (updateErr) return jsonResponse({ error: updateErr.message }, 400);

    // 6. Email the credentials
    const emailResult = await sendDealerCredentialsEmail({
      to: application.email,
      dealerName: application.dealer_name,
      businessName: application.business_name,
      dealerId,
      tempPassword,
    });

    return jsonResponse({ ok: true, ...updatedApp, emailResult });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("approve-dealer-application error:", err);
    return jsonResponse({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});