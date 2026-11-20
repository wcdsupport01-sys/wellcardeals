import { readPages } from "../lib/readPages";
import { backendCommand } from "../lib/backendCommands";
import { supabase } from "../lib/supabaseClient";
import { invokeStaffFunction, staffLoginEmail } from "./staffFunctions";

async function getProfile(userId, signal) {
  const query = supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  const { data, error } = await (
    signal ? query.abortSignal(signal) : query
  );

  if (error) throw error;
  return data;
}

async function recordSignup() {
  try {
    await supabase.functions.invoke("record-signup");
  } catch (error) {
    console.warn("record-signup failed (non-fatal):", error);
  }
}

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
      "Account was created but profile setup failed (" +
      profileError.message + "). Please contact support.",
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
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    console.error("Error in updatePassword:", error.message);
    throw error;
  }
}

export async function ensureBuyerProfile(user, signal) {
  if (!user) return;
  if (user.app_metadata?.staff_login_id) return;

  const existing = await getProfile(user.id, signal);
  if (existing) return;

  const isDealer = user.user_metadata?.signup_role === "dealer";

  const insert = supabase.from("profiles").insert({
    id: user.id,
    role: isDealer ? "dealer" : "buyer",
    status: isDealer ? "pending" : "approved",
    business_name: isDealer
      ? user.user_metadata?.business_name || null
      : null,
    email: user.email || null,
    full_name:
      user.user_metadata?.full_name || user.user_metadata?.name || null,
    phone: user.user_metadata?.phone || null,
  });

  const { error } = await (
    signal ? insert.abortSignal(signal) : insert
  );

  if (error && error.code !== "23505") throw error;
}

export async function signUpUser({
  role,
  email,
  password,
  fullName,
  phone,
  businessName,
}) {
  if (role !== "buyer" && role !== "dealer") {
    throw new Error('signUpUser: unsupported role "' + role + '"');
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

  const row = role === "buyer"
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
    console.error(
      "Error creating " + role + " profile row:",
      profileError.message,
    );

    throw new Error(
      "Account was created but profile setup failed (" +
      profileError.message + "). Please contact support.",
    );
  }

  await recordSignup();
  return { user, session: data.session };
}

export async function submitDealerApplication({
  businessName,
  dealerName,
  businessAddress,
  mobileNumber,
  email,
}) {
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

export async function fetchDealerApplications(status = "pending") {
  return readPages(() => {
    let query = supabase
      .from("dealer_applications")
      .select("*", { count: "exact" });

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    return query;
  });
}

export async function setDealerApplicationStatus(id, status) {
  if (status !== "rejected") {
    throw new Error(
      "Use verified approval to approve a dealer application.",
    );
  }

  const { data, error } = await supabase
    .from("dealer_applications")
    .update({ status })
    .eq("id", id)
    .eq("status", "pending")
    .select()
    .maybeSingle();

  if (error) {
    console.error("Error in setDealerApplicationStatus:", error.message);
    throw error;
  }

  if (!data || data.id !== id || data.status !== status) {
    throw new Error(
      "This application is no longer pending. Reload applications before reviewing it.",
    );
  }

  return data;
}

export async function approveDealerApplication(id) {
  const { data, error } = await supabase.functions.invoke(
    "approve-dealer-application",
    { body: { applicationId: id } },
  );

  if (error || data?.error) {
    let detail = data;

    try {
      if (error?.context?.clone) {
        detail = await error.context.clone().json();
      }
    } catch {
      // Keep the transport error.
    }

    const failure = new Error(
      detail?.error || error?.message || "Dealer approval unavailable.",
    );

    if (detail?.provisioningUserId) {
      failure.provisioningUserId = detail.provisioningUserId;
    }

    throw failure;
  }

  if (
    !data?.ok ||
    data.id !== id ||
    data.status !== "approved" ||
    !data.dealer_id ||
    !data.auth_user_id
  ) {
    throw new Error(
      "Approval could not be verified. Reload the application before retrying.",
    );
  }

  return data;
}

export async function rejectDealerApplication(id) {
  return setDealerApplicationStatus(id, "rejected");
}

export async function dealerRegister({ email, password, profile, files }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    console.error("Error in dealerRegister:", error.message);
    throw error;
  }

  const userId = data.user?.id;
  if (!userId) throw new Error("Could not create account.");

  async function uploadIfPresent(file, name) {
    if (!file) return null;

    const ext = file.name.split(".").pop();
    const path = userId + "/" + name + "." + ext;

    const { error: uploadError } = await supabase.storage
      .from("dealer-docs")
      .upload(path, file, { upsert: true });

    if (uploadError) throw uploadError;

    return "storage://dealer-docs/" + path;
  }

  try {
    const [licenseUrl, profileImageUrl, businessLogoUrl] = await Promise.all([
      uploadIfPresent(files.license, "license"),
      uploadIfPresent(files.profileImage, "profile-image"),
      uploadIfPresent(files.businessLogo, "business-logo"),
    ]);

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
  } catch (failure) {
    console.error("Error in dealerRegister:", failure.message);
    throw failure;
  }

  await recordSignup();
  return { user: data.user, session: data.session };
}

export async function dealerLoginLookup(identifier) {
  const { data, error } = await supabase.functions.invoke(
    "dealer-login-lookup",
    {
      body: {
        identifier: String(identifier || "").trim(),
      },
    },
  );

  if (error) {
    console.error("Error in dealerLoginLookup:", error.message);
    throw new Error(
      "Couldn't look up that Dealer ID / email. Please try again.",
    );
  }

  if (data?.error) throw new Error(data.error);

  return data;
}

