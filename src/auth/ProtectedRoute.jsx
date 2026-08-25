import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import DealerPendingGate from "./DealerPendingGate";

/**
 * Generic auth + role gate for React Router v6.
 *
 * - Still loading the auth/profile listener  -> render a loading state,
 *   never a redirect (redirecting before `role` resolves would bounce a
 *   legit admin to /login on every refresh).
 * - Not authenticated                        -> redirect to `loginPath`.
 * - Authenticated but role not in `allowedRoles` -> redirect to
 *   `unauthorizedPath` (defaults to /unauthorized), not the page they tried
 *   to reach — don't leak that a route exists to someone who can't use it.
 * - Dealer, but not yet approved              -> redirect to /dealer/pending
 *   instead of the dashboard (only applies when "dealer" is an allowed role).
 *
 * Usage:
 *   <ProtectedRoute allowedRoles={["buyer"]} loginPath="/login">
 *     <BuyerLayout />
 *   </ProtectedRoute>
 */
export default function ProtectedRoute({
  allowedRoles,
  loginPath = "/login",
  unauthorizedPath = "/unauthorized",
  children,
}) {
  const { session, role: myRole, profile, dealerStatus, dealerAccessCodeVerified, loading } =
    useAuth();
  const location = useLocation();

  if (loading || session === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-400">
        Loading...
      </div>
    );
  }

  if (!session) {
    return <Navigate to={loginPath} replace state={{ from: location }} />;
  }

  if (!allowedRoles.includes(myRole)) {
    return <Navigate to={unauthorizedPath} replace />;
  }

  if (myRole === "dealer" && allowedRoles.includes("dealer")) {
    if (dealerStatus !== "approved") {
      return <DealerPendingGate />;
    }
    // Approved, but hasn't entered the SMS/WhatsApp access code yet —
    // block the dashboard/live-auctions until they do. Only applies to
    // dealers who came through the OLD dealerRegister() flow, which is the
    // only one that ever sets dealer_access_code. Phase 6/7 Dealer ID
    // dealers never get one, so they must not be stuck here.
    if (
      profile?.dealer_access_code &&
      !dealerAccessCodeVerified &&
      location.pathname !== "/dealer/verify-code"
    ) {
      return <Navigate to="/dealer/verify-code" replace />;
    }
  }

  return children;
}
