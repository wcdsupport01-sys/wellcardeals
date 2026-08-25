import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, X, LayoutDashboard, ShieldCheck, LogOut, ChevronDown, UserPlus, Heart, Bell } from "lucide-react";
import logo from "../assets/logo1-real.png";
import RoleSelectModal from "./RoleSelectModal";
import { subscribeAuthModal } from "../utils/authBus";
import { useAuth } from "../auth/AuthContext";

const Navbar = () => {
  const { user, profile, role, loading, signOut } = useAuth();

  const location = useLocation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  const openAuth = (mode) => {
    setAuthMode(mode);
    setAuthOpen(true);
    setIsOpen(false);
  };

  // Let buttons outside the navbar (hero, CTA sections) open this same modal
  useEffect(() => subscribeAuthModal(openAuth), []);

  // Close the account dropdown on route change
  useEffect(() => setAccountMenuOpen(false), [location.pathname]);

  // No standalone "Live Auctions" / "Dealer Network" nav item any more:
  // - Buyers buy directly from Home's Live Listings or a car's detail page.
  // - Dealers only bid via Services -> Live Auction System (dealer-only route).
  const navItems = [
    { name: "Home", path: "/" },
    { name: "Buy Car", path: "/buy-car" },
    { name: "Sell Car", path: "/sell-car" },
    { name: "About", path: "/about" },
    { name: "Services", path: "/services" },
    { name: "Contact", path: "/contact" },
  ];

  // Single source of truth for where the role-specific dashboard link goes.
  const dashboardPath =
    role === "admin" ? "/admin" : role === "dealer" ? "/dealer/dashboard" : role === "buyer" ? "/buyer/dashboard" : null;
  const dashboardLabel =
    role === "admin" ? "Admin Panel" : role === "dealer" ? "Dealer Dashboard" : role === "buyer" ? "Buyer Dashboard" : null;

  const displayName =
    profile?.full_name || profile?.business_name || user?.displayName || user?.email?.split("@")[0] || "Account";
  const initial = displayName.charAt(0).toUpperCase();

  const handleSignOut = async () => {
    setAccountMenuOpen(false);
    setIsOpen(false);
    await signOut();
    navigate("/");
  };

  return (
    <>
      {/* NAVBAR */}
      <nav
        style={{ transform: "translateZ(0)" }}
        className="w-full fixed top-0 left-0 z-50 bg-white/95 backdrop-blur-sm shadow-soft border-b border-navy-900/8 will-change-transform"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 lg:py-5 flex items-center justify-between">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 h-full shrink-0">
            <img
              src={logo}
              alt="WellCarDeals Logo"
              className="h-9 w-9 object-contain"
            />
            <span className="flex flex-col leading-none">
              <span className="text-xl font-bold tracking-tight text-navy-900 font-display">
                Well<span className="text-xl font-bold tracking-tight text-[#2E6BFF] font-display">Car</span>Deals
              </span>
              <span className="text-[9px] font-semibold tracking-[0.15em] text-brand uppercase">
                Find. Bid. Drive.
              </span>
            </span>
          </Link>

          {/* Desktop Links */}
          <div className="hidden lg:flex items-center gap-8 text-[15px] text-navy-700 font-medium">
            {navItems.map((item, index) => (
              <Link key={index} to={item.path} className={`relative group transition flex items-center gap-1.5 hover:text-brand ${location.pathname === item.path ? "text-brand" : ""}`}>
                {item.name}
                {item.live && (
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
                  </span>
                )}
                <span
                  className={`absolute left-0 -bottom-1 h-[1.5px] bg-brand transition-all duration-300 
                  ${location.pathname === item.path ? "w-full" : "w-0 group-hover:w-full"}`}
                ></span>
              </Link>
            ))}

            {/* Admin gets a permanently visible, distinct link in addition to
                the dropdown below — buyers/dealers never see this at all. */}
            {!loading && role === "admin" && (
              <Link
                to="/admin"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-navy-900 text-white text-[13px] font-semibold tracking-wide hover:bg-navy-700 transition"
              >
                <ShieldCheck size={15} />
                Admin Panel
              </Link>
            )}
          </div>

          {/* Desktop Right Side: loading / guest / authenticated */}
          <div className="hidden lg:flex items-center gap-3">
            {!loading && user && (
              <>
                <Link
                  to="/buyer/saved-cars"
                  className="relative h-10 w-10 rounded-full flex items-center justify-center text-navy-700 hover:bg-navy-900/5 hover:text-brand transition"
                  title="Saved Cars"
                >
                  <Heart size={19} />
                </Link>
                <Link
                  to="/buyer/notifications"
                  className="relative h-10 w-10 rounded-full flex items-center justify-center text-navy-700 hover:bg-navy-900/5 hover:text-brand transition"
                  title="Notifications"
                >
                  <Bell size={19} />
                  <span className="absolute top-2 right-2.5 h-1.5 w-1.5 rounded-full bg-accent" />
                </Link>
              </>
            )}
            {loading ? (
              // Fixed-width skeleton so nothing jumps once auth resolves
              <div className="flex items-center gap-3 w-[170px] justify-end">
                <div className="h-9 w-9 rounded-full bg-navy-900/10 animate-pulse" />
                <div className="h-4 w-20 rounded bg-navy-900/10 animate-pulse" />
              </div>
            ) : !user ? (
              <>
                <button
                  onClick={() => openAuth("login")}
                  className="btn-outline"
                >
                  Login
                </button>
                <button
                  onClick={() => openAuth("signup")}
                  className="btn-secondary"
                >
                  <UserPlus size={16} />
                  Register
                </button>
              </>
            ) : (
              <div className="relative">
                <button
                  onClick={() => setAccountMenuOpen((v) => !v)}
                  className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-full border border-navy-900/10 hover:border-brand/40 hover:bg-brand-50 transition"
                >
                  <span className="h-8 w-8 rounded-full bg-navy-gradient text-white flex items-center justify-center text-sm font-semibold">
                    {initial}
                  </span>
                  <span className="text-sm font-medium text-navy-900 max-w-[110px] truncate">{displayName}</span>
                  <ChevronDown size={15} className={`text-navy-500 transition-transform ${accountMenuOpen ? "rotate-180" : ""}`} />
                </button>

                {accountMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl border border-navy-900/8 shadow-lift py-2 z-50 animate-fade-up">
                    <div className="px-4 py-2 border-b border-navy-900/8">
                      <p className="text-sm font-semibold text-navy-900 truncate">{displayName}</p>
                      <p className="text-xs text-navy-700/60 truncate">{user.email}</p>
                    </div>

                    {dashboardPath && (
                      <Link
                        to={dashboardPath}
                        onClick={() => setAccountMenuOpen(false)}
                        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition ${
                          role === "admin" ? "text-navy-900 hover:bg-brand-50" : "text-navy-700 hover:bg-brand-50"
                        }`}
                      >
                        {role === "admin" ? <ShieldCheck size={16} /> : <LayoutDashboard size={16} />}
                        {dashboardLabel}
                      </Link>
                    )}

                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50/80 transition"
                    >
                      <LogOut size={16} />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="lg:hidden">
            <button onClick={() => setIsOpen(true)} className="text-navy-900">
              <Menu size={28} />
            </button>
          </div>
        </div>
      </nav>

      {/* OVERLAY (FULL PAGE BLUR) */}
      <div
        className={`fixed inset-0 z-40 transition-all duration-300 ${isOpen
          ? "bg-black/30 backdrop-blur-md opacity-100 visible"
          : "opacity-0 invisible"
          }`}
        onClick={() => setIsOpen(false)}
      ></div>

      {/* HALF SCREEN RIGHT PANEL */}
      <div
        className={`fixed top-0 right-0 h-screen w-[70%] max-w-sm bg-navy-900 z-50 transform transition-transform duration-500 flex flex-col ${isOpen ? "translate-x-0" : "translate-x-full"
          }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
          <span className="text-white text-lg font-semibold">Menu</span>
          <button onClick={() => setIsOpen(false)}>
            <X size={26} className="text-white" />
          </button>
        </div>

        {/* Account summary (mobile) */}
        {!loading && user && (
          <div className="flex items-center gap-3 px-8 pt-6">
            <span className="h-11 w-11 rounded-full bg-white text-black flex items-center justify-center text-base font-semibold shrink-0">
              {initial}
            </span>
            <div className="min-w-0">
              <p className="text-white text-sm font-semibold truncate">{displayName}</p>
              <p className="text-white/50 text-xs truncate">{user.email}</p>
            </div>
          </div>
        )}

        {/* Links */}
        <div className="flex flex-col justify-start pt-8 px-8 gap-6">
          {navItems.map((item, index) => (
            <Link
              key={index}
              to={item.path}
              onClick={() => setIsOpen(false)}
              className={`text-white text-xl font-medium transition flex items-center gap-2 ${location.pathname === item.path ? "opacity-100" : "opacity-70"
                } hover:opacity-100`}
            >
              {item.name}
              {item.live && (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
              )}
            </Link>
          ))}

          {!loading && dashboardPath && (
            <Link
              to={dashboardPath}
              onClick={() => setIsOpen(false)}
              className={`flex items-center gap-2 text-xl font-medium transition ${
                role === "admin" ? "text-white" : "text-white/70 hover:text-white"
              }`}
            >
              {role === "admin" ? <ShieldCheck size={20} /> : <LayoutDashboard size={20} />}
              {dashboardLabel}
            </Link>
          )}
        </div>

        {/* CTA / Sign out */}
        <div className="px-6 mt-10 flex flex-col gap-3">
          {loading ? null : !user ? (
            <>
              <button
                onClick={() => openAuth("signup")}
                className="w-full bg-accent text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2"
              >
                <UserPlus size={16} />
                Register
              </button>
              <button
                onClick={() => openAuth("login")}
                className="w-full border border-white/20 text-white py-3 rounded-xl font-semibold hover:border-white/50 transition"
              >
                Login
              </button>
            </>
          ) : (
            <button
              onClick={handleSignOut}
              className="w-full flex items-center justify-center gap-2 border border-white/20 text-white py-3 rounded-xl font-semibold hover:border-red-400/50 hover:text-red-400 transition"
            >
              <LogOut size={18} />
              Sign Out
            </button>
          )}
        </div>
      </div>

      {/* ROLE SELECT MODAL */}
      <RoleSelectModal
        isOpen={authOpen}
        mode={authMode}
        onClose={() => setAuthOpen(false)}
      />
    </>
  );
};

export default Navbar;
