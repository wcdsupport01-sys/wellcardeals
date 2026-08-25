import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";

/**
 * Enforces portal isolation.
 * - Not logged in -> redirect to that portal's own login page.
 * - Logged in but wrong role (e.g. a buyer hitting /dealer/*) -> redirect to
 *   their own portal, never to the page they tried to reach.
 * - Dealer logged in but not yet approved -> sent to the pending screen
 *   instead of the dashboard.
 */
export default function RequireRole({ role, loginPath, children }) {
  const { session, role: myRole, dealerStatus, dealerAccessCodeVerified, loading } = useAuth();
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

  if (myRole !== role) {
    // Signed in, but as the wrong kind of account — send them home rather
    // than leaking that this page even exists.
    const fallback = myRole === "admin" ? "/admin" : myRole === "dealer" ? "/dealer/dashboard" : "/";
    return <Navigate to={fallback} replace />;
  }

  if (role === "dealer") {
    if (dealerStatus !== "approved") {
      return <Navigate to="/dealer/pending" replace />;
    }
    if (!dealerAccessCodeVerified && location.pathname !== "/dealer/verify-code") {
      return <Navigate to="/dealer/verify-code" replace />;
    }
  }

  return children;
}