export async function dealerSignInWithIdentifier({
  identifier,
  password,
}) {
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
      "Your dealer account is " +
      lookup.status +
      ". Contact support for help.",
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
      "Your dealer account is " +
      dealerRow.status +
      ". Contact support for help.",
    );
  }

  return {
    user,
    session: data.session,
    businessName: dealerRow.business_name,
    dealerId: dealerRow.dealer_id,
  };
}

export async function resetDealerPassword(dealerId, customPassword) {
  const { data, error } = await supabase.functions.invoke(
    "reset-dealer-password",
    {
      body: {
        dealerId,
        password: customPassword || undefined,
      },
    },
  );

  if (error) {
    console.error("Error in resetDealerPassword:", error.message);
    throw error;
  }

  if (data?.error) throw new Error(data.error);

  return data;
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
        : "Your dealer account is " +
          dealerRow.status +
          ". Contact support for help.",
    );
  }

  return {
    user,
    session: data.session,
    accessCodeVerified: Boolean(dealerRow.dealer_access_code_verified),
    businessName: dealerRow.business_name,
  };
}

const AGENT_EMAIL_DOMAIN = "agents.wellcardeals.internal";

export async function agentSignIn({ agentCode, password }) {
  const identifier = String(agentCode ?? "").trim();
  const staffEmail = staffLoginEmail(identifier);
  const email =
    staffEmail ||
    identifier.toLowerCase() + "@" + AGENT_EMAIL_DOMAIN;

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new Error("Invalid agent ID or password.");
  }

  const user = data?.user;

  if (!user?.id || !data.session) {
    throw new Error("Login could not be confirmed. Please sign in again.");
  }

  const agentRow = await getProfile(user.id);

  if (
    !agentRow ||
    agentRow.role !== "agent" ||
    (
      staffEmail &&
      String(agentRow.staff_login_id || "").toUpperCase() !==
        identifier.toUpperCase()
    )
  ) {
    await supabase.auth.signOut();
    throw new Error("This account isn't registered as an agent.");
  }

  if (agentRow.status !== "approved") {
    await supabase.auth.signOut();

    throw new Error(
      "Your agent account is " +
      agentRow.status +
      ". Contact admin for help.",
    );
  }

  return { user, session: data.session, profile: agentRow };
}

export async function approveDealerManualCode(dealerId) {
  return (await backendCommand("dealer_approve", { id: dealerId })).code;
}

export async function regenerateDealerManualCode(dealerId) {
  return (await backendCommand("dealer_code", { id: dealerId })).code;
}

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
    { p_dealer_id: dealerId },
  );

  if (rpcError) {
    console.error("Error generating dealer access code:", rpcError.message);

    throw new Error(
      "Dealer approved, but generating the access code failed (" +
      rpcError.message +
      ").",
    );
  }

  const { data: sendData, error: sendError } =
    await supabase.functions.invoke(
      "send-access-code",
      { body: { dealerId, channel } },
    );

  if (sendError) {
    console.error("Error sending dealer access code:", sendError.message);

    throw new Error(
      "Dealer approved and code generated, but sending it by SMS/WhatsApp failed (" +
      sendError.message +
      '). Use "Resend code" to try again.',
    );
  }

  return sendData;
}

export async function resendDealerAccessCode(
  dealerId,
  { channel = "both", regenerate = true } = {},
) {
  if (regenerate) {
    const { error: rpcError } = await supabase.rpc(
      "generate_dealer_access_code",
      { p_dealer_id: dealerId },
    );

    if (rpcError) throw rpcError;
  }

  const { data, error } = await supabase.functions.invoke(
    "send-access-code",
    { body: { dealerId, channel } },
  );

  if (error) throw error;

  return data;
}

export async function verifyDealerAccessCode(code) {
  const { data, error } = await supabase.rpc(
    "verify_dealer_access_code",
    { p_code: code },
  );

  if (error) {
    console.error("Error verifying dealer access code:", error.message);
    throw error;
  }

  return Boolean(data);
}

const STAFF_ROLES = ["admin", "manager", "team_lead"];

export async function adminSignIn({ email, password }) {
  const identifier = String(email ?? "").trim();
  const staffEmail = staffLoginEmail(identifier);

  const { data, error } = await supabase.auth.signInWithPassword({
    email: staffEmail || identifier,
    password,
  });

  if (error) throw error;

  const user = data?.user;

  if (!user?.id || !data.session) {
    throw new Error("Login could not be confirmed. Please sign in again.");
  }

  const profile = await getProfile(user.id);

  if (
    !profile ||
    !STAFF_ROLES.includes(profile.role) ||
    (
      staffEmail &&
      String(profile.staff_login_id || "").toUpperCase() !==
        identifier.toUpperCase()
    )
  ) {
    await supabase.auth.signOut();
    throw new Error("This account doesn't have staff portal access.");
  }

  if (profile.status === "suspended" || profile.status === "rejected") {
    await supabase.auth.signOut();
    throw new Error("This account's access has been revoked.");
  }

  return { user, session: data.session };
}

export async function resetUserPassword(
  userId,
  customPassword,
  options = {},
) {
  if (typeof userId !== "string" || !userId) {
    throw new Error("Select a staff account to reset.");
  }

  const { data, error } = await invokeStaffFunction(
    supabase,
    "reset-user-password",
    {
      body: {
        userId,
        password: customPassword || undefined,
      },
    },
    {
      expectedActorId: options.expectedActorId,
      retryAuthentication: true,
    },
  );

  if (error) throw error;

  if (
    data?.userId !== userId ||
    typeof data.password !== "string" ||
    !data.password
  ) {
    throw new Error(
      "The password reset result could not be confirmed. " +
      "The password may have changed; reopen the staff account before trying again.",
    );
  }

  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error("Error in signOut:", error.message);
    throw error;
  }
}
