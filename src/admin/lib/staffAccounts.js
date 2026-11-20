import {
  invokeStaffFunction,
  newStaffLoginId,
} from "../../auth/staffFunctions";

export const DEFAULT_COMPANY_EMAIL = "wcd@wellcardeals.com";

const STAFF_ID = /^STF-[A-F0-9]{12}$/i;
const ROLES = new Set(["admin", "manager", "team_lead"]);
const storageKey = (actorId) => "wcd:pending-staff-create:" + actorId;

function storageFor(storage) {
  const target = storage ?? globalThis.sessionStorage;

  if (!target) {
    throw new Error("Allow this site's session storage before creating staff.");
  }

  return target;
}

export function pendingStaffLoginId(actorId, storage) {
  if (!actorId) {
    throw new Error("Sign in before creating a staff account.");
  }

  const target = storageFor(storage);
  const existing = target.getItem(storageKey(actorId));

  if (existing && STAFF_ID.test(existing)) return existing.toUpperCase();

  const next = newStaffLoginId();
  target.setItem(storageKey(actorId), next);

  return next;
}

export function clearPendingStaff(actorId, staffLoginId, storage) {
  try {
    const target = storageFor(storage);

    if (target.getItem(storageKey(actorId)) === staffLoginId) {
      target.removeItem(storageKey(actorId));
    }
  } catch {
    // Local cleanup cannot undo a confirmed account creation.
  }
}

export async function createStaffAccount(client, input, actorId, storage) {
  const fullName = String(input.fullName ?? "").trim();
  const companyEmail = String(input.companyEmail ?? "").trim().toLowerCase();
  const staffLoginId = String(input.staffLoginId ?? "").trim().toUpperCase();

  if (!actorId) {
    throw new Error("Sign in before creating a staff account.");
  }

  if (!fullName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(companyEmail)) {
    throw new Error("Full name and a valid company contact email are required.");
  }

  if (!ROLES.has(input.role) || !STAFF_ID.test(staffLoginId)) {
    throw new Error("Select a staff role and use the generated Staff ID.");
  }

  const target = storageFor(storage);
  const pending = target.getItem(storageKey(actorId));

  if (pending && pending.toUpperCase() !== staffLoginId) {
    throw new Error("Review the pending Staff ID before starting another account.");
  }

  // Store only the Staff ID; passwords and personal data are not persisted.
  target.setItem(storageKey(actorId), staffLoginId);

  const { data, error } = await invokeStaffFunction(
    client,
    "create-staff-user",
    {
      body: {
        fullName,
        email: companyEmail,
        companyEmail,
        staffLoginId,
        phone: String(input.phone ?? "").trim() || null,
        role: input.role,
        password: input.password || undefined,
      },
    },
    {
      expectedActorId: actorId,
      retryAuthentication: true,
    },
  );

  if (error) {
    error.staffLoginId ||= staffLoginId;
    throw error;
  }

  if (
    !data?.userId
    || data.staffLoginId !== staffLoginId
    || data.loginId !== staffLoginId
    || data.companyEmail !== companyEmail
    || data.fullName !== fullName
    || data.role !== input.role
    || data.status !== "approved"
    || typeof data.password !== "string"
    || !data.password
  ) {
    throw Object.assign(
      new Error(
        "The account result could not be confirmed. Check this Staff ID before retrying; an account may already exist.",
      ),
      {
        code: "STAFF_CONFIRMATION_UNAVAILABLE",
        staffLoginId,
      },
    );
  }

  clearPendingStaff(actorId, staffLoginId, target);

  return data;
}
