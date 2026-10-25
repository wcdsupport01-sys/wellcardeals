import { readPages } from "../lib/readPages";
import { backendCommand } from "../lib/backendCommands";
import { supabase } from "../lib/supabaseClient";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

async function getProfile(userId, signal) {
  const query = supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  const { data, error } = await (signal ? query.abortSignal(signal) : query);
  if (error) throw error;
  return data;
}

// Best-effort push of the caller's own profile row into the "Signups" tab
// of the connected Google Sheet. Never throws -- a Sheet hiccup should
// never break a signup that already succeeded in Postgres.
async function recordSignup() {
  try {
    await supabase.functions.invoke("record-signup");
  } catch (e) {
    console.warn("record-signup failed (non-fatal):", e);
  }
}

// ---------------------------------------------------------------------------
// Buyer
// ---------------------------------------------------------------------------
export async function buyerSignUp({ email, password, fullName, phone }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: typeof fullName === "string" ? fullName : "",
        phone: typeof phone === "string" ? phone : "",
      },
    },
  });
  if (error) {
    console.error("Error in buyerSignUp:", error.message);
    throw error;
  }
  const user = data.user;
  if (!user) throw new Error("Account could not be created.");
  if (!data.session) return { user, session: null };

  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      role: "buyer",
      email,
      full_name: fullName || null,
      phone: phone || null,
    },
    { onConflict: "id", ignoreDuplicates: true },
  );
  if (profileError) {
    console.error("Error creating buyer profile:", profileError.message);
    throw new Error(
      `Account was created but profile setup failed (${profileError.message}). Please contact support.`,
    );
  }

  await recordSignup();
  return { user, session: data.session };
}

export async function buyerSignIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) {
    console.error("Error in buyerSignIn:", error.message);
    throw error;
  }
  const user = data.user;

  const profile = await getProfile(user.id);

  // Without this check, any valid Supabase credentials (including an admin
  // or dealer account) would sign in successfully here, and the rest of the
  // app would then grant that account's *real* role — letting an admin or
  // dealer account slip into a session through the buyer login page.
  if (profile && profile.role && profile.role !== "buyer") {
    await supabase.auth.signOut();
    throw new Error(
      profile.role === "admin"
        ? "This is an admin account. Please use the admin login instead."
        : "This is a dealer account. Please use the dealer login instead.",
    );
  }

  return { user, session: data.session };
}

export async function buyerSignInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
  });
  if (error) {
    console.error("Error in buyerSignInWithGoogle:", error.message);
    throw error;
  }
  // signInWithOAuth redirects the browser away — the profile row is created
  // by ensureBuyerProfile() when the user lands back and AuthContext picks
  // up the new session.
  return data;
}

export async function sendPasswordReset(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) {
    console.error("Error in sendPasswordReset:", error.message);
    throw error;
  }
}

export async function updatePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    console.error("Error in updatePassword:", error.message);
    throw error;
  }
}

// Ensures a Google sign-in still gets a buyer profile row. Call this once
// after a session appears with no matching profiles row (AuthContext does
// this automatically).
export async function ensureBuyerProfile(user, signal) {
  if (!user) return;
  const existing = await getProfile(user.id, signal);
  if (existing) return;
  const insert = supabase.from("profiles").insert({
    id: user.id,
    role: user.user_metadata?.signup_role === "dealer" ? "dealer" : "buyer",
    status:
      user.user_metadata?.signup_role === "dealer" ? "pending" : "approved",
    business_name:
      user.user_metadata?.signup_role === "dealer"
        ? user.user_metadata?.business_name || null
        : null,
    email: user.email || null,
    full_name:
      user.user_metadata?.full_name || user.user_metadata?.name || null,
    phone: user.user_metadata?.phone || null,
  });
  const { error } = await (signal ? insert.abortSignal(signal) : insert);
  // Another signup callback may have created the profile concurrently.
  if (error && error.code !== "23505") throw error;
}

