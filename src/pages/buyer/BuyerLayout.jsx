import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useNavigate, Link } from "react-router-dom";
import {
  LayoutDashboard,
  ShoppingCart,
  Tag,
  ClipboardList,
  Package,
  Heart,
  MessageSquare,
  User,
  Settings,
  HelpCircle,
  Search,
  Bell,
  ChevronDown,
  LogOut,
  Menu,
  X,
  Home,
} from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import logo from "../../assets/logo1-real.png";

// Items inside the buyer portal (rendered through this layout's <Outlet />).
const PORTAL_NAV = [
  { to: "/buyer/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/buyer/my-listings", label: "My Listings", icon: ClipboardList },
  { to: "/buyer/orders", label: "My Orders", icon: Package },
  { to: "/buyer/saved-cars", label: "Saved Cars", icon: Heart },
  { to: "/buyer/messages", label: "Messages", icon: MessageSquare },
  { to: "/buyer/profile", label: "Profile", icon: User },
  { to: "/buyer/settings", label: "Settings", icon: Settings },
  { to: "/buyer/help", label: "Help & Support", icon: HelpCircle },
];

// Items that live on the public site (outside this layout) — clicking these
// takes the buyer out of the portal shell, same as clicking them in the navbar.
const EXTERNAL_NAV = [
  { to: "/buy-car", label: "Buy Cars", icon: ShoppingCart },
  { to: "/sell-car", label: "Sell My Car", icon: Tag },
];

const ORDERED_NAV = [PORTAL_NAV[0], EXTERNAL_NAV[0], EXTERNAL_NAV[1], ...PORTAL_NAV.slice(1)];

export default function BuyerLayout() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [search, setSearch] = useState("");
  const menuRef = useRef(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function handleSignOut() {
    await signOut();
    navigate("/login", { replace: true });
  }

  function handleSearch(e) {
    e.preventDefault();
    navigate(search.trim() ? `/buy-car?q=${encodeURIComponent(search.trim())}` : "/buy-car");
  }

  const displayName = profile?.full_name || "Buyer";
  const initial = displayName.trim().charAt(0).toUpperCase() || "B";

  const SidebarContent = (
    <>
      <NavLink to="/" className="flex items-center gap-2.5 px-6 py-6 shrink-0">
        <img src={logo} alt="WellCarDeals" className="h-8 w-8 object-contain" />
        <span className="flex flex-col leading-none">
          <span className="text-[15px] font-bold tracking-tight text-navy-900 font-display">
            WELL <span className="text-brand">CARS</span> DEAL
          </span>
          <span className="text-[8px] font-semibold tracking-[0.15em] text-gray-400 uppercase">
            Buy | Sell | Drive
          </span>
        </span>
      </NavLink>

      <nav className="flex-1 overflow-y-auto px-3 pb-4 space-y-1">
        <NavLink
          to="/"
          onClick={() => setMobileNavOpen(false)}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-navy-900/5 hover:text-navy-900 mb-1"
        >
          <Home size={18} />
          Back to Home
        </NavLink>
        {ORDERED_NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end
            onClick={() => setMobileNavOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                isActive
                  ? "bg-brand text-white shadow-soft"
                  : "text-gray-500 hover:bg-navy-900/5 hover:text-navy-900"
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>
    </>
  );

  return (
    <div className="min-h-screen bg-surface text-navy-900">
      <div className="flex">
        {/* -------- Sidebar (desktop) -------- */}
        <aside className="hidden lg:flex lg:flex-col w-64 shrink-0 min-h-screen border-r border-navy-900/8 bg-white sticky top-0">
          {SidebarContent}
        </aside>

        {/* -------- Sidebar (mobile drawer) -------- */}
        {mobileNavOpen && (
          <div className="lg:hidden fixed inset-0 z-40 flex">
            <div className="absolute inset-0 bg-navy-900/40" onClick={() => setMobileNavOpen(false)} />
            <aside className="relative z-10 w-64 flex flex-col min-h-screen bg-white shadow-floating">
              <button
                onClick={() => setMobileNavOpen(false)}
                className="absolute top-5 right-4 text-gray-400 hover:text-navy-900"
              >
                <X size={20} />
              </button>
              {SidebarContent}
            </aside>
          </div>
        )}

        {/* -------- Main column -------- */}
        <div className="flex-1 min-w-0">
          <header className="sticky top-0 z-30 bg-white border-b border-navy-900/8">
            <div className="px-4 md:px-8 py-3.5 flex items-center gap-4">
              <button
                onClick={() => setMobileNavOpen(true)}
                className="lg:hidden shrink-0 text-gray-500 hover:text-navy-900"
              >
                <Menu size={22} />
              </button>

              <Link
                to="/"
                className="hidden sm:flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-navy-900 border border-navy-900/8 bg-surface-muted rounded-xl px-3.5 py-2.5 shrink-0"
              >
                <Home size={16} /> Back to Home
              </Link>

              <form onSubmit={handleSearch} className="flex-1 max-w-md">
                <div className="flex items-center gap-2 bg-surface-muted border border-navy-900/8 rounded-xl px-3.5 py-2.5">
                  <Search size={16} className="text-gray-400 shrink-0" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search for cars, brands, models..."
                    className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
                  />
                </div>
              </form>

              <div className="ml-auto flex items-center gap-3 md:gap-5 shrink-0">
                <button
                  type="button"
                  className="relative text-gray-500 hover:text-navy-900 transition"
                  aria-label="Notifications"
                >
                  <Bell size={20} />
                </button>

                <div className="relative" ref={menuRef}>
                  <button
                    onClick={() => setMenuOpen((v) => !v)}
                    className="flex items-center gap-2.5 py-1 pl-1 pr-2 rounded-full hover:bg-navy-900/5 transition"
                  >
                    {profile?.profile_image_url ? (
                      <img
                        src={profile.profile_image_url}
                        alt={displayName}
                        className="h-9 w-9 rounded-full object-cover border border-navy-900/8"
                      />
                    ) : (
                      <span className="h-9 w-9 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center text-sm font-bold">
                        {initial}
                      </span>
                    )}
                    <span className="hidden sm:flex flex-col items-start leading-tight">
                      <span className="text-sm font-semibold text-navy-900">{displayName}</span>
                      <span className="text-[11px] text-gray-400">Buyer</span>
                    </span>
                    <ChevronDown size={16} className="hidden sm:block text-gray-400" />
                  </button>

                  {menuOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-white border border-navy-900/8 rounded-xl shadow-lift py-1.5 z-40">
                      <p className="px-3.5 py-2 text-xs text-gray-400 truncate border-b border-navy-900/8 mb-1">
                        {user?.email}
                      </p>
                      <NavLink
                        to="/buyer/profile"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2 px-3.5 py-2 text-sm text-gray-600 hover:bg-surface-muted hover:text-navy-900"
                      >
                        <User size={15} /> Profile
                      </NavLink>
                      <NavLink
                        to="/buyer/settings"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2 px-3.5 py-2 text-sm text-gray-600 hover:bg-surface-muted hover:text-navy-900"
                      >
                        <Settings size={15} /> Settings
                      </NavLink>
                      <button
                        onClick={handleSignOut}
                        className="w-full flex items-center gap-2 px-3.5 py-2 text-sm text-red-500 hover:bg-red-50"
                      >
                        <LogOut size={15} /> Sign out
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </header>

          <main className="px-4 md:px-8 py-6 md:py-8 max-w-7xl">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
