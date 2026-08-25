// ---------------------------------------------------------------------------
// Tracks the current browser's dealer application status.
//
// Context: a submitted dealer application (see authApi.submitDealerApplication)
// does NOT create a password, an auth.users account, or a session — by
// design, per the registration requirements. That means there is no
// `useAuth()` role to check for a pending applicant.
//
// To still be able to show "Application Under Review" on the Home page and
// gate Live Auctions / Bid / Dealer Dashboard for that same browser/person
// right after they apply, we keep a small local marker. It is intentionally
// NOT a credential: it carries no password, no dealer ID, and grants no
// access anywhere — it only flags "this browser recently submitted a
// pending application" so the UI can be honest about it.
// ---------------------------------------------------------------------------

const STORAGE_KEY = "wcd_dealer_application_status";
const EVENT_NAME = "wcd:dealer-application-status-change";

export function saveDealerApplicationPending({ email, businessName } = {}) {
  const payload = {
    status: "pending",
    email: email || null,
    businessName: businessName || null,
    submittedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Storage can fail (private browsing, quota, etc). Non-fatal.
  }
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: payload }));
  return payload;
}

export function getDealerApplicationStatus() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearDealerApplicationStatus() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: null }));
}

export function isDealerApplicationPending() {
  return getDealerApplicationStatus()?.status === "pending";
}

export const DEALER_APPLICATION_EVENT = EVENT_NAME;