// ---------------------------------------------------------------------------
// Generic sign-up: creates the Supabase Auth user, then writes the matching
// profiles row based on role. Waits for both to finish before resolving, so
// callers never navigate/render before the profile exists.
// ---------------------------------------------------------------------------
export async function signUpUser({
  role,
  email,
  password,
  fullName,
  phone,
  businessName,
}) {
  if (role !== "buyer" && role !== "dealer") {
    throw new Error(`signUpUser: unsupported role "${role}"`);
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        signup_role: role,
        business_name: typeof businessName === "string" ? businessName : "",
        full_name: typeof fullName === "string" ? fullName : "",
        phone: typeof phone === "string" ? phone : "",
      },
    },
  });
  if (error) {
    console.error("Error creating auth user:", error.message);
    throw error;
  }
  const user = data.user;
  if (!user) throw new Error("Account could not be created.");
  if (!data.session) return { user, session: null };

  const row =
    role === "buyer"
      ? {
          id: user.id,
          role: "buyer",
          email,
          full_name: fullName || null,
          phone: phone || null,
        }
      : {
          id: user.id,
          role: "dealer",
          email,
          business_name: businessName || null,
          status: "pending",
        };

  const { error: profileError } = await supabase
    .from("profiles")
    .upsert(row, { onConflict: "id" });
  if (profileError) {
    console.error(`Error creating ${role} profile row:`, profileError.message);
    throw new Error(
      `Account was created but profile setup failed (${profileError.message}). Please contact support.`,
    );
  }

  await recordSignup();
  return { user, session: data.session };
}

// ---------------------------------------------------------------------------
// Dealer
// ---------------------------------------------------------------------------

// Phase 1 of dealer onboarding: just save the application.
// - No password is created.
// - No auth.users account / session is created.
// - No Dealer ID is generated.
// - Row is saved with status = "pending" (see dealer_application_migration.sql).
// The dealer cannot log in from this row — that only becomes possible in a
// later phase once an admin approves the application and a real account is
// provisioned.
export async function submitDealerApplication({
  businessName,
  dealerName,
  businessAddress,
  mobileNumber,
  email,
}) {
  // NOTE: intentionally no .select() here. The public/anon submitter is
  // only granted INSERT on dealer_applications (RLS SELECT is admin-only),
  // so asking Supabase to return the inserted row (.select()) makes it
  // also attempt a SELECT in the same request, which gets rejected with a
  // 401 even though the insert itself succeeded. Insert-only avoids that.
  const { error } = await supabase.from("dealer_applications").insert({
    business_name: businessName?.trim(),
    dealer_name: dealerName?.trim(),
    business_address: businessAddress?.trim(),
    mobile_number: mobileNumber?.trim(),
    email: email?.trim(),
    status: "pending",
  });

  if (error) {
    console.error("Error in submitDealerApplication:", error.message);
    throw error;
  }

  return {
    business_name: businessName?.trim(),
    dealer_name: dealerName?.trim(),
    email: email?.trim(),
  };
}

// ---------------------------------------------------------------------------
// Dealer applications: approval provisions a new login and atomically links
// its profile and application. Rejection only changes a pending request.
// ---------------------------------------------------------------------------
export async function fetchDealerApplications(status = "pending") {
  return readPages(() => {
    let q=supabase.from("dealer_applications").select("*", {count:"exact"});
    if (status && status!=="all") q=q.eq("status",status);
    return q;
  });
}

export async function setDealerApplicationStatus(id, status) {
  const { data, error } = await supabase
    .from("dealer_applications")
    .update({ status })
    .eq("id", id)
    .select()
    .single();
  if (error) {
    console.error("Error in setDealerApplicationStatus:", error.message);
    throw error;
  }
  return data;
}

// Approve: PHASE 7. Calls the approve-dealer-application Edge Function,
// which generates a Dealer ID, creates the actual auth account + a secure
// temp password and atomically approves the application/profile. Credentials
// are returned once for staff to share manually; no email is sent.
export async function approveDealerApplication(id) {
  const { data, error } = await supabase.functions.invoke(
    "approve-dealer-application",
    {
      body: { applicationId: id },
    },
  );
  if (error || data?.error) {
    let detail = data;
    try { if (error?.context?.clone) detail = await error.context.clone().json(); } catch { /* Keep the transport error. */ }
    const failure = new Error(detail?.error || error?.message || "Dealer approval unavailable.");
    if (detail?.provisioningUserId) failure.provisioningUserId = detail.provisioningUserId;
    throw failure;
  }
  return data;
}

