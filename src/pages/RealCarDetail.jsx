import React, { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ShieldCheck, MapPin, Share2, Heart, ChevronLeft, ChevronRight, Gavel, TrendingUp,
  ShoppingCart, CheckCircle2, BadgeCheck, Fuel, Settings2, Gauge, UserCheck,
  Wallet, Truck, PhoneCall, Lock, Calendar, PlayCircle, RotateCw,
  FileText, Download, Plus, X, AlertCircle, Check, Link2,
} from "lucide-react";
import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";
import { useAuth } from "../auth/AuthContext";
import CarCard from "../components/CarCard";
import DealerApprovalModal from "../components/DealerApprovalModal";
import { INSPECTION_CATEGORIES } from "../admin/lib/lookups";

const TABS = ["Overview", "Features", "Inspection Report", "Documents", "Similar Cars"];

const formatINR = (value) =>
  value == null ? "—" : "₹" + Math.round(Number(value)).toLocaleString("en-IN");

function useCountdownTo(endTime) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!endTime) return { hours: 0, minutes: 0, seconds: 0, isEnded: true };
  const diff = Math.max(0, new Date(endTime).getTime() - now);
  const isEnded = diff <= 0;
  const hours = Math.floor(diff / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  const seconds = Math.floor((diff % 60_000) / 1000);
  return { hours, minutes, seconds, isEnded };
}

const pad = (n) => n.toString().padStart(2, "0");

