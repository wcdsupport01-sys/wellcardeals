import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { supabase } from "../../lib/supabaseClient";
import {
  Car,
  Tag,
  Heart,
  ClipboardList,
  ArrowRight,
  ShieldCheck,
  IndianRupee,
  Zap,
  Lock,
  Gauge,
  Users,
  Headset,
  PlusCircle,
  MessageCircle,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react";

const formatINR = (v) => (v == null ? "—" : "₹" + Math.round(Number(v)).toLocaleString("en-IN"));
const timeAgo = (dateStr) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
};

const REQUEST_STATUS_STYLES = {
  pending: { icon: Clock, cls: "bg-amber-50 text-amber-600" },
  contacted: { icon: Clock, cls: "bg-amber-50 text-amber-600" },
  approved: { icon: CheckCircle2, cls: "bg-emerald-50 text-emerald-600" },
  completed: { icon: CheckCircle2, cls: "bg-emerald-50 text-emerald-600" },
  rejected: { icon: XCircle, cls: "bg-red-50 text-red-500" },
  cancelled: { icon: XCircle, cls: "bg-red-50 text-red-500" },
};

export default function BuyerDashboard() {
  const { user, profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [purchaseRequests, setPurchaseRequests] = useState([]);
  const [auctionRequests, setAuctionRequests] = useState([]);
  const [wishlist, setWishlist] = useState([]);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!user || !supabase) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const [{ data: purchases }, { data: auctions }, { data: saved }] = await Promise.all([
        supabase
          .from("car_purchase_requests")
          .select("*")
          .eq("buyer_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("car_auction_requests")
          .select("*")
          .eq("buyer_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("wishlist")
          .select("id, created_at, cars(id, vehicle_title, thumbnail_url, images, mileage_km, base_price_buyer, current_bid_buyer, fuel_types(name), transmissions(name))")
          .eq("buyer_id", user.id)
          .order("created_at", { ascending: false }),
      ]);
      if (!active) return;
      setPurchaseRequests(purchases || []);
      setAuctionRequests(auctions || []);
      setWishlist(saved || []);
      setLoading(false);
    }
    load();
    return () => {
      active = false;
    };
  }, [user]);

  const carsBought = purchaseRequests.filter((r) => r.status === "completed").length;
  const activeListings = auctionRequests.filter((r) => r.status === "approved").length;
  const savedCount = wishlist.length;

  const activeListing = auctionRequests.find((r) => r.status === "approved");

  const recentActivity = [
    ...purchaseRequests.map((r) => ({
      id: `p-${r.id}`,
      title: `Purchase request — ${r.status}`,
      subtitle: r.message || "Buy Now request",
      date: r.created_at,
      icon: Car,
    })),
    ...auctionRequests.map((r) => ({
      id: `a-${r.id}`,
      title: `Listing request — ${r.status}`,
      subtitle: r.vehicle_title,
      date: r.created_at,
      icon: Tag,
    })),
  ]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 4);

  const STAT_CARDS = [
    { label: "Cars Bought", value: carsBought, icon: Car, cls: "bg-brand-100 text-brand-600" },
    { label: "Saved Cars", value: savedCount, icon: Heart, cls: "bg-rose-100 text-rose-500" },
    { label: "Active Listings", value: activeListings, icon: ClipboardList, cls: "bg-accent-100 text-accent-600" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy-900 mb-1">
        Welcome back{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}! 👋
      </h1>
      <p className="text-gray-500 mb-8">Manage your buy and sell activity all in one place.</p>

      {/* -------- Stat cards -------- */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {STAT_CARDS.map(({ label, value, icon: Icon, cls }) => (
          <div key={label} className="card p-5 flex items-center gap-4">
            <span className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${cls}`}>
              <Icon size={20} />
            </span>
            <div>
              <p className="text-sm text-gray-500">{label}</p>
              <p className="text-2xl font-bold text-navy-900">{loading ? "—" : value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* -------- Buy / Sell promo cards -------- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="card p-6">
          <h2 className="text-lg font-bold text-navy-900 mb-1">Looking to Buy a Car?</h2>
          <p className="text-sm text-gray-500 mb-4">Explore thousands of verified used cars.</p>
          <div className="rounded-xl bg-hero p-5 flex items-center justify-between gap-4 mb-4">
            <div>
              <p className="font-semibold text-navy-900 mb-1">Find Your Perfect Car</p>
              <p className="text-xs text-gray-500 mb-3 max-w-[220px]">
                Search from a wide range of cars from trusted sellers and dealers.
              </p>
              <Link to="/buy-car" className="btn-secondary text-xs px-4 py-2">
                Browse Cars <ArrowRight size={14} />
              </Link>
            </div>
            <Car size={56} className="text-brand/30 shrink-0 hidden sm:block" />
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1.5"><ShieldCheck size={14} className="text-brand shrink-0" /> Verified Cars</span>
            <span className="flex items-center gap-1.5"><IndianRupee size={14} className="text-brand shrink-0" /> Best Prices</span>
            <span className="flex items-center gap-1.5"><Zap size={14} className="text-brand shrink-0" /> Easy Process</span>
            <span className="flex items-center gap-1.5"><Lock size={14} className="text-brand shrink-0" /> Secure Payments</span>
          </div>
        </div>

        <div className="card p-6">
          <h2 className="text-lg font-bold text-navy-900 mb-1">Want to Sell Your Car?</h2>
          <p className="text-sm text-gray-500 mb-4">Sell your car quickly at the best price.</p>
          <div className="rounded-xl bg-hero p-5 flex items-center justify-between gap-4 mb-4">
            <div>
              <p className="font-semibold text-navy-900 mb-1">Sell Your Car in 3 Easy Steps</p>
              <p className="text-xs text-gray-500 mb-3 max-w-[220px]">
                Add your car's details, get offers from dealers, sell at the best price.
              </p>
              <Link to="/sell-car" className="btn-secondary text-xs px-4 py-2">
                Sell My Car <ArrowRight size={14} />
              </Link>
            </div>
            <Tag size={56} className="text-accent/30 shrink-0 hidden sm:block" />
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1.5"><IndianRupee size={14} className="text-accent shrink-0" /> Best Market Price</span>
            <span className="flex items-center gap-1.5"><Users size={14} className="text-accent shrink-0" /> Verified Dealers</span>
            <span className="flex items-center gap-1.5"><Gauge size={14} className="text-accent shrink-0" /> Quick Sale</span>
            <span className="flex items-center gap-1.5"><ShieldCheck size={14} className="text-accent shrink-0" /> Hassle-Free</span>
          </div>
        </div>
      </div>

      {/* -------- Recent activity / Saved cars / Active listing -------- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-navy-900">My Recent Activity</h2>
          </div>
          {loading ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : recentActivity.length === 0 ? (
            <p className="text-sm text-gray-400">
              No activity yet — browse cars or submit a sell request to get started.
            </p>
          ) : (
            <div className="space-y-4">
              {recentActivity.map(({ id, title, subtitle, date, icon: Icon }) => (
                <div key={id} className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="mt-0.5 h-8 w-8 rounded-lg bg-brand-50 text-brand shrink-0 flex items-center justify-center">
                      <Icon size={15} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-navy-900 truncate">{title}</p>
                      <p className="text-xs text-gray-400 truncate">{subtitle}</p>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">{timeAgo(date)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-navy-900">Saved Cars</h2>
            <Link to="/buyer/saved-cars" className="text-xs font-semibold text-brand hover:underline">
              View All
            </Link>
          </div>
          {loading ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : wishlist.length === 0 ? (
            <p className="text-sm text-gray-400">
              Tap the heart on any car to save it here for later.
            </p>
          ) : (
            <div className="space-y-3">
              {wishlist.slice(0, 3).map(({ id, cars: c }) => {
                if (!c) return null;
                const cover = c.thumbnail_url || (Array.isArray(c.images) && c.images[0]);
                const price = c.current_bid_buyer ?? c.base_price_buyer;
                return (
                  <Link
                    key={id}
                    to={`/cars/${c.id}`}
                    className="flex items-center gap-3 group"
                  >
                    <div className="h-12 w-16 rounded-lg bg-surface-muted overflow-hidden shrink-0">
                      {cover ? (
                        <img src={cover} alt={c.vehicle_title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                          <Car size={18} />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-navy-900 truncate group-hover:text-brand">
                        {c.vehicle_title}
                      </p>
                      <p className="text-xs text-gray-400">
                        {formatINR(price)}
                        {c.mileage_km ? ` · ${Math.round(c.mileage_km).toLocaleString("en-IN")} km` : ""}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-navy-900">My Active Listing</h2>
            <Link to="/buyer/my-listings" className="text-xs font-semibold text-brand hover:underline">
              View All
            </Link>
          </div>
          {loading ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : !activeListing ? (
            <div>
              <p className="text-sm text-gray-400 mb-4">You don't have a car listed right now.</p>
              <Link to="/sell-car" className="btn-outline text-xs px-4 py-2 w-full justify-center">
                <PlusCircle size={14} /> List My Car
              </Link>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <span className="h-12 w-16 rounded-lg bg-surface-muted flex items-center justify-center shrink-0 text-gray-300">
                  <Car size={20} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-navy-900 truncate">{activeListing.vehicle_title}</p>
                  <p className="text-xs text-gray-400">{formatINR(activeListing.expected_price)}</p>
                </div>
                <span className="ml-auto text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 shrink-0">
                  Approved
                </span>
              </div>
              <Link to="/buyer/my-listings" className="btn-outline text-xs px-4 py-2 w-full justify-center">
                Manage Listings <ArrowRight size={14} />
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* -------- Bottom banner -------- */}
      <div className="mt-6 card p-6 flex items-center justify-between gap-4 flex-wrap bg-navy-gradient">
        <div className="flex items-center gap-3">
          <span className="h-11 w-11 rounded-xl bg-white/15 text-white flex items-center justify-center shrink-0">
            <Headset size={20} />
          </span>
          <div>
            <p className="font-semibold text-white">Have Questions?</p>
            <p className="text-sm text-white/70">Our support team is here to help you.</p>
          </div>
        </div>
        <Link to="/buyer/help" className="btn bg-white text-navy-900 hover:bg-white/90 text-sm">
          <MessageCircle size={15} /> Contact Support
        </Link>
      </div>
    </div>
  );
}
