import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";

// The three roles that share the /admin portal shell. Exactly what each one
// can see/do inside that shell is then filtered by exact role — in
// AdminLayout's nav, in StaffOnly (below) per sub-route, and in individual
// pages hiding their own action buttons for 'team_lead'.
export const STAFF_ROLES = ["admin", "manager", "team_lead"];

/**
 * Strict staff gate for the /admin portal.
 *
 * Deliberately not just `<ProtectedRoute allowedRoles={STAFF_ROLES} />` —
 * it's a separate component so the one condition that actually matters
 * (`STAFF_ROLES.includes(role)`) is explicit and easy to audit on its own,
 * without having to reason about the dealer-approval branch in
 * ProtectedRoute.
 *
 * `role` here comes from AuthContext's live Postgres realtime subscription
 * on `profiles/{uid}` (see src/auth/AuthContext.jsx) — it re-evaluates
 * instantly if that row is ever changed (e.g. an admin revokes someone's
 * access, or demotes a manager back to a dealer, mid-session).
 *
 * Not signed in                 -> /admin-login
 * Signed in, not admin/manager/
 * team_lead                     -> /unauthorized (never /admin-login — no
 *                                   reason to hint that a staff portal
 *                                   exists to them)
 */
export default function AdminRoute({ children }) {
  const { session, role, loading } = useAuth();
  const location = useLocation();

  if (loading || session === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-400">
        Loading...
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/admin-login" replace state={{ from: location }} />;
  }

  if (!STAFF_ROLES.includes(role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}
