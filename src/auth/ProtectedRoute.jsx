
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import DealerPendingGate from "./DealerPendingGate";

/**
 * Authentication and role protection.
 *
 * Dealer access:
 * - Pending/rejected/suspended dealers are blocked.
 * - Approved dealers can access dealer pages without
 *   the old SMS/WhatsApp verification code.
 *
 * Admin, Manager, TL, Buyer and Agent role protection
 * remains unchanged.
 */
export default function ProtectedRoute({
  allowedRoles,
  loginPath = "/login",
  unauthorizedPath = "/unauthorized",
  children,
}) {
  const { session, role: myRole, dealerStatus, loading } = useAuth();
  const location = useLocation();

  if (loading || session === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-400">
        Loading...
      </div>
    );
  }

  if (!session) {
    return (
      <Navigate
        to={loginPath}
        replace
        state={{ from: location }}
      />
    );
  }

  if (!allowedRoles?.includes(myRole)) {
    return <Navigate to={unauthorizedPath} replace />;
  }

  if (myRole === "dealer" && allowedRoles.includes("dealer")) {
    if (dealerStatus !== "approved") {
      return <DealerPendingGate />;
    }
  }

  return children;
}
