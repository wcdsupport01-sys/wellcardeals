import { useEffect, useMemo, useState } from "react";
import {
  Gavel, Tag, EyeOff, Eye, Ban, RotateCcw, Loader2, AlertCircle, Search,
  ClipboardCheck, ChevronDown, ChevronUp, UserCheck2, RefreshCw, X,
  ImageOff, Clock, TrendingUp, Download, SortAsc, SortDesc, CheckSquare,
  Square, IndianRupee, Users, Shield,
} from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { supabase } from "../../lib/supabaseClient";
import { fetchCars, updateCar } from "../lib/carsApi";
import { INSPECTION_CATEGORIES, INSPECTION_STATUS_OPTIONS, EMPTY_INSPECTION } from "../lib/lookups";

const INSPECTION_STATUS_DOT = {
  good: "bg-emerald-500",
  fair: "bg-amber-500",
  poor: "bg-red-500",
};

const STATUS_STYLES = {
  draft: "bg-zinc-500/15 text-zinc-400",
  upcoming: "bg-blue-500/15 text-blue-400",
  live: "bg-emerald-500/15 text-emerald-400",
  closed: "bg-zinc-500/15 text-zinc-400",
  sold: "bg-violet-500/15 text-violet-400",
  delisted: "bg-red-500/15 text-red-400",
};

function toLocalInputValue(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function overallInspectionStatus(car) {
  const statuses = Object.values(car.inspection || {}).map((v) => v?.status).filter(Boolean);
  if (statuses.length === 0) return null;
  if (statuses.includes("poor")) return "poor";
  if (statuses.includes("fair")) return "fair";
  return "good";
}

function formatINR(v) {
  if (v == null) return "—";
  return "₹" + Math.round(Number(v)).toLocaleString("en-IN");
}

// Auction timer warning — red if < 24h left
function AuctionTimer({ endTime }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!endTime) return null;
  const diff = new Date(endTime).getTime() - now;
  if (diff <= 0) return <span className="text-[10px] text-zinc-500">Ended</span>;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  const urgent = h < 24;
  return (
    <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${urgent ? "bg-red-500/15 text-red-400" : "bg-zinc-500/10 text-zinc-400"}`}>
      <Clock size={10} />
      {h > 0 ? `${h}h ` : ""}{String(m).padStart(2, "0")}m {String(s).padStart(2, "0")}s
      {urgent && " ⚠️"}
    </span>
  );
}

// ─── Re-list Modal ─────────────────────────────────────────────────────────
function RelistModal({ car, onClose, onConfirm, saving }) {
  const [listingType, setListingType] = useState(car.listing_type || "auction");
  const [auctionEnd, setAuctionEnd] = useState("");
  const [accessType, setAccessType] = useState(car.access_type || "all");
  const [error, setError] = useState("");

  function handleConfirm() {
    if (listingType === "auction" && !auctionEnd) { setError("Please set an auction end date/time."); return; }
    setError("");
    onConfirm({ listingType, auctionEnd, accessType });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <RefreshCw size={16} className="text-emerald-400" />
            <p className="text-white font-bold text-sm">Re-list Car</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white transition"><X size={18} /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <p className="text-zinc-400 text-xs">Re-listing: <span className="text-white font-medium">{car.vehicle_title}</span></p>
          <div>
            <label className="text-xs text-zinc-400 mb-2 block">Listing Type</label>
            <div className="flex items-center gap-2 bg-white/5 rounded-lg p-1">
              <button onClick={() => setListingType("auction")} className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition ${listingType === "auction" ? "bg-blue-600 text-white" : "text-zinc-400 hover:text-white"}`}>
                <Gavel size={13} /> Auction
              </button>
              <button onClick={() => setListingType("buy_now_only")} className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition ${listingType === "buy_now_only" ? "bg-blue-600 text-white" : "text-zinc-400 hover:text-white"}`}>
                <Tag size={13} /> Buy Now
              </button>
            </div>
          </div>
          {listingType === "auction" && (
            <div>
              <label className="text-xs text-zinc-400 mb-1.5 block">New Auction End Date & Time</label>
              <input type="datetime-local" value={auctionEnd} onChange={(e) => setAuctionEnd(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-blue-500/50" />
            </div>
          )}
          <div>
            <label className="text-xs text-zinc-400 mb-1.5 block">Who can see this listing?</label>
            <select value={accessType} onChange={(e) => setAccessType(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-blue-500/50">
              <option value="all" className="bg-zinc-900">Everyone (Buyers + Dealers)</option>
              <option value="dealer_only" className="bg-zinc-900">Dealers Only</option>
            </select>
          </div>
          {error && <p className="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-lg flex items-center gap-1.5"><AlertCircle size={13} /> {error}</p>}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button onClick={onClose} disabled={saving} className="py-2.5 rounded-xl border border-white/10 text-zinc-300 text-sm font-medium hover:bg-white/5 transition disabled:opacity-50">Cancel</button>
            <button onClick={handleConfirm} disabled={saving} className="py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition disabled:opacity-60 flex items-center justify-center gap-2">
              {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : <><RefreshCw size={14} /> Re-list Now</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Price Edit Modal ──────────────────────────────────────────────────────
// `bidCount` tells this modal whether the car already has live bids. When
// it has none yet, editing the base price should also move the "current
// bid" (current_bid_buyer/dealer) forward — that's the field
// RealCarDetail.jsx actually displays as the live price. Once real bids
// exist, we leave current_bid_* alone so we never clobber a genuine bid.
function PriceModal({ car, onClose, onSave, saving, bidCount }) {
  const [buyerPrice, setBuyerPrice] = useState(car.base_price_buyer || "");
  const [dealerPrice, setDealerPrice] = useState(car.base_price_dealer || "");
  const [buyNowPrice, setBuyNowPrice] = useState(car.buy_now_price || "");
  const [startingBid, setStartingBid] = useState(car.starting_bid || "");
  const [reservePrice, setReservePrice] = useState(car.reserve_price || "");

  function handleSave() {
    const payload = {
      base_price_buyer: buyerPrice || null,
      base_price_dealer: dealerPrice || null,
      buy_now_price: buyNowPrice || null,
      starting_bid: startingBid || null,
      reserve_price: reservePrice || null,
    };
    // No bids yet on this car → also move the live "current bid" fields so
    // the price actually shows on the site instead of staying stuck at the
    // old value. If there ARE bids already, don't touch current_bid_*.
    if (!bidCount) {
      payload.current_bid_buyer = buyerPrice || null;
      payload.current_bid_dealer = dealerPrice || null;
    }
    onSave(payload);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <IndianRupee size={16} className="text-amber-400" />
            <p className="text-white font-bold text-sm">Edit Prices</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white transition"><X size={18} /></button>
        </div>
        <div className="px-6 py-5 space-y-3">
          <p className="text-zinc-400 text-xs mb-2">{car.vehicle_title}</p>
          {!bidCount && (
            <p className="text-[11px] text-amber-300/80 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
              No bids yet — the buyer/dealer live price will update immediately along with these base prices.
            </p>
          )}
          {bidCount > 0 && (
            <p className="text-[11px] text-zinc-400 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
              This car already has {bidCount} bid{bidCount !== 1 ? "s" : ""} — the current live bid won't be changed, only the base/reserve prices below.
            </p>
          )}
          {[
            ["Buyer Base Price", buyerPrice, setBuyerPrice],
