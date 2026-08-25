import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

/**
 * Used ONLY nested inside <AdminRoute> (see App.jsx) — AdminRoute already
 * guarantees a signed-in admin/manager/team_lead by the time this runs, so
 * this doesn't repeat the loading/session checks. It just narrows which of
 * those three roles can reach a specific page.
 *
 * TEAM LEAD is read-only oversight (dashboards, dealers, inventory) — it is
 * never added to `allow` for the operational pages (Add Car, Live Bids,
 * Negotiate, Buy Requests, Sell Requests, Manage Agents, Dropdown Settings,
 * Manage Users). Wrong-role staff get bounced to /admin rather than
 * /unauthorized, since they DO belong in the portal, just not on this page.
 *
 * Usage:
 *   <Route path="add-car" element={<StaffOnly allow={["admin","manager"]}><AddCarPage /></StaffOnly>} />
 */
export default function StaffOnly({ allow, children }) {
  const { role } = useAuth();

  if (!allow.includes(role)) {
    return <Navigate to="/admin" replace />;
  }

  return children;
}
