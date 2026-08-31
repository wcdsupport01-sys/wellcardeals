import { NavLink, Outlet, useNavigate, Link } from "react-router-dom";
import { LayoutDashboard, PlusSquare, ListTree, Car, LogOut, Users, UserCog, Gavel, Handshake, ShoppingCart, FileText, Home, Boxes, ShieldCheck, ClipboardList, UserCheck, Mail } from "lucide-react";
import { useAuth } from "../auth/AuthContext";

// `roles` = which of admin / manager / team_lead see this item. Keeping the
// visibility rule right next to each link (instead of a second filtered
// list elsewhere) is what keeps the sidebar and the actual route guards
// (StaffOnly, in App.jsx) from silently drifting apart.
//
// Team Lead mirrors Manager's access except: Manage Dealers, Dealer
// Applications, Manage Agents, and Manage Users — those stay
// admin/manager-only.
const NAV = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true, roles: ["admin", "manager", "team_lead"] },
  { to: "/admin/inventory", label: "Inventory", icon: Boxes, roles: ["admin", "manager", "team_lead"] },
  { to: "/admin/add-car", label: "Add Car", icon: PlusSquare, roles: ["admin", "manager", "team_lead"] },
  { to: "/admin/bids", label: "Live Bids", icon: Gavel, roles: ["admin", "manager", "team_lead"] },
  { to: "/admin/negotiate", label: "Negotiate", icon: Handshake, roles: ["admin", "manager", "team_lead"] },
  { to: "/admin/buy-requests", label: "Buy Now Requests", icon: ShoppingCart, roles: ["admin", "manager", "team_lead"] },
  { to: "/admin/auction-requests", label: "Sell Requests", icon: FileText, roles: ["admin", "manager", "team_lead"] },
  { to: "/admin/agent-submissions", label: "Agent Submissions", icon: UserCheck, roles: ["admin", "manager", "team_lead"] },
  { to: "/admin/enquiries", label: "Enquiries", icon: Mail, roles: ["admin", "manager", "team_lead"] },
  { to: "/admin/dealers", label: "Manage Dealers", icon: Users, roles: ["admin", "manager"] },
  { to: "/admin/dealer-applications", label: "Dealer Applications", icon: ClipboardList, roles: ["admin", "manager"] },
  { to: "/admin/agents", label: "Manage Agents", icon: UserCog, roles: ["admin"] },
  { to: "/admin/users", label: "Manage Users", icon: ShieldCheck, roles: ["admin"] },
  { to: "/admin/lookups", label: "Dropdown Settings", icon: ListTree, roles: ["admin", "manager", "team_lead"] },
];

const ROLE_LABEL = {
  admin: "Admin Portal",
  manager: "Manager Portal",
  team_lead: "Team Lead Portal",
};

export default function AdminLayout() {
  const { profile, role, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate("/admin-login", { replace: true });
  }

  const visibleNav = NAV.filter((item) => item.roles.includes(role));
  const portalLabel = ROLE_LABEL[role] || "Admin Portal";

  return (
    <div className="min-h-screen bg-[#0B1120] text-white flex">
      <aside className="w-64 shrink-0 border-r border-white/10 bg-[#0B1120] hidden md:flex flex-col">
        <div className="px-6 py-6 flex items-center gap-2 border-b border-white/10">
          <Car className="text-blue-400" size={22} />
          <span className="font-semibold tracking-tight">{portalLabel}</span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          <Link
            to="/"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-zinc-400 hover:bg-white/5 hover:text-white mb-1"
          >
            <Home size={18} /> Back to Home
          </Link>
          {visibleNav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition ${
                  isActive
                    ? "bg-blue-600/20 text-blue-400 font-medium"
                    : "text-zinc-400 hover:bg-white/5 hover:text-white"
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="px-4 py-4 border-t border-white/10 flex items-center justify-between">
          <span className="text-sm text-zinc-400 truncate">{profile?.full_name || portalLabel}</span>
          <button onClick={handleSignOut} className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-red-400 shrink-0">
            <LogOut size={16} />
          </button>
        </div>
      </aside>
      <main className="flex-1 min-w-0">
        <div className="md:hidden flex items-center gap-2 px-4 py-4 border-b border-white/10">
          <LayoutDashboard className="text-blue-400" size={20} />
          <span className="font-semibold">{portalLabel}</span>
        </div>
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
