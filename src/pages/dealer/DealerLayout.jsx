import { useState } from "react";
import { NavLink, Outlet, useNavigate, Link } from "react-router-dom";
import {
  Car,
  LogOut,
  LayoutDashboard,
  ShoppingBag,
  Gavel,
  User,
  Search,
  Menu,
  X,
  LifeBuoy,
  Home,
} from "lucide-react";
import { useAuth } from "../../auth/AuthContext";

// Only real, working routes — no placeholder "coming soon" items.
const NAV = [
  { to: "/dealer/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/buy-car", label: "Buy Cars", icon: ShoppingBag },
  { to: "/live-auctions", label: "Live Auctions", icon: Gavel },
  { to: "/dealer/profile", label: "Profile", icon: User },
];

function SidebarContent({ onNavigate }) {
  return (
    <>
      <Link to="/" className="flex items-center gap-2 px-6 py-6">
        <Car className="text-[#1E4FD9]" size={24} />
        <div className="leading-tight">
          <p className="font-extrabold text-[#0B2545] text-sm tracking-tight">WELL CARS DEAL</p>
          <p className="text-[9px] text-[#93A0BD] tracking-wide">TRUST • TRANSPARENCY • TECHNOLOGY</p>
        </div>
      </Link>

      <nav className="flex-1 overflow-y-auto px-3 space-y-1">
        <NavLink
          to="/"
          onClick={onNavigate}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#4B5A78] hover:bg-[#F1F4FB] mb-1"
        >
          <Home size={17} /> Back to Home
        </NavLink>
        {NAV.map(({ to, label, icon: Icon, soon }) =>
          soon ? (
            <div
              key={label}
              title="Coming soon"
              className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm text-[#B7C0D8] cursor-not-allowed select-none"
            >
              <span className="flex items-center gap-3">
                <Icon size={17} /> {label}
              </span>
              <span className="text-[9px] font-semibold uppercase tracking-wide bg-[#F1F4FB] px-1.5 py-0.5 rounded">
                Soon
              </span>
            </div>
          ) : (
            <NavLink
              key={to}
              to={to}
              onClick={onNavigate}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                  isActive
                    ? "bg-[#1E4FD9] text-white shadow-sm"
                    : "text-[#4B5A78] hover:bg-[#F1F4FB]"
                }`
              }
              end={to === "/dealer/dashboard"}
            >
              <Icon size={17} /> {label}
            </NavLink>
          )
        )}
      </nav>

      <div className="p-4">
        <div className="rounded-2xl bg-[#F1F4FB] p-4">
          <p className="text-sm font-semibold text-[#0B2545]">Need Help?</p>
          <p className="text-xs text-[#6B7A9A] mt-1">Our support team is available 24/7 to help you.</p>
          <Link
            to="/contact"
            className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs font-semibold bg-white border border-[#DCE3F5] rounded-xl py-2 text-[#1E4FD9]"
          >
            <LifeBuoy size={14} /> Contact Support
          </Link>
        </div>
      </div>
    </>
  );
}

export default function DealerLayout() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");

  function handleSearch(e) {
    e.preventDefault();
    navigate(search.trim() ? `/buy-car?q=${encodeURIComponent(search.trim())}` : "/buy-car");
  }

  async function handleSignOut() {
    await signOut();
    navigate("/dealer-login", { replace: true });
  }

  const initials = (profile?.dealer_name || profile?.business_name || "D").slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-[#F7F9FC] text-[#0B2545] flex">
      {/* ---------- Sidebar (desktop) ---------- */}
      <aside className="hidden lg:flex flex-col w-64 shrink-0 bg-white border-r border-[#EAEEF7] h-screen sticky top-0">
        <SidebarContent />
        <div className="px-3 pb-4">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50"
          >
            <LogOut size={17} /> Logout
          </button>
        </div>
      </aside>

      {/* ---------- Sidebar (mobile drawer) ---------- */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-72 bg-white h-full flex flex-col">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-4 text-[#6B7A9A]"
            >
              <X size={20} />
            </button>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
            <div className="px-3 pb-4">
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50"
              >
                <LogOut size={17} /> Logout
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ---------- Main column ---------- */}
      <div className="flex-1 min-w-0">
        <header className="sticky top-0 z-30 bg-[#F7F9FC]/95 backdrop-blur border-b border-[#EAEEF7] px-4 md:px-8 py-4 flex items-center gap-4">
          <button className="lg:hidden text-[#4B5A78]" onClick={() => setMobileOpen(true)}>
            <Menu size={22} />
          </button>

          <Link
            to="/"
            className="hidden sm:flex items-center gap-1.5 text-sm font-medium text-[#4B5A78] hover:text-[#1E4FD9] border border-[#E3E8F5] bg-white rounded-xl px-3.5 py-2.5 shrink-0"
          >
            <Home size={16} /> Back to Home
          </Link>

          <form
            onSubmit={handleSearch}
            className="flex-1 max-w-xl hidden sm:flex items-center gap-2 bg-white border border-[#E3E8F5] rounded-xl px-4 py-2.5"
          >
            <Search size={16} className="text-[#93A0BD]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search for cars..."
              className="flex-1 bg-transparent outline-none text-sm placeholder:text-[#93A0BD]"
            />
          </form>

          <div className="ml-auto flex items-center gap-2 md:gap-3">
            <Link
              to="/dealer/profile"
              className="flex items-center gap-2 pl-1 rounded-xl hover:bg-white px-2 py-1 transition"
            >
              {profile?.profile_image_url ? (
                <img
                  src={profile.profile_image_url}
                  alt={profile?.dealer_name || "Dealer"}
                  className="h-9 w-9 rounded-full object-cover border border-[#E3E8F5]"
                />
              ) : (
                <div className="h-9 w-9 rounded-full bg-[#1E4FD9] text-white flex items-center justify-center text-xs font-bold">
                  {initials}
                </div>
              )}
              <div className="hidden sm:block leading-tight text-left">
                <p className="text-sm font-semibold">{profile?.dealer_name || "Dealer"}</p>
                <p className="text-xs text-[#93A0BD]">Dealer</p>
              </div>
            </Link>
          </div>
        </header>

        <main className="max-w-[1400px] mx-auto px-4 md:px-8 py-6 md:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