export async function rejectDealerApplication(id) {
  return setDealerApplicationStatus(id, "rejected");
}

export async function dealerRegister({ email, password, profile, files }) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    console.error("Error in dealerRegister:", error.message);
    throw error;
  }
  const userId = data.user?.id;
  if (!userId) throw new Error("Could not create account.");

  // Helper: upload a file to Supabase Storage under dealer-docs/{userId}/...
  async function uploadIfPresent(file, name) {
    if (!file) return null;
    const ext = file.name.split(".").pop();
    const path = `${userId}/${name}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("dealer-docs")
      .upload(path, file, { upsert: true });
    if (uploadError) throw uploadError;
    return `storage://dealer-docs/${path}`;
  }

  try {
    const [licenseUrl, profileImageUrl, businessLogoUrl] = await Promise.all([
      uploadIfPresent(files.license, "license"),
      uploadIfPresent(files.profileImage, "profile-image"),
      uploadIfPresent(files.businessLogo, "business-logo"),
    ]);

    // Upsert, not insert: if AuthContext's ensureBuyerProfile() won the race
    // and already created a bare 'buyer' row for this brand-new user (see
    // dealer_registration_race_fix.sql for why that race exists), this
    // overwrites it with the real dealer data instead of hitting a
    // duplicate-key error on profiles_pkey.
    const { error: profileError } = await supabase.from("profiles").upsert(
      {
        id: userId,
        role: "dealer",
        email,
        full_name: profile?.fullName || null,
        phone: profile?.phone || null,
        business_name: profile?.businessName || null,
        license_url: licenseUrl,
        profile_image_url: profileImageUrl,
        business_logo_url: businessLogoUrl,
        status: "pending",
      },
      { onConflict: "id" },
    );
    if (profileError) throw profileError;
  } catch (err) {
    console.error("Error in dealerRegister:", err.message);
    throw err;
  }

  await recordSignup();
  return { user: data.user, session: data.session };
}

// ---------------------------------------------------------------------------
// PHASE 6 — Dealer ID + Password login.
// The login form only takes ONE identifier field (Dealer ID once approved,
// or email while still pending/rejected). This resolves that identifier to
// { status, email } via a public Edge Function, without ever exposing a
// password. See dealer-login-lookup/index.ts.
// ---------------------------------------------------------------------------
export async function dealerLoginLookup(identifier) {
  const { data, error } = await supabase.functions.invoke(
    "dealer-login-lookup",
    {
      body: { identifier: String(identifier || "").trim() },
    },
  );
  if (error) {
    console.error("Error in dealerLoginLookup:", error.message);
    throw new Error(
      "Couldn't look up that Dealer ID / email. Please try again.",
    );
  }
  if (data?.error) {
    throw new Error(data.error);
  }
  return data; // { status, email, dealerId }
}

// Full Dealer ID + Password sign-in flow:
//  1. resolve identifier -> email + application/account status
//  2. if not approved yet, throw a clear status-specific message
//  3. otherwise sign in normally with the resolved email + password
export async function dealerSignInWithIdentifier({ identifier, password }) {
  const lookup = await dealerLoginLookup(identifier);

  if (lookup.status === "pending") {
    throw new Error("Your dealer application is still under review.");
  }
  if (lookup.status === "rejected") {
    throw new Error(
      "Your dealer application was rejected. Contact support for details.",
    );
  }
  if (lookup.status !== "approved") {
    throw new Error(
      `Your dealer account is ${lookup.status}. Contact support for help.`,
    );
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: lookup.email,
    password,
  });
  if (error) {
    console.error("Error in dealerSignInWithIdentifier:", error.message);
    throw new Error("Incorrect Dealer ID or password.");
  }

  const user = data.user;
  const dealerRow = await getProfile(user.id);
  if (!dealerRow || dealerRow.role !== "dealer") {
    await supabase.auth.signOut();
    throw new Error("This account isn't registered as a dealer.");
  }
  if (dealerRow.status !== "approved") {
    await supabase.auth.signOut();
    throw new Error(
      `Your dealer account is ${dealerRow.status}. Contact support for help.`,
    );
  }

  return {
    user,
    session: data.session,
    businessName: dealerRow.business_name,
    dealerId: dealerRow.dealer_id,
  };
}

