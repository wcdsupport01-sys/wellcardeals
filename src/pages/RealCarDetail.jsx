import React, { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ShieldCheck, MapPin, Share2, Heart, ChevronLeft, ChevronRight, Gavel, TrendingUp,
  ShoppingCart, CheckCircle2, BadgeCheck, Fuel, Settings2, Gauge, UserCheck,
  Wallet, Truck, PhoneCall, Lock, Calendar, PlayCircle, RotateCw,
  FileText, Download, Plus, X, AlertCircle,
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

      <div className="grid lg:grid-cols-12 gap-6">
        {/* Gallery */}
        <div className="lg:col-span-5">
          <div className="flex gap-3">
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
                <div className="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-1.5 max-w-[85%]">
                  {car.is_verified && (
                    <span className="flex items-center gap-1 bg-white/95 text-navy-900 text-[11px] font-semibold px-2.5 py-1 rounded-full shadow-sm">
                      <BadgeCheck size={12} className="text-brand" /> Verified Vehicle
                    </span>
                  )}
                  {isInspected && (
                    <span className="flex items-center gap-1 bg-white/95 text-navy-900 text-[11px] font-semibold px-2.5 py-1 rounded-full shadow-sm capitalize">
                      <CheckCircle2 size={12} className={overallInspectionStatus === "poor" ? "text-red-500" : overallInspectionStatus === "fair" ? "text-amber-500" : "text-emerald-600"} />
                      Inspected — {overallInspectionStatus}
                    </span>
                  )}
                  {noAccident && (
                    <span className="flex items-center gap-1 bg-white/95 text-navy-900 text-[11px] font-semibold px-2.5 py-1 rounded-full shadow-sm">
                      <ShieldCheck size={12} className="text-amber-500" /> No Accident History
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
        <div className="lg:col-span-7">
          <div className="flex items-start justify-between">
            <div>
              {car.status === "live" && (
                <p className="text-red-600 text-xs font-semibold flex items-center gap-1 mb-1">
                  <span className="h-2 w-2 rounded-full bg-red-600 inline-block animate-pulse" /> LIVE
                </p>
              )}
              <h1 className="text-2xl font-bold text-gray-900 leading-tight">{car.vehicle_title}</h1>
              {(car.variant || car.category_id) && <p className="text-sm text-gray-500 mt-1">{car.variant}</p>}
            </div>
            <div className="flex items-center gap-3 text-gray-400 flex-shrink-0">
              <Share2 size={18} className="cursor-pointer hover:text-gray-700" />
              <Heart size={18} className="cursor-pointer hover:text-gray-700" />
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
                <div className="flex items-start gap-2 text-emerald-600 border border-emerald-100 bg-emerald-50 rounded-xl p-4">
                  <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold">Request sent!</p>
                    <p className="text-xs text-gray-500 mt-0.5">Our team will contact you shortly to complete the purchase.</p>
                  </div>
                </div>
              ) : buyOpen && user ? (
                <div className="space-y-2 border border-gray-200 rounded-xl p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Buy Now</p>
                  <input type="tel" value={buyPhone} onChange={(e) => setBuyPhone(e.target.value)} placeholder="Your phone number" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
                  <textarea value={buyMessage} onChange={(e) => setBuyMessage(e.target.value)} placeholder="Anything you'd like us to know? (optional)" rows={2} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none" />
                  {buyError && <p className="text-xs text-red-600">{buyError}</p>}
                  <button disabled={buySubmitting} onClick={submitBuyRequest} className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition">
                    <ShoppingCart size={16} />
                    {buySubmitting ? "Sending…" : `Confirm — ${formatINR(displayPrice)}`}
                  </button>
                </div>
              ) : null}
            </div>
          )}

          {user && myBids.length > 0 && (
            <div className="mt-4 border border-gray-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Your Bids</p>
              <ul className="text-sm divide-y divide-gray-100">
                {myBids.slice(0, 5).map((b) => (
                  <li key={b.id} className="flex justify-between py-1.5">
                    <span className="text-gray-500">{new Date(b.created_at).toLocaleString("en-IN")}</span>
                    <span className="font-medium text-gray-900">{formatINR(b.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

      </div>

      {/* Auction Panel — full width, moved down from the sidebar */}
      <div className="bg-navy-gradient text-white rounded-2xl p-5 md:p-6 mt-6">
        {car.listing_type !== "buy_now_only" ? (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Left half: status + current bid */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-red-400 text-xs font-semibold flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-red-500 inline-block animate-pulse" /> LIVE
                </p>
                <div className="flex items-center gap-2 text-white/60">
                  <Share2 size={14} className="cursor-pointer hover:text-white" />
                  <Heart size={14} className="cursor-pointer hover:text-white" />
                </div>
              </div>

              {car.auction_end && (
                <>
                  <p className="text-[11px] text-white/60 mb-1.5">Auction Ends In</p>
                  <div className="grid grid-cols-3 gap-2 mb-4 max-w-xs">
                    {[[pad(countdown.hours), "HRS"], [pad(countdown.minutes), "MINS"], [pad(countdown.seconds), "SECS"]].map(([val, label]) => (
                      <div key={label} className="bg-white/10 rounded-lg text-center py-2">
                        <p className="text-lg font-bold tabular-nums">{val}</p>
                        <p className="text-[9px] text-white/50">{label}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Current bid card */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                <p className="text-[11px] text-white/60">Current Highest Bid</p>
                <p className="text-3xl font-extrabold mt-0.5">{formatINR(currentBid)}</p>
                <p className="text-[11px] text-white/40 mt-0.5">
                  {car.highest_bidder_name ? `by ${car.highest_bidder_name}` : "reached across all dealer bids so far"}
                </p>
                <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-white/10 text-xs">
                  <div><p className="text-white/50">Starting Bid</p><p className="font-semibold">{formatINR(car.starting_bid)}</p></div>
                  <div><p className="text-white/50">Reserve Price</p><p className="font-semibold">{formatINR(car.reserve_price)}</p></div>
                  <div><p className="text-white/50">Min Increment</p><p className="font-semibold">{formatINR(minIncrement)}</p></div>
                </div>
                {isApprovedDealer && myBids.length > 0 && (
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/10 bg-brand/10 -mx-4 -mb-4 px-4 py-2.5 rounded-b-2xl">
                    <div>
                      <p className="text-[10px] text-white/60">Your Last Bid</p>
                      <p className="text-sm font-bold text-white">{formatINR(myBids[0].amount)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-white/60">Total Bids by You</p>
                      <p className="text-sm font-bold text-white">{myBids.length}</p>
                    </div>
                  </div>
                )}
              </div>

              {!isApprovedDealer && (
                <div className="mt-5 md:hidden">
                  {!countdown.isEnded ? (
                    !user ? (
                      <Link to="/login" className="w-full flex items-center justify-center gap-2 bg-white text-navy-900 font-semibold py-3 rounded-xl hover:bg-white/90 transition">
                        Log In to Bid / Buy
                      </Link>
                    ) : (
                      <button onClick={() => setBuyOpen(true)} className="w-full flex items-center justify-center gap-2 bg-white text-navy-900 font-semibold py-3 rounded-xl hover:bg-white/90 transition">
                        <ShoppingCart size={16} /> Buy Now — {formatINR(displayPrice)}
                      </button>
                    )
                  ) : (
                    <p className="text-center text-[11px] text-white/50">This auction has ended</p>
                  )}
                </div>
              )}
            </div>

            {/* Right half: bidding actions */}
            <div>
              {!countdown.isEnded && isApprovedDealer ? (
                <div>
                  {/* Section header — clearly a bidding panel */}
                  <div className="flex items-center gap-1.5 mb-3">
                    <Gavel size={13} className="text-brand" />
                    <p className="text-xs font-bold text-white uppercase tracking-wide">Place Your Bid</p>
                  </div>

                  {/* Reserve + Minimum bid facts, so there's no confusion on the floor price */}
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <div className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5">
                      <p className="text-[10px] text-white/50 flex items-center gap-1"><Lock size={9} /> Reserve Price</p>
                      <p className="text-sm font-bold text-white mt-0.5">{formatINR(car.reserve_price)}</p>
                    </div>
                    <div className="bg-brand/15 border border-brand/40 rounded-xl px-3 py-2.5">
                      <p className="text-[10px] text-white/70">Minimum Bid Now</p>
                      <p className="text-sm font-bold text-white mt-0.5">{formatINR(nextMinBid)}</p>
                    </div>
                  </div>

                  {/* Quick Bid Buttons — one tap, then a Sure/Not Sure confirmation */}
                  <p className="text-[10px] text-white/50 uppercase tracking-wide mb-2">Option 1 — Tap an Amount</p>
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {quickBids.map(({ label, amount }) => (
                      <button
                        key={label}
                        onClick={() => initiateBid(amount)}
                        className="group flex flex-col items-center justify-center gap-0.5 bg-white/10 hover:bg-brand border border-white/15 hover:border-brand text-white rounded-2xl py-3 transition active:scale-95"
                      >
                        <span className="text-[9px] text-white/60 group-hover:text-white/90">{label}</span>
                        <span className="text-[13px] font-bold leading-tight">{formatINR(amount)}</span>
                      </button>
                    ))}
                  </div>

                  {/* Custom Bid */}
                  <p className="text-[10px] text-white/50 uppercase tracking-wide mb-2">Option 2 — Enter Your Own Amount</p>
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50 text-sm pointer-events-none z-10">₹</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={customAmount}
                        onChange={(e) => setCustomAmount(e.target.value.replace(/[^0-9]/g, ""))}
                        placeholder={`Min ${nextMinBid.toLocaleString("en-IN")}`}
                        style={{ backgroundColor: "rgba(255,255,255,0.15)", color: "#ffffff" }}
                        className="w-full border border-white/25 placeholder-white/40 rounded-xl pl-7 pr-3 py-3 text-sm font-medium focus:outline-none focus:border-brand focus:bg-white/20"
                      />
                    </div>
                    <button
                      onClick={() => initiateBid(Number(customAmount))}
                      className="flex items-center gap-1.5 bg-brand hover:bg-brand-600 font-semibold text-sm px-4 rounded-xl transition active:scale-95 whitespace-nowrap"
                    >
                      <Gavel size={14} /> Place Bid
                    </button>
                  </div>
                  <p className="text-[10px] text-white/40 mt-1.5 flex items-center gap-1">
                    <AlertCircle size={11} /> You'll always see a Sure / Not Sure step before your bid is placed
                  </p>

                  {bidError && <p className="text-xs text-red-300 bg-red-500/10 px-3 py-2 rounded-lg mt-3">{bidError}</p>}

                  {/* Clearly separated — this is NOT part of bidding */}
                  <div className="flex items-center gap-2 my-4">
                    <div className="flex-1 h-px bg-white/10" />
                    <span className="text-[10px] text-white/40 uppercase tracking-wide">Or Skip Bidding</span>
                    <div className="flex-1 h-px bg-white/10" />
                  </div>
                  <button
                    onClick={() => user && setBuyOpen(true)}
                    className="w-full border border-white/25 text-white font-semibold py-3 rounded-xl hover:bg-white/10 transition flex items-center justify-center gap-2"
                  >
                    <ShoppingCart size={15} /> Buy Now — {formatINR(displayPrice)}
                  </button>
                </div>
              ) : !isApprovedDealer ? (
                <div className="hidden md:flex h-full items-center justify-center">
                  {!user ? (
                    <Link to="/login" className="w-full flex items-center justify-center gap-2 bg-white text-navy-900 font-semibold py-3 rounded-xl hover:bg-white/90 transition">
                      Log In to Bid / Buy
                    </Link>
                  ) : (
                    <button onClick={() => setBuyOpen(true)} className="w-full flex items-center justify-center gap-2 bg-white text-navy-900 font-semibold py-3 rounded-xl hover:bg-white/90 transition">
                      <ShoppingCart size={16} /> Buy Now — {formatINR(displayPrice)}
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-center text-[11px] text-white/50 mt-2">This auction has ended</p>
              )}
            </div>
          </div>
        ) : (
          <div className="max-w-sm">
            <p className="text-white/60 text-xs font-semibold uppercase tracking-wide mb-2">Buy Now Listing</p>
            <p className="text-2xl font-bold">{formatINR(displayPrice)}</p>
            <p className="text-[11px] text-white/50 mt-1">Instant purchase • No bidding</p>
            {user ? (
              <button onClick={() => setBuyOpen(true)} className="w-full mt-5 flex items-center justify-center gap-2 bg-white text-navy-900 font-semibold py-3 rounded-xl hover:bg-white/90 transition">
                <ShoppingCart size={16} /> Buy Now
              </button>
            ) : (
              <Link to="/login" className="w-full mt-5 flex items-center justify-center gap-2 bg-white text-navy-900 font-semibold py-3 rounded-xl hover:bg-white/90 transition">
                <ShoppingCart size={16} /> Log In to Buy
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Trust strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 border border-gray-200 rounded-xl px-4 py-3 mt-6 bg-surface/40">
        {trustStrip.map(({ icon: Icon, label }) => (
          <span key={label} className="flex items-center gap-1.5 text-[11px] font-medium text-gray-600">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-brand-50 text-brand flex-shrink-0"><Icon size={12} /></span>
            {label}
          </span>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-6 border-b border-gray-200 mt-10 mb-8 overflow-x-auto">
        {TABS.map((tab) => (
          <button key={tab} onClick={() => scrollTo(tab)}
            className={`whitespace-nowrap pb-3 text-sm font-semibold border-b-2 transition ${activeTab === tab ? "border-brand text-brand" : "border-transparent text-gray-500 hover:text-gray-800"}`}>
            {tab}
          </button>
        ))}
      </div>

      {/* Overview */}
      <div id="overview" className="grid md:grid-cols-3 gap-6 scroll-mt-24">
        <div className="border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-bold text-red-600 mb-3">VEHICLE DETAILS</h2>
          <dl className="text-sm divide-y divide-gray-100">
            {vehicleDetailRows.map(([label, value]) => (
              <div key={label} className="flex justify-between py-2">
                <dt className="text-gray-500">{label}</dt>
                <dd className="font-medium text-gray-900">{value}</dd>
              </div>
            ))}
            {vehicleDetailRows.length === 0 && <p className="text-sm text-gray-400 py-2">No details added yet.</p>}
          </dl>
        </div>

        <div id="inspection-report" className="border border-gray-200 rounded-xl p-5 scroll-mt-24">
          <h2 className="text-sm font-bold text-red-600 mb-3">INSPECTION REPORT</h2>
          {isInspected ? (
            <>
              <p className={`text-2xl font-bold capitalize mb-1 ${overallInspectionStatus === "poor" ? "text-red-600" : overallInspectionStatus === "fair" ? "text-amber-600" : "text-emerald-600"}`}>
                {overallInspectionStatus}
              </p>
              <p className="text-xs text-gray-400 mb-4">
                {inspectedCount} of {inspectionEntries.length} categories checked
                {car.inspected_at ? ` · Inspected ${new Date(car.inspected_at).toLocaleDateString("en-IN")}` : ""}
              </p>
              <div className="space-y-3">
                {inspectionEntries.map(({ key, label, status, note }) => (
                  <div key={key}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-600">{label}</span>
                      {status ? <span className={`capitalize font-medium ${status === "poor" ? "text-red-600" : status === "fair" ? "text-amber-600" : "text-emerald-600"}`}>{status}</span>
                        : <span className="text-gray-400">Not checked</span>}
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${status === "poor" ? "bg-red-500" : status === "fair" ? "bg-amber-500" : status === "good" ? "bg-emerald-500" : "bg-gray-200"}`}
                        style={{ width: status === "poor" ? "30%" : status === "fair" ? "60%" : status === "good" ? "100%" : "0%" }} />
                    </div>
                    {note && <p className="text-[11px] text-gray-500 mt-1">{note}</p>}
                  </div>
                ))}
              </div>
              {car.inspection_notes && <div className="mt-4 bg-gray-50 text-gray-600 text-xs rounded-lg px-3 py-2">{car.inspection_notes}</div>}
            </>
          ) : <p className="text-sm text-gray-400">Inspection report not available for this listing yet.</p>}
        </div>

        <div className="border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-bold text-red-600 mb-3">SPECIFICATIONS</h2>
          {specifications.length > 0 ? (
            <dl className="text-sm divide-y divide-gray-100">
              {specifications.map(([label, value]) => (
                <div key={label} className="flex justify-between py-2">
                  <dt className="text-gray-500">{label}</dt>
                  <dd className="font-medium text-gray-900">{String(value)}</dd>
                </div>
              ))}
            </dl>
          ) : <p className="text-sm text-gray-400">No additional specifications added yet.</p>}
          {totalFeatureCount > 0 && (
            <button onClick={() => scrollTo("Features")} className="mt-4 w-full text-xs font-semibold text-brand hover:text-brand-600 flex items-center justify-center gap-1">
              View all {totalFeatureCount} features <ChevronRight size={12} />
            </button>
          )}
        </div>

        <div className="border border-gray-200 rounded-xl p-5">
          <p className="text-[11px] text-gray-400 uppercase tracking-wide">Sold By</p>
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-1.5 mt-0.5">Well Cars Deal <BadgeCheck size={16} className="text-brand" /></h2>
          <p className="text-xs text-gray-400 mb-4">Trusted Marketplace</p>
          <ul className="space-y-3">
            {trustBullets.map(({ icon: Icon, title, sub }) => (
              <li key={title} className="flex items-start gap-3">
                <span className="mt-0.5 text-brand"><Icon size={16} /></span>
                <div><p className="text-sm font-medium text-gray-900 leading-tight">{title}</p><p className="text-[11px] text-gray-400">{sub}</p></div>
              </li>
            ))}
          </ul>
          <div className="mt-5 border border-gray-200 rounded-xl p-3 text-center">
            <p className="text-sm font-semibold text-gray-900">Have Questions?</p>
            <p className="text-[11px] text-gray-400 mb-2">Request a callback from our experts</p>
            <button onClick={() => (user ? setBuyOpen(true) : scrollTo("Overview"))} className="w-full flex items-center justify-center gap-1.5 border border-brand text-brand text-sm font-semibold py-2 rounded-lg hover:bg-brand-50 transition">
              <PhoneCall size={14} /> Request Callback
            </button>
          </div>
        </div>

        <div className="border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-bold text-red-600 mb-3">PRICE DETAILS</h2>
          <dl className="text-sm divide-y divide-gray-100">
            {[["Starting Bid", car.starting_bid], ["Reserve Price", car.reserve_price], ["Buy Now Price", car.buy_now_price], ["Bid Increment", minIncrement]]
              .filter(([, v]) => v !== null && v !== undefined)
              .map(([label, value]) => (
                <div key={label} className="flex justify-between py-2">
                  <dt className="text-gray-500">{label}</dt>
                  <dd className="font-medium text-gray-900">{formatINR(value)}</dd>
                </div>
              ))}
          </dl>
          <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between text-sm">
            <span className="text-gray-500">Current Price</span>
            <span className="font-bold text-gray-900">{formatINR(displayPrice)}</span>
          </div>
        </div>

        <div className="border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-bold text-red-600 mb-3">LATEST UPDATES</h2>
          <ul className="text-sm space-y-3">
            {[
              car.service_history && `Service history: ${car.service_history}`,
              car.accidental_history && `Accident history: ${car.accidental_history}`,
              car.rc_status && `RC status: ${car.rc_status}`,
              car.puc_status && `PUC status: ${car.puc_status}`,
              car.is_verified && "Documents and condition verified",
              car.number_of_keys != null && `${car.number_of_keys} key(s) available`,
            ].filter(Boolean).map((line, i) => (
              <li key={i} className="flex items-start justify-between gap-2">
                <span className="text-gray-600">{line}</span>
                <span className="flex-shrink-0 bg-red-600 text-white text-[10px] font-semibold px-2 py-0.5 rounded">NEW</span>
              </li>
            ))}
            {![car.service_history, car.accidental_history, car.rc_status, car.puc_status, car.is_verified, car.number_of_keys].some(Boolean) && (
              <p className="text-sm text-gray-400">No updates added yet.</p>
            )}
          </ul>
        </div>

        {car.description && (
          <div className="border border-gray-200 rounded-xl p-5 md:col-span-3">
            <h2 className="text-sm font-bold text-red-600 mb-3">DESCRIPTION</h2>
            <p className="text-sm text-gray-600 whitespace-pre-line">{car.description}</p>
          </div>
        )}
      </div>

      {/* Features */}
      <div id="features" className="border border-gray-200 rounded-xl p-5 mt-6 scroll-mt-24">
        <h2 className="text-sm font-bold text-red-600 mb-4">FEATURES</h2>
        {featureGroups.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {featureGroups.map(([label, items]) => (
              <div key={label}>
                <p className="text-xs font-semibold text-gray-900 uppercase tracking-wide mb-2">{label}</p>
                <ul className="space-y-1.5">
                  {items.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                      <CheckCircle2 size={13} className="text-emerald-600 flex-shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-gray-400">No feature list added for this listing yet.</p>}
      </div>

      {/* Documents */}
      <div id="documents" className="border border-gray-200 rounded-xl p-5 mt-6 scroll-mt-24">
        <h2 className="text-sm font-bold text-red-600 mb-4">DOCUMENTS</h2>
        {documents.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {documents.map((doc, i) => (
              <a key={i} href={doc.url} target="_blank" rel="noreferrer" className="flex items-center gap-2.5 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                <FileText size={16} className="text-brand flex-shrink-0" />
                <span className="flex-1 truncate">{doc.name || "Document"}</span>
                <Download size={14} className="text-gray-400 flex-shrink-0" />
              </a>
            ))}
          </div>
        ) : <p className="text-sm text-gray-400">No documents uploaded for this listing yet.</p>}
      </div>

      {/* Bottom sections */}
      <div className="grid md:grid-cols-3 gap-6 mt-10">
        <div className="border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-bold text-gray-900 mb-4">Why Buy From Well Cars Deal?</h2>
          <div className="grid grid-cols-2 gap-4">
            {[[BadgeCheck, "150+ Point", "Inspection"], [ShieldCheck, "No Hidden", "Charges"], [Lock, "Secure", "Payments"], [Truck, "Doorstep", "Delivery"]].map(([Icon, l1, l2], i) => (
              <div key={i} className="flex items-center gap-2.5">
                <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-brand-50 text-brand flex-shrink-0"><Icon size={16} /></span>
                <p className="text-xs font-medium text-gray-700 leading-tight">{l1} <br /> {l2}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-bold text-gray-900 mb-4">What's Included</h2>
          <ul className="space-y-2.5 text-sm text-gray-700">
            {["RC Transfer & Documentation", "150+ Point Inspection Report", "Free Delivery (Pan India)", "1 Year Warranty (Optional)", "24x7 Roadside Assistance", "Easy Loan Assistance"].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-600 flex-shrink-0" /> {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="border border-brand-100 bg-brand-50 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-bold text-navy-900 mb-1">Exchange Your Old Car</h2>
            <p className="text-xs text-gray-600">Get the best price for your old car — inspected and picked up from your doorstep.</p>
          </div>
          <Link to="/sell-car" className="mt-4 flex items-center justify-center gap-1.5 bg-brand hover:bg-brand-600 text-white text-sm font-semibold py-2.5 rounded-xl transition">
            Get Free Valuation <ChevronRight size={14} />
          </Link>
        </div>
      </div>

      {/* Similar Cars */}
      {similarCars.length > 0 && (
        <div id="similar-cars" className="mt-10 scroll-mt-24">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">Similar Cars You May Like</h2>
            <Link to="/#live-listings" className="text-xs font-semibold text-brand hover:text-brand-600">View All</Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {similarCars.map((c) => <CarCard key={c.id} car={c} isApprovedDealer={isApprovedDealer} />)}
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4" onClick={() => setLightboxOpen(false)}>
          <button onClick={() => setLightboxOpen(false)} className="absolute top-5 right-5 text-white bg-white/10 hover:bg-white/20 rounded-full p-2">✕</button>
          <img src={images[activeImg]} alt={car.vehicle_title} onClick={(e) => e.stopPropagation()} className="max-h-[85vh] max-w-full rounded-xl object-contain" />
          {images.length > 1 && (
            <>
              <button onClick={(e) => { e.stopPropagation(); setActiveImg((i) => (i - 1 + images.length) % images.length); }} className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/30 rounded-full p-3 text-white"><ChevronLeft size={22} /></button>
              <button onClick={(e) => { e.stopPropagation(); setActiveImg((i) => (i + 1) % images.length); }} className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/30 rounded-full p-3 text-white"><ChevronRight size={22} /></button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default RealCarDetail;