// ─── Bid Confirmation Modal ───────────────────────────────────────────────────
function BidConfirmModal({ isOpen, onClose, onConfirm, amount, currentBid, carTitle, placing }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-navy-gradient px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center">
                <Gavel size={16} className="text-white" />
              </span>
              <p className="text-white font-bold text-sm">Are You Sure?</p>
            </div>
            <button onClick={onClose} className="text-white/60 hover:text-white transition">
              <X size={18} />
            </button>
          </div>
          {/* Car name */}
          <p className="text-white/60 text-xs mt-2 truncate">{carTitle}</p>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {/* Bid amount highlight */}
          <div className="bg-brand-50 border border-brand/20 rounded-xl p-4 text-center mb-4">
            <p className="text-xs text-gray-500 mb-1">Your Bid Amount</p>
            <p className="text-3xl font-extrabold text-navy-900">{formatINR(amount)}</p>
          </div>

          {/* Current bid info */}
          <div className="flex items-center justify-between text-sm mb-5">
            <span className="text-gray-500">Current Highest Bid</span>
            <span className="font-semibold text-gray-900">{formatINR(currentBid)}</span>
          </div>

          {/* Warning */}
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 mb-5">
            <AlertCircle size={14} className="text-amber-500 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700">Bids are binding once placed. Please review carefully before confirming.</p>
          </div>

          {/* Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={onClose}
              disabled={placing}
              className="py-3 rounded-xl border border-gray-300 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition disabled:opacity-50"
            >
              Not Sure
            </button>
            <button
              onClick={onConfirm}
              disabled={placing}
              className="py-3 rounded-xl bg-navy-900 hover:bg-navy-700 text-white font-semibold text-sm transition disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {placing ? (
                <>
                  <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Placing…
                </>
              ) : (
                <>
                  <Gavel size={15} /> Yes, Sure
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Share / Wishlist buttons (reused in two spots on the page) ──────────────
function ShareButton({ onShare, justCopied, size = 18, className = "" }) {
  return (
    <button
      type="button"
      onClick={onShare}
      title={justCopied ? "Link copied!" : "Share this car"}
      className={`transition ${className}`}
    >
      {justCopied ? <Check size={size} className="text-emerald-500" /> : <Share2 size={size} />}
    </button>
  );
}

function WishlistButton({ isSaved, saving, onToggle, size = 18, className = "" }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={saving}
      title={isSaved ? "Remove from saved cars" : "Save this car"}
      className={`transition disabled:opacity-50 ${className}`}
    >
      <Heart size={size} className={isSaved ? "text-rose-500" : ""} fill={isSaved ? "currentColor" : "none"} />
    </button>
  );
}

const RealCarDetail = () => {
  const { id } = useParams();
  const { role, dealerStatus, profile, user } = useAuth();
  const isApprovedDealer = role === "dealer" && dealerStatus === "approved";
  const [myBids, setMyBids] = useState([]);

  const [car, setCar] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeImg, setActiveImg] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [placingBid, setPlacingBid] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [customAmount, setCustomAmount] = useState("");
  const [bidError, setBidError] = useState("");

  // Bid confirmation modal state
  const [bidModalOpen, setBidModalOpen] = useState(false);
  const [pendingBidAmount, setPendingBidAmount] = useState(null);

  const [activeTab, setActiveTab] = useState("Overview");
  const [similarCars, setSimilarCars] = useState([]);

  const [buyOpen, setBuyOpen] = useState(false);
  const [buyPhone, setBuyPhone] = useState("");
  const [buyMessage, setBuyMessage] = useState("");
  const [buySubmitting, setBuySubmitting] = useState(false);
  const [buyError, setBuyError] = useState("");
  const [buySent, setBuySent] = useState(false);

  // EMI calculator state — used in the "Buy Now Listing" panel below.
  const [downPayment, setDownPayment] = useState("");
  const [interestRate, setInterestRate] = useState(9.5);
  const [tenureMonths, setTenureMonths] = useState(36);

  // Wishlist ("saved cars") state — backed by the `wishlist` table
  // (buyer_id, car_id), same table SavedCarsPage.jsx reads from.
  const [wishlistRowId, setWishlistRowId] = useState(null); // null = not saved
  const [wishlistSaving, setWishlistSaving] = useState(false);

  // Share — copies the current page link and shows a brief "copied" state.
  const [justCopied, setJustCopied] = useState(false);
  const [wishlistError, setWishlistError] = useState("");
  const [shareError, setShareError] = useState("");

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) { setError("Supabase isn't configured yet."); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase.from("cars").select("*").eq("id", id).maybeSingle();
    if (error) setError(error.message);
    else setCar(data);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); setActiveImg(0); }, [load]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const channel = supabase.channel(`car-${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "cars", filter: `id=eq.${id}` },
        (payload) => setCar((prev) => (prev ? { ...prev, ...payload.new } : payload.new)))
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [id]);

  const countdown = useCountdownTo(car?.auction_end);

  const loadMyBids = useCallback(async () => {
    if (!isSupabaseConfigured || !user) { setMyBids([]); return; }
    const { data } = await supabase.from("car_bids").select("*").eq("car_id", id).eq("bidder_id", user.id).order("created_at", { ascending: false });
    setMyBids(data || []);
  }, [id, user]);

  useEffect(() => { loadMyBids(); }, [loadMyBids]);

  // Check whether this car is already in the logged-in buyer's wishlist.
  const loadWishlistStatus = useCallback(async () => {
    if (!isSupabaseConfigured || !user || !id) { setWishlistRowId(null); return; }
    const { data } = await supabase
      .from("wishlist")
      .select("id")
      .eq("buyer_id", user.id)
      .eq("car_id", id)
      .maybeSingle();
    setWishlistRowId(data?.id || null);
  }, [id, user]);

  useEffect(() => { loadWishlistStatus(); }, [loadWishlistStatus]);

  useEffect(() => {
    if (!isSupabaseConfigured || !car) return;
    let cancelled = false;
    (async () => {
      let query = supabase.from("cars").select("*").neq("id", car.id).eq("status", "live").limit(4);
      if (car.brand_id) query = query.eq("brand_id", car.brand_id);
      let { data } = await query;
      if ((!data || data.length === 0) && car.category_id) {
        const fallback = await supabase.from("cars").select("*").neq("id", car.id).eq("status", "live").eq("category_id", car.category_id).limit(4);
        data = fallback.data;
      }
      if (!cancelled) setSimilarCars(data || []);
    })();
    return () => { cancelled = true; };
  }, [car?.id, car?.brand_id, car?.category_id]);

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center text-gray-400">Loading…</div>;
  if (error || !car) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6">
        <p className="text-gray-500">{error || "This listing doesn't exist or has been removed."}</p>
        <Link to="/#live-listings" className="mt-4 text-sm font-semibold underline underline-offset-4">Back to Live Listings</Link>
      </div>
    );
  }

  const currentBid = isApprovedDealer ? car.current_bid_dealer : car.current_bid_buyer;
  const basePrice = isApprovedDealer ? car.base_price_dealer : car.base_price_buyer;
  const displayPrice = currentBid || basePrice;
  const minIncrement = car.minimum_increment || 5000;
  const nextMinBid = (currentBid || basePrice || 0) + minIncrement;

  // EMI calculation — standard reducing-balance formula. loanAmount is the
  // buy-now price minus whatever down payment the buyer enters.
  const loanAmount = Math.max((displayPrice || 0) - (Number(downPayment) || 0), 0);
  const monthlyRate = interestRate / 12 / 100;
  const emiAmount = monthlyRate > 0
    ? Math.round((loanAmount * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths)) / (Math.pow(1 + monthlyRate, tenureMonths) - 1))
    : Math.round(loanAmount / tenureMonths);

  const images = Array.from(new Set([car.thumbnail_url, ...(Array.isArray(car.images) ? car.images : [])].filter(Boolean)));
  const images360 = Array.isArray(car.images_360) ? car.images_360.filter(Boolean) : [];
  const videos = Array.isArray(car.videos) ? car.videos.filter(Boolean) : [];
  const documents = Array.isArray(car.documents) ? car.documents.filter((d) => d && (d.url || d.name)) : [];
  const specifications = car.specifications && typeof car.specifications === "object" ? Object.entries(car.specifications) : [];

  const featureGroups = [
    ["Safety", car.safety_features], ["Comfort", car.comfort_features],
    ["Exterior", car.exterior_features], ["Interior", car.interior_features],
    ["Infotainment", car.infotainment_features],
  ].map(([label, arr]) => [label, Array.isArray(arr) ? arr.filter(Boolean) : []]).filter(([, arr]) => arr.length > 0);
  const totalFeatureCount = featureGroups.reduce((sum, [, arr]) => sum + arr.length, 0);

  const noAccident = car.accidental_history && /^(none|no|nil)/i.test(String(car.accidental_history).trim());

  const inspectionEntries = INSPECTION_CATEGORIES.map(({ key, label }) => ({ key, label, ...(car.inspection?.[key] || { status: null, note: null }) }));
  const inspectedCount = inspectionEntries.filter((e) => e.status).length;
  const isInspected = Boolean(car.inspected_at) && inspectedCount > 0;
  const overallInspectionStatus = !isInspected ? null : inspectionEntries.some((e) => e.status === "poor") ? "poor" : inspectionEntries.some((e) => e.status === "fair") ? "fair" : "good";

  // Open confirmation modal instead of placing bid directly
  function initiateBid(amount) {
    setBidError("");
    if (role === "dealer" && dealerStatus === "pending") { setShowApprovalModal(true); return; }
    if (!amount) { setBidError("Please enter a bid amount"); return; }
    if (car.reserve_price && amount < car.reserve_price) { setBidError(`Bid cannot be below the reserve price of ${formatINR(car.reserve_price)}`); return; }
    if (amount < nextMinBid) { setBidError(`Bid must be at least ${formatINR(nextMinBid)}`); return; }
    setPendingBidAmount(amount);
    setBidModalOpen(true);
  }

  // Actually place the bid after confirmation
  async function confirmBid() {
    const amount = pendingBidAmount;
    setPlacingBid(true);
    const field = isApprovedDealer ? "current_bid_dealer" : "current_bid_buyer";
    const bidderRole = isApprovedDealer ? "dealer" : "buyer";
    const idField = isApprovedDealer ? "highest_bidder_id_dealer" : "highest_bidder_id_buyer";
    const nameField = isApprovedDealer ? "highest_bidder_name_dealer" : "highest_bidder_name_buyer";
    const bidderName = profile?.full_name || profile?.email || "A dealer";
    const { error } = await supabase.from("cars").update({
      [field]: amount, [idField]: user?.id || null, [nameField]: bidderName, highest_bidder_name: bidderName,
    }).eq("id", car.id);
    setPlacingBid(false);
    if (error) {
      setBidError(error.message);
      setBidModalOpen(false);
    } else {
      setCar((prev) => ({ ...prev, [field]: amount, [idField]: user?.id || null, [nameField]: bidderName }));
      setCustomAmount("");
      setBidModalOpen(false);
      setPendingBidAmount(null);
      if (user) {
        await supabase.from("car_bids").insert({ car_id: car.id, bidder_id: user.id, bidder_name: bidderName, bidder_role: bidderRole, amount });
        loadMyBids();
      }
    }
  }

  async function submitBuyRequest() {
    setBuyError("");
    if (!user) { setBuyError("Please log in as a buyer to request this car."); return; }
    setBuySubmitting(true);
    const buyerName = profile?.full_name || profile?.email || "A buyer";
    const { error } = await supabase.from("car_purchase_requests").insert({
      car_id: car.id, buyer_id: user.id, buyer_name: buyerName,
      buyer_phone: buyPhone || profile?.phone || null,
      offer_price: displayPrice, message: buyMessage || null,
    });
    setBuySubmitting(false);
    if (error) setBuyError(error.message);
    else setBuySent(true);
  }

  // Toggle this car in/out of the logged-in buyer's wishlist (`wishlist`
  // table — same one SavedCarsPage.jsx reads from).
  async function toggleWishlist() {
    if (!isSupabaseConfigured) {
      setWishlistError("Saved cars aren't available right now.");
      return;
    }
    if (!user) {
      window.location.href = "/login";
      return;
    }
    setWishlistError("");
    setWishlistSaving(true);
    if (wishlistRowId) {
      const { error } = await supabase.from("wishlist").delete().eq("id", wishlistRowId);
      setWishlistSaving(false);
      if (error) {
        setWishlistError(error.message || "Couldn't remove from saved cars.");
        return;
      }
      setWishlistRowId(null);
    } else {
      const { data, error } = await supabase
        .from("wishlist")
        .insert({ buyer_id: user.id, car_id: car.id })
        .select("id")
        .single();
      setWishlistSaving(false);
      if (error) {
        setWishlistError(error.message || "Couldn't save this car.");
        return;
      }
      setWishlistRowId(data.id);
    }
  }

  // Share this car's page — native share sheet on mobile, clipboard copy
  // (with a brief "copied" confirmation) everywhere else. Falls back to a
  // visible prompt if both the share sheet and clipboard access are blocked
  // (e.g. no HTTPS/user-gesture context), so the button never looks "dead".
  async function shareCar() {
    setShareError("");
    const shareData = {
      title: car?.vehicle_title || "WellCarDeals",
      text: `Check out this ${car?.vehicle_title || "car"} on WellCarDeals`,
      url: window.location.href,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        // AbortError = user cancelled the share sheet — no-op.
        if (err?.name !== "AbortError") {
          setShareError("Couldn't open the share sheet.");
        }
      }
      return;
    }
    try {
      if (!navigator.clipboard) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(window.location.href);
      setJustCopied(true);
      setTimeout(() => setJustCopied(false), 2000);
    } catch {
      // Last-resort fallback so the link is still shareable somehow.
      window.prompt("Copy this link to share:", window.location.href);
    }
  }

  const scrollTo = (tabId) => {
    setActiveTab(tabId);
    const el = document.getElementById(tabId.toLowerCase().replace(/\s+/g, "-"));
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const vehicleDetailRows = [
    ["Variant", car.variant], ["Manufacturing Year", car.year], ["Registration Year", car.registration_year],
    ["Kilometer Driven", car.mileage_km != null ? `${Number(car.mileage_km).toLocaleString("en-IN")} km` : null],
    ["Fuel Type", car.fuel_type_id ? "Petrol" : null], ["Transmission", car.transmission_id ? "Manual" : null],
    ["Ownership", car.ownership], ["Insurance Validity", car.insurance_validity],
    ["RTO", car.registration_state], ["Engine Capacity", car.engine_capacity],
    ["Power", car.horsepower ? `${car.horsepower} bhp` : null], ["Torque", car.torque],
    ["Seats", car.seating_capacity], ["Doors", car.doors], ["Service History", car.service_history],
  ].filter(([, v]) => v !== null && v !== undefined && v !== "");

  const trustBullets = [
    { icon: BadgeCheck, title: "Quality Checked", sub: "150+ Point Inspection" },
    { icon: ShieldCheck, title: "Ownership Verified", sub: "RC & Legal Verified" },
    { icon: Lock, title: "Insurance Verified", sub: "Active & Valid" },
    { icon: UserCheck, title: "No Hidden Charges", sub: "Transparent Pricing" },
    { icon: Truck, title: "Pan India Delivery", sub: "Safe & Fast Delivery" },
    { icon: Wallet, title: "Easy Loan Assistance", sub: "Lowest Interest Rates" },
  ];

  const trustStrip = [
    { icon: BadgeCheck, label: "150+ Point Inspection" },
    { icon: UserCheck, label: "No Hidden Charges" },
    { icon: ShieldCheck, label: "RC & Legal Verified" },
    { icon: Lock, label: "Insurance Verified" },
    { icon: FileText, label: "Fast RC Transfer" },
  ];

  // Quick bid options
  const quickBids = [
    { label: `+${formatINR(minIncrement)}`, amount: nextMinBid },
    { label: `+${formatINR(minIncrement * 2)}`, amount: (currentBid || basePrice || 0) + minIncrement * 2 },
    { label: `+${formatINR(minIncrement * 5)}`, amount: (currentBid || basePrice || 0) + minIncrement * 5 },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <DealerApprovalModal isOpen={showApprovalModal} onClose={() => setShowApprovalModal(false)} />

      {/* Bid Confirmation Modal */}
      <BidConfirmModal
        isOpen={bidModalOpen}
        onClose={() => { if (!placingBid) { setBidModalOpen(false); setPendingBidAmount(null); } }}
        onConfirm={confirmBid}
        amount={pendingBidAmount}
        currentBid={currentBid || basePrice}
        carTitle={car.vehicle_title}
        placing={placingBid}
      />

      {/* Breadcrumb */}
      <div className="text-xs text-gray-500 flex items-center gap-1.5 mb-4">
        <Link to="/" className="hover:underline">Home</Link>
        <span>›</span>
        <Link to="/#live-listings" className="hover:underline">Buy Cars</Link>
        <span>›</span>
        <span className="text-gray-800">{car.vehicle_title}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Gallery */}
        <div className="lg:col-span-5 min-w-0">
          <div className="flex gap-3 min-w-0">
            {images.length > 1 && (
              <div className="hidden sm:flex flex-col gap-2 w-16 flex-shrink-0">
                {images.slice(0, 5).map((src, i) => (
                  <button key={i} onClick={() => setActiveImg(i)}
                    className={`h-14 w-16 rounded-lg overflow-hidden border-2 flex-shrink-0 ${i === activeImg ? "border-brand" : "border-transparent"}`}>
                    <img src={src} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
                {images.length > 5 && (
                  <button onClick={() => setActiveImg(5)} className="h-14 w-16 rounded-lg bg-navy-900 text-white text-[11px] font-semibold flex items-center justify-center">
                    +{images.length - 5} More
                  </button>
                )}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="relative h-72 md:h-80 rounded-2xl overflow-hidden bg-gray-100 border border-gray-200">
                <div className="absolute top-3 left-3 right-3 z-10 flex flex-wrap items-center gap-1.5">
                  {car.is_verified && (
                    <span className="flex items-center gap-1 bg-white/95 text-navy-900 text-[10px] sm:text-[11px] font-semibold px-2 sm:px-2.5 py-1 rounded-full shadow-sm whitespace-nowrap">
                      <BadgeCheck size={12} className="text-brand shrink-0" /> Verified Vehicle
                    </span>
                  )}
                  {isInspected && (
                    <span className="flex items-center gap-1 bg-white/95 text-navy-900 text-[10px] sm:text-[11px] font-semibold px-2 sm:px-2.5 py-1 rounded-full shadow-sm capitalize whitespace-nowrap">
                      <CheckCircle2 size={12} className={`shrink-0 ${overallInspectionStatus === "poor" ? "text-red-500" : overallInspectionStatus === "fair" ? "text-amber-500" : "text-emerald-600"}`} />
                      Inspected — {overallInspectionStatus}
                    </span>
                  )}
                  {noAccident && (
                    <span className="flex items-center gap-1 bg-white/95 text-navy-900 text-[10px] sm:text-[11px] font-semibold px-2 sm:px-2.5 py-1 rounded-full shadow-sm whitespace-nowrap">
                      <ShieldCheck size={12} className="text-amber-500 shrink-0" /> No Accident History
                    </span>
                  )}
                </div>
                {images.length > 0 ? (
                  <img src={images[activeImg]} alt={car.vehicle_title} onClick={() => setLightboxOpen(true)} className="w-full h-full object-cover cursor-pointer" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">No image</div>
                )}
                {images.length > 1 && (
                  <>
                    <button onClick={() => setActiveImg((i) => (i - 1 + images.length) % images.length)} className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/90 rounded-full p-2 shadow hover:bg-white"><ChevronLeft size={18} /></button>
                    <button onClick={() => setActiveImg((i) => (i + 1) % images.length)} className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/90 rounded-full p-2 shadow hover:bg-white"><ChevronRight size={18} /></button>
                    <div className="absolute bottom-3 right-3 bg-navy-900/70 text-white text-xs px-2 py-1 rounded-full">{activeImg + 1} / {images.length}</div>
                  </>
                )}
              </div>
              <div className="flex sm:hidden gap-2 mt-3 overflow-x-auto">
                {images.map((src, i) => (
                  <button key={i} onClick={() => setActiveImg(i)} className={`h-16 w-20 flex-shrink-0 rounded-lg overflow-hidden border-2 ${i === activeImg ? "border-brand" : "border-transparent"}`}>
                    <img src={src} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Quick specs */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-4">
            {[
              [Calendar, car.year, "Year"],
              [Fuel, car.fuel_type_id ? "Petrol" : null, "Fuel"],
              [Settings2, car.transmission_id ? "Manual" : null, "Transmission"],
              [Gauge, car.mileage_km != null ? `${Math.round(Number(car.mileage_km) / 1000)}k km` : null, "Driven"],
              [MapPin, car.location, "Delhi RTO"],
              [UserCheck, car.ownership ? `${car.ownership} Owner` : null, "Ownership"],
            ].filter(([, v]) => v).map(([Icon, value, label], i) => (
              <div key={i} className="border border-gray-200 rounded-lg p-2 text-center">
                <Icon size={14} className="mx-auto text-gray-400 mb-1" />
                <p className="text-[11px] font-semibold text-gray-900 truncate">{value}</p>
                <p className="text-[10px] text-gray-400">{label}</p>
              </div>
            ))}
          </div>

          {(images360.length > 0 || videos.length > 0) && (
            <div className="flex gap-2 mt-3">
              {images360.length > 0 && (
                <a href={images360[0]} target="_blank" rel="noreferrer" className="flex-1 flex items-center justify-center gap-1.5 border border-gray-200 rounded-xl py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50">
                  <RotateCw size={14} /> 360° View
                </a>
              )}
              {videos.length > 0 && (
                <a href={videos[0]} target="_blank" rel="noreferrer" className="flex-1 flex items-center justify-center gap-1.5 border border-gray-200 rounded-xl py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50">
                  <PlayCircle size={14} /> Watch Video
                </a>
              )}
            </div>
          )}
        </div>

        {/* Middle */}
        <div className="lg:col-span-7 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              {car.status === "live" && (
                <p className="text-red-600 text-xs font-semibold flex items-center gap-1 mb-1">
                  <span className="h-2 w-2 rounded-full bg-red-600 inline-block animate-pulse" /> LIVE
                </p>
              )}
              <h1 className="text-2xl font-bold text-gray-900 leading-tight">{car.vehicle_title}</h1>
              {(car.variant || car.category_id) && <p className="text-sm text-gray-500 mt-1">{car.variant}</p>}
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <div className="flex items-center gap-3 text-gray-400">
                <ShareButton onShare={shareCar} justCopied={justCopied} size={18} className="hover:text-gray-700" />
                <WishlistButton isSaved={Boolean(wishlistRowId)} saving={wishlistSaving} onToggle={toggleWishlist} size={18} className="hover:text-gray-700" />
              </div>
              {(wishlistError || shareError) && (
                <p className="text-[11px] text-red-500 text-right max-w-[160px]">{wishlistError || shareError}</p>
              )}
            </div>
          </div>

          <div className="mt-4 border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-400">Best Price</p>
            <p className="text-3xl font-bold text-gray-900 mt-0.5">{formatINR(displayPrice)}</p>
            <p className="text-[11px] text-gray-400 mt-1">Inclusive of all charges</p>
          </div>

          <div className="mt-3 space-y-2">
            {role !== "dealer" && !buyOpen && (
              user ? (
                <button onClick={() => setBuyOpen(true)} className="w-full flex items-center justify-center gap-2 bg-navy-900 hover:bg-navy-700 text-white font-semibold py-3 rounded-xl transition">
                  <ShoppingCart size={16} /> Buy Now — {formatINR(displayPrice)}
                </button>
              ) : (
                <Link to="/login" className="w-full flex items-center justify-center gap-2 bg-navy-900 hover:bg-navy-700 text-white font-semibold py-3 rounded-xl transition">
                  <ShoppingCart size={16} /> Log In to Buy
                </Link>
              )
            )}
          </div>

          <p className="flex items-center gap-1.5 text-[11px] text-emerald-600 mt-3">
            <Lock size={12} /> Secure Transaction — 100% Safe & Secure Payments
          </p>

          {!isApprovedDealer && role !== "dealer" && (
            <div className="mt-4">
              {buySent ? (
                <div className="flex items-start gap-2 text-emerald-600 border border-emerald-100 bg-emerald-50