// Dealers never set/change their own password — it's too easy for the
// Dealer ID + temp-password flow to get "mixed up" on their end. If a
// dealer has trouble logging in, an admin or manager issues them a brand
// new password from the Manage Dealers screen via this function (which
// calls the reset-dealer-password Edge Function, admin/manager-only,
// service_role). Pass a custom password, or omit it to get a fresh random
// one generated for you. The plaintext password is returned exactly once
// in the response — it is never stored anywhere — so copy/share it with
// the dealer immediately.
export async function resetDealerPassword(dealerId, customPassword) {
  const { data, error } = await supabase.functions.invoke(
    "reset-dealer-password",
    {
      body: { dealerId, password: customPassword || undefined },
    },
  );
  if (error) {
    console.error("Error in resetDealerPassword:", error.message);
    throw error;
  }
  if (data?.error) {
    throw new Error(data.error);
  }
  return data; // { dealerId: dealer_id, businessName, password }
}

export async function dealerSignIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) {
    console.error("Error in dealerSignIn:", error.message);
    throw error;
  }
  const user = data.user;

  const dealerRow = await getProfile(user.id);

  if (!dealerRow || dealerRow.role !== "dealer") {
    await supabase.auth.signOut();
    throw new Error("This account isn't registered as a dealer.");
  }

  if (dealerRow.status !== "approved") {
    await supabase.auth.signOut();
    throw new Error(
      dealerRow.status === "pending"
        ? "Your dealer account is still pending admin approval."
        : `Your dealer account is ${dealerRow.status}. Contact support for help.`,
    );
  }

  return {
    user,
    session: data.session,
    accessCodeVerified: Boolean(dealerRow.dealer_access_code_verified),
    businessName: dealerRow.business_name,
  };
}

// ---------------------------------------------------------------------------
// Agent (created by admin only — logs in with an agent_code, not an email)
// ---------------------------------------------------------------------------
const AGENT_EMAIL_DOMAIN = "agents.wellcardeals.internal";

export async function agentSignIn({ agentCode, password }) {
  const email = `${agentCode.trim().toLowerCase()}@${AGENT_EMAIL_DOMAIN}`;
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) {
    console.error("Error in agentSignIn:", error.message);
    throw new Error("Invalid agent ID or password.");
  }
  const user = data.user;

  const agentRow = await getProfile(user.id);

  if (!agentRow || agentRow.role !== "agent") {
    await supabase.auth.signOut();
    throw new Error("This account isn't registered as an agent.");
  }

  if (agentRow.status !== "approved") {
    await supabase.auth.signOut();
    throw new Error(
      `Your agent account is ${agentRow.status}. Contact admin for help.`,
    );
  }

  return { user, session: data.session, profile: agentRow };
}

// ---------------------------------------------------------------------------
// Dealer access code (post-approval SMS/WhatsApp verification)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// MANUAL SEND MODE (current, for testing — no Twilio/Meta wired up yet)
//
// Approves the dealer and generates the 6-digit code, but does NOT send
// anything automatically. The admin copies the code from the Manage
// Dealers screen and sends it themself over WhatsApp/SMS to the dealer's
// phone. Swap the calling code over to approveDealerAndSendCode() (below)
// once a real SMS/WhatsApp provider is wired into send-access-code.
// ---------------------------------------------------------------------------
export async function approveDealerManualCode(dealerId) {
  return (await backendCommand("dealer_approve", { id: dealerId })).code;
}

// Admin action: regenerate a fresh code for an already-approved dealer
// (e.g. they lost the message), again returned for manual sending.
export async function regenerateDealerManualCode(dealerId) {
  return (await backendCommand("dealer_code", { id: dealerId })).code;
}

// ---------------------------------------------------------------------------
// AUTOMATIC SEND MODE (future — once Twilio/WhatsApp Cloud API is wired up)
// ---------------------------------------------------------------------------

