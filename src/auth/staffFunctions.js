const STAFF_ID = /^STF-[A-F0-9]{12}$/i;
const STAFF_DOMAIN = "staff.wellcardeals.internal";
const refreshes = new WeakMap();

export function staffLoginEmail(identifier) {
  const value = String(identifier ?? "").trim();

  return STAFF_ID.test(value)
    ? value.toLowerCase() + "@" + STAFF_DOMAIN
    : null;
}

export function newStaffLoginId() {
  return "STF-" + crypto.randomUUID()
    .replaceAll("-", "")
    .slice(0, 12)
    .toUpperCase();
}

async function refreshOnce(client) {
  let pending = refreshes.get(client);

  if (!pending) {
    pending = Promise.resolve().then(() => client.auth.refreshSession());
    refreshes.set(client, pending);

    pending.finally(() => {
      if (refreshes.get(client) === pending) refreshes.delete(client);
    }).catch(() => {});
  }

  return pending;
}

function checkedSession(result, expectedActorId) {
  if (result?.error) throw result.error;

  const session = result?.data?.session;

  if (!session?.access_token || !session.user?.id) {
    throw Object.assign(
      new Error("Your login session is unavailable. Sign in again before retrying."),
      { code: "AUTH_SESSION_REQUIRED" },
    );
  }

  if (expectedActorId && session.user.id !== expectedActorId) {
    throw Object.assign(
      new Error("The signed-in account changed. Reload this page before continuing."),
      { code: "AUTH_ACCOUNT_CHANGED" },
    );
  }

  return session;
}

async function failureDetail(error, data) {
  try {
    if (error?.context?.clone) {
      const detail = await error.context.clone().json();
      if (detail && typeof detail === "object") return detail;
    }
  } catch {
    // Keep the available SDK response when the body is not JSON.
  }

  return data && typeof data === "object" ? data : null;
}

function invocationError(error, detail) {
  const message = typeof detail?.error === "string"
    ? detail.error
    : typeof detail?.message === "string"
      ? detail.message
      : error?.message || "The request could not be completed.";

  const failure = new Error(message);
  const status = error?.context?.status ?? error?.status;

  if (typeof status === "number") failure.status = status;

  for (const key of ["code", "staffLoginId", "userId"]) {
    if (typeof detail?.[key] === "string") failure[key] = detail[key];
  }

  return failure;
}

function rejectedBeforeWrite(error, detail) {
  const status = error?.context?.status ?? error?.status;

  if (status !== 401) return false;

  return detail?.code === "SESSION_TOKEN_MISSING"
    || detail?.code === "SESSION_VERIFICATION_FAILED"
    || detail?.error === "Not authenticated."
    || (detail?.message === "Invalid JWT" && !detail?.error);
}

export async function invokeStaffFunction(
  client, name, options = {}, settings = {},
) {
  try {
    let session = checkedSession(
      await client.auth.getSession(),
      settings.expectedActorId,
    );

    const actorId = session.user.id;

    if (session.expires_at && session.expires_at <= Date.now() / 1000 + 30) {
      session = checkedSession(await refreshOnce(client), actorId);
    }

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const headers = new Headers(options.headers);
      headers.set("Authorization", "Bearer " + session.access_token);

      const result = await client.functions.invoke(name, {
        ...options,
        headers: Object.fromEntries(headers.entries()),
      });

      if (!result.error && !result.data?.error) return result;

      const detail = await failureDetail(result.error, result.data);

      if (
        attempt === 0
        && settings.retryAuthentication
        && rejectedBeforeWrite(result.error, detail)
      ) {
        session = checkedSession(await refreshOnce(client), actorId);
        continue;
      }

      return { data: null, error: invocationError(result.error, detail) };
    }
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error
        ? error
        : new Error("The request could not be completed."),
    };
  }
}
