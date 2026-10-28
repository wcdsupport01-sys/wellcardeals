import { useCallback, useEffect, useRef, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRight, Car, ChevronDown, ChevronRight, ExternalLink,
  Gavel, Heart, LogOut, Menu, ShieldCheck, TrendingUp, Trophy, User, X,
} from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import DealerGuideDialog from "../../dealer/DealerGuideDialog";
import "../../dealer/dealer-workspace.css";

const NAV = [
  { tab: "live", label: "Live auctions", icon: Gavel },
  { tab: "bids", label: "My bids", icon: TrendingUp },
  { tab: "watchlist", label: "Watchlist", icon: Heart },
  { tab: "results", label: "Results", icon: Trophy },
];

function SidebarContent({ onNavigate, onHelp, onSignOut }) {
  const location = useLocation();
  const selectedTab = new URLSearchParams(location.search).get("tab") || "live";
  const isDashboard = location.pathname === "/dealer/dashboard";
  return (
    <>
      <Link to="/" className="dealer-brand" onClick={onNavigate} aria-label="WellCarDeals home">
        <span className="dealer-brand-mark"><Car size={25} aria-hidden="true" /></span>
        <span><span className="dealer-brand-name">Well<em>Car</em>Deals</span><span className="dealer-brand-sub">DEALER WORKSPACE</span></span>
      </Link>
      <p className="dealer-nav-caption">YOUR WORKSPACE</p>
      <nav className="dealer-nav" aria-label="Dealer workspace">
        {NAV.map((item) => {
          const { tab, label, icon: Icon } = item;
          const active = isDashboard && selectedTab === tab;
          return (
            <Link key={tab} to={`/dealer/dashboard?tab=${tab}`} onClick={onNavigate}
              className={`dealer-nav-link${active ? " active" : ""}`}
              aria-current={active ? "page" : undefined}>
              <Icon size={18} aria-hidden="true" />{label}
            </Link>
          );
        })}
      </nav>
      <p className="dealer-nav-caption">YOUR ACCOUNT</p>
      <Link to="/dealer/profile" onClick={onNavigate}
        className={`dealer-nav-link${location.pathname === "/dealer/profile" ? " active" : ""}`}
        aria-current={location.pathname === "/dealer/profile" ? "page" : undefined}>
        <User size={18} aria-hidden="true" />Business profile
      </Link>
      <div className="dealer-sidebar-spacer" />
      <div className="dealer-sidebar-help">
        <ShieldCheck aria-hidden="true" />
        <strong>Bid with a little more clarity.</strong>
        <p>Review the car, check the amount, then make your move.</p>
        <button onClick={onHelp}>How bidding works <ArrowRight size={14} aria-hidden="true" /></button>
      </div>
      <div className="dealer-sidebar-footer">
        <Link to="/buy-car" onClick={onNavigate}><ExternalLink size={16} aria-hidden="true" />Browse marketplace</Link>
        <button onClick={onSignOut}><LogOut size={16} aria-hidden="true" />Log out</button>
      </div>
    </>
  );
}

export default function DealerLayout() {
  const { profile, dealerStatus, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const drawerRef = useRef(null);
  const menuRef = useRef(null);
  const openHelp = useCallback(() => {
    setMobileOpen(false);
    setHelpOpen(true);
  }, []);
  const closeHelp = useCallback(() => setHelpOpen(false), []);

  useEffect(() => {
    if (!mobileOpen) return;
    const drawer = drawerRef.current;
    const menuButton = menuRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    drawer.querySelector("button, a[href]")?.focus();
    const keyboard = (event) => {
      if (event.key === "Escape") setMobileOpen(false);
      if (event.key !== "Tab") return;
      const controls = [...drawer.querySelectorAll("button:not(:disabled), a[href]")];
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first?.focus();
      }
    };
    document.addEventListener("keydown", keyboard);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", keyboard);
      menuButton?.focus();
    };
  }, [mobileOpen]);

  async function handleSignOut() {
    setMobileOpen(false);
    await signOut();
    navigate("/dealer-login", { replace: true });
  }
  const name = profile?.business_name || profile?.dealer_name || profile?.full_name || "Your dealership";
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "D";
  const approved = (profile?.status || dealerStatus) === "approved";
  const section = location.pathname === "/dealer/profile" ? "Business profile" : "Auctions";

  return (
    <div className="dealer-workspace">
      <aside className="dealer-sidebar dealer-sidebar-desktop">
        <SidebarContent onHelp={openHelp} onSignOut={handleSignOut} />
      </aside>
      {mobileOpen && (
        <div className="dealer-mobile-nav" role="dialog" aria-modal="true" aria-label="Dealer navigation" ref={drawerRef}>
          <div className="dealer-nav-backdrop" onClick={() => setMobileOpen(false)} aria-hidden="true" />
          <aside className="dealer-sidebar" id="dealer-mobile-navigation">
            <button className="dealer-icon-button dealer-nav-close" aria-label="Close navigation" onClick={() => setMobileOpen(false)}><X size={19} /></button>
            <SidebarContent onNavigate={() => setMobileOpen(false)} onHelp={openHelp} onSignOut={handleSignOut} />
          </aside>
        </div>
      )}
      <div className="dealer-main-shell">
        <header className="dealer-topbar">
          <div className="dealer-topbar-left">
            <button ref={menuRef} className="dealer-icon-button dealer-menu-button" onClick={() => setMobileOpen(true)} aria-label="Open navigation" aria-expanded={mobileOpen} aria-controls={mobileOpen ? "dealer-mobile-navigation" : undefined}><Menu size={21} /></button>
            <div className="dealer-breadcrumb"><span>Dealer workspace</span><ChevronRight size={13} aria-hidden="true" /><strong>{section}</strong></div>
          </div>
          <div className="dealer-topbar-right">
            {approved && <span className="dealer-account-approved"><ShieldCheck size={16} aria-hidden="true" />Approved dealer</span>}
            <Link to="/dealer/profile" className="dealer-account" aria-label="Open your business profile">
              <span className="dealer-avatar">{initials}{profile?.profile_image_url && <img src={profile.profile_image_url} alt="" onError={(event) => { event.currentTarget.hidden = true; }} />}</span>
              <span><strong>{name}</strong><small>Your dealer account</small></span>
              <ChevronDown size={13} aria-hidden="true" />
            </Link>
          </div>
        </header>
        <main className="dealer-main"><Outlet context={{ openHelp }} /></main>
      </div>
      <DealerGuideDialog open={helpOpen} onClose={closeHelp} />
    </div>
  );
}