// Admin action: approve a dealer AND immediately generate + send them a
// fresh 6-digit access code by SMS + WhatsApp (from +91 9540102163 via
// Twilio). Call this instead of a plain status update when approving.
export async function approveDealerAndSendCode(
  dealerId,
  { channel = "both" } = {},
) {
  const { error: statusError } = await supabase
    .from("profiles")
    .update({ status: "approved" })
    .eq("id", dealerId);
  if (statusError) {
    console.error("Error approving dealer:", statusError.message);
    throw statusError;
  }

  const { error: rpcError } = await supabase.rpc(
    "generate_dealer_access_code",
    {
      p_dealer_id: dealerId,
    },
  );
  if (rpcError) {
    console.error("Error generating dealer access code:", rpcError.message);
    throw new Error(
      `Dealer approved, but generating the access code failed (${rpcError.message}).`,
    );
  }

  const { data: sendData, error: sendError } = await supabase.functions.invoke(
    "send-access-code",
    { body: { dealerId, channel } },
  );
  if (sendError) {
    console.error("Error sending dealer access code:", sendError.message);
    throw new Error(
      `Dealer approved and code generated, but sending it by SMS/WhatsApp failed (${sendError.message}). Use "Resend code" to try again.`,
    );
  }

  return sendData;
}

// Admin action: re-send (or send for the first time) the current access
// code to an already-approved dealer, e.g. if they lost the SMS/WhatsApp.
export async function resendDealerAccessCode(
  dealerId,
  { channel = "both", regenerate = true } = {},
) {
  if (regenerate) {
    const { error: rpcError } = await supabase.rpc(
      "generate_dealer_access_code",
      {
        p_dealer_id: dealerId,
      },
    );
    if (rpcError) throw rpcError;
  }

  const { data, error } = await supabase.functions.invoke("send-access-code", {
    body: { dealerId, channel },
  });
  if (error) throw error;
  return data;
}

// Dealer action: submit the code they received by SMS/WhatsApp. Returns
// true if it matched, false if it didn't (still signed in either way).
export async function verifyDealerAccessCode(code) {
  const { data, error } = await supabase.rpc("verify_dealer_access_code", {
    p_code: code,
  });
  if (error) {
    console.error("Error verifying dealer access code:", error.message);
    throw error;
  }
  return Boolean(data);
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------
// Shared login for the whole /admin portal — ADMIN, MANAGER, and TEAM LEAD
// all sign in here and land in the same portal shell (AdminLayout), with
// what they can see/do inside it then filtered by their exact role.
const STAFF_ROLES = ["admin", "manager", "team_lead"];

export async function adminSignIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) {
    console.error("Error in adminSignIn:", error.message);
    throw error;
  }
  const user = data.user;

  const profile = await getProfile(user.id);

  if (!profile || !STAFF_ROLES.includes(profile.role)) {
    await supabase.auth.signOut();
    throw new Error("This account doesn't have staff portal access.");
  }

  if (profile.status === "suspended" || profile.status === "rejected") {
    await supabase.auth.signOut();
    throw new Error("This account's access has been revoked.");
  }

  return { user, session: data.session };
}

// Admin action: issue a brand new password for ANY internal staff account
// (admin, manager, team_lead, agent) — mirrors resetDealerPassword above,
// but for staff instead of dealers. Goes through the reset-user-password
// Edge Function, which verifies the CALLER is an admin (server-side, via
// their JWT) before touching anything, then updates the target account's
// password with the service_role key. Pass a custom password, or omit it
// to get a fresh random one generated for you. The plaintext password is
// returned exactly once in the response — it is never stored anywhere —
// so copy/share it with the person immediately.
export async function resetUserPassword(userId, customPassword) {
  const { data, error } = await supabase.functions.invoke(
    "reset-user-password",
    {
      body: { userId, password: customPassword || undefined },
    },
  );
  if (error) {
    console.error("Error in resetUserPassword:", error.message);
    throw error;
  }
  if (data?.error) {
    throw new Error(data.error);
  }
  return data; // { userId, fullName, email, password }
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error("Error in signOut:", error.message);
    throw error;
  }
}
