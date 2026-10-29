import { backendCommand } from "../lib/backendCommands";
import React, { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ShieldCheck, MapPin, Share2, Heart, ChevronLeft, ChevronRight,
  ShoppingCart, CheckCircle2, BadgeCheck, Fuel, Settings2, Gauge, UserCheck,
  Wallet, Truck, PhoneCall, Lock, Calendar, PlayCircle, RotateCw,
  FileText, Download, Check,
} from "lucide-react";
import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";
import { useAuth } from "../auth/AuthContext";
import CarCard from "../components/CarCard";
import DealerCarDetail from "../dealer/DealerCarDetail";
import { INSPECTION_CATEGORIES } from "../admin/lib/lookups";

const TABS = ["Overview", "Features", "Inspection Report", "Documents", "Similar Cars"];

const formatINR = (value) =>
  value == null ? "—" : "₹" + Math.round(Number(value)).toLocaleString("en-IN");

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

const RealCarDetail = ({ mode = "purchase" }) => {
  const dealerAuction = mode === "dealer-auction";
  const { id } = useParams();
  const { role, dealerStatus, profile, user } = useAuth();
  const isApprovedDealer = role === "dealer" && dealerStatus === "approved";

  const [car, setCar] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeImg, setActiveImg] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);


  const [activeTab, setActiveTab] = useState("Overview");
  const [similarCars, setSimilarCars] = useState([]);

  const [buyOpen, setBuyOpen] = useState(false);
  const [buyPhone, setBuyPhone] = useState("");
  const [buyMessage, setBuyMessage] = useState("");
  const [buySubmitting, setBuySubmitting] = useState(false);
  const [buyError, setBuyError] = useState("");
  const [buySent, setBuySent] = useState(false);
  const [c2cOpen, setC2cOpen] = useState(false);
  const [c2cName, setC2cName] = useState("");
  const [c2cPhone, setC2cPhone] = useState("");
  const [c2cSubmitting, setC2cSubmitting] = useState(false);
  const [c2cError, setC2cError] = useState("");
  const [c2cSent, setC2cSent] = useState(false);

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
    let query = supabase.from("cars_catalog").select("*, fuel_types(name), transmissions(name)").eq("id", id);
    if (!dealerAuction) query = query.eq("listing_type", "buy_now_only").eq("access_type", "all");
    const { data, error } = await query.maybeSingle();
    if (error) setError(error.message);
    else { setError(null); setCar(data); }
    setLoading(false);
  }, [id, dealerAuction]);

  useEffect(() => { load(); setActiveImg(0); }, [load]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const channel = supabase.channel(`car-${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "cars", filter: `id=eq.${id}` },
        () => load())
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [id, load]);

  useEffect(() => {
    if (buyOpen) document.getElementById("purchase-request")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [buyOpen]);

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
      let query = supabase.from("cars_catalog").select("*").neq("id", car.id).eq("status", "live").limit(4);
      query = dealerAuction ? query.neq("listing_type", "buy_now_only") : query.eq("listing_type", "buy_now_only").eq("access_type", "all");
      if (car.brand_id) query = query.eq("brand_id", car.brand_id);
      let { data } = await query;
      if ((!data || data.length === 0) && car.category_id) {
        let fallbackQuery = supabase.from("cars_catalog").select("*").neq("id", car.id).eq("status", "live").eq("category_id", car.category_id).limit(4);
        fallbackQuery = dealerAuction ? fallbackQuery.neq("listing_type", "buy_now_only") : fallbackQuery.eq("listing_type", "buy_now_only").eq("access_type", "all");
        const fallback = await fallbackQuery;
        data = fallback.data;
      }
      if (!cancelled) setSimilarCars(data || []);
    })();
    return () => { cancelled = true; };
  }, [car?.id, car?.brand_id, car?.category_id, dealerAuction]);

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center text-gray-400">Loading…</div>;
  if (error || !car || (!dealerAuction && (car.listing_type !== "buy_now_only" || car.access_type !== "all"))) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6">
        <p className="text-gray-500">{error || "This listing doesn't exist or has been removed."}</p>
        <Link to="/buy-car" className="mt-4 text-sm font-semibold underline underline-offset-4">Browse available cars</Link>
      </div>
    );
  }

  const displayPrice = car.buy_now_price ?? car.base_price_buyer;

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

  async function submitBuyRequest() {
    const phone = buyPhone.trim() || profile?.phone?.trim() || "";
    if (role !== "buyer") { setBuyError("Sign in with a buyer account to send a purchase request."); return; }
    if (phone.replace(/\D/g, "").length < 8 || phone.replace(/\D/g, "").length > 15) { setBuyError("Enter a valid phone number."); return; }
    setBuyError(""); setBuySubmitting(true);
    try {
      const result = await backendCommand("purchase_request", { car_id:car.id, phone, message:buyMessage.trim(), expected_price:Number(car.buy_now_price) });
      if (!result?.request?.id) throw new Error("Your request could not be confirmed. Please retry.");
      setBuySent(true); setBuyOpen(false);
    } catch (failure) { setBuyError(failure.message || "Your request could not be confirmed. Please retry."); }
    finally { setBuySubmitting(false); }
  }

  async function submitC2cRequest() {
    setC2cError("");
    const name = c2cName.trim() || profile?.full_name || profile?.email || "";
    const phone = c2cPhone.trim() || profile?.phone || "";
    if (!name) { setC2cError("Please enter your name."); return; }
    if (!phone) { setC2cError("Please enter your phone number."); return; }
    setC2cSubmitting(true);
    const { error } = await supabase.from("c2c_deal_requests").insert({
      car_id: car.id, buyer_id: user?.id || null,
      buyer_name: name, buyer_phone: phone,
    });
    setC2cSubmitting(false);
    if (error) setC2cError("Something went wrong. Please try again.");
    else setC2cSent(true);
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
    ["Fuel Type", car.fuel_types?.name], ["Transmission", car.transmissions?.name],
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

  if (dealerAuction && isApprovedDealer && car.listing_type !== "buy_now_only") {
    return <DealerCarDetail key={`${car.id}:${user.id}`} car={car} user={user} onCarChange={setCar} similarCars={similarCars}
      actions={<><ShareButton onShare={shareCar} justCopied={justCopied} /><WishlistButton isSaved={Boolean(wishlistRowId)} saving={wishlistSaving} onToggle={toggleWishlist} /></>}
      actionError={wishlistError || shareError} />;
  }

  if (dealerAuction) return <div className="max-w-3xl mx-auto px-6 py-16 text-center"><p className="text-gray-600">This vehicle is available for direct purchase.</p><Link to={`/cars/${car.id}`} className="inline-block mt-4 text-brand font-semibold">View purchase details</Link></div>;

  function purchaseAction(className) {
    if (car.status !== "live") return <p className="text-sm py-3">This car is currently unavailable for purchase.</p>;
    if (!user) return <Link to="/login" className={className}><ShoppingCart size={16} />Log In to Buy</Link>;
    if (role !== "buyer") return <a href="tel:+917836008277" className={className}><PhoneCall size={16} />Call to enquire</a>;
    return <button onClick={() => setBuyOpen(true)} className={className}><ShoppingCart size={16} />Buy Now — {formatINR(displayPrice)}</button>;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8" data-purchase-detail>
      {/* Breadcrumb */}
      <div className="text-xs text-gray-500 flex items-center gap-1.5 mb-4">
        <Link to="/" className="hover:underline">Home</Link>
        <span>›</span>
        <Link to="/buy-car" className="hover:underline">Buy Cars</Link>
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
              [Fuel, car.fuel_types?.name, "Fuel"],
              [Settings2, car.transmissions?.name, "Transmission"],
              [Gauge, car.mileage_km != null ? `${Math.round(Number(car.mileage_km) / 1000)}k km` : null, "Driven"],
              [MapPin, car.registration_state || car.location, "Registration"],
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
                <p className="text-emerald-700 text-xs font-semibold flex items-center gap-1 mb-1">
                  <CheckCircle2 size={13} /> Available for purchase
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
            {!buyOpen && !buySent && purchaseAction("w-full flex items-center justify-center gap-2 bg-navy-900 hover:bg-navy-700 text-white font-semibold py-3 rounded-xl transition")}
          </div>

          <p className="flex items-center gap-1.5 text-[11px] text-emerald-600 mt-3">
            <Lock size={12} /> Our team will confirm availability and purchase details
          </p>

          {role === "buyer" && (
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
                <div id="purchase-request" className="space-y-2 border border-gray-200 rounded-xl p-4 scroll-mt-28">
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

      {car.channel !== "dealer" &&
  car.access_type === "all" &&
  car.listing_type === "buy_now_only" &&
  car.c2c_enabled === true && (
    <div className="mt-4 border border-amber-200 bg-amber-50/50 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-1">
        <UserCheck size={16} className="text-amber-600" />
        <p className="text-sm font-semibold text-navy-900">
          C2C Deal
        </p>
        <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
          3% commission
        </span>
      </div>

      <p className="text-xs text-gray-600 mb-3">
        Deal directly with the seller. A flat 3%
        commission applies to both buyer and seller, and our
        representative stays with you through the entire deal.
      </p>

      {c2cSent ? (
              <div className="space-y-2">
                <input type="text" value={c2cName} onChange={(e) => setC2cName(e.target.value)} placeholder="Your name" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
                <input type="tel" value={c2cPhone} onChange={(e) => setC2cPhone(e.target.value)} placeholder="Your phone number" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
                {c2cError && <p className="text-xs text-red-600">{c2cError}</p>}
                <button disabled={c2cSubmitting} onClick={submitC2cRequest} className="w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl transition text-sm">
                  {c2cSubmitting ? "Sending…" : "Confirm — Start C2C Deal"}
                </button>
              </div>
            ) : (
              <button onClick={() => { setC2cOpen(true); if (!c2cName) setC2cName(profile?.full_name || ""); if (!c2cPhone) setC2cPhone(profile?.phone || ""); }} className="w-full flex items-center justify-center gap-2 border border-amber-300 text-amber-700 hover:bg-amber-100 font-semibold py-2.5 rounded-xl transition text-sm">
                Start C2C Deal
              </button>
            )}
          </div>
    )}
          

        </div>

      </div>

      {/* Direct purchase finance estimate */}
      <div className="bg-navy-gradient text-white rounded-2xl p-5 md:p-6 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-white/60 text-xs font-semibold uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <Wallet size={13} /> EMI Calculator
            </p>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-[10px] text-white/50">Down Payment</label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50 text-sm pointer-events-none">₹</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={downPayment}
                    onChange={(e) => setDownPayment(e.target.value.replace(/[^0-9]/g, ""))}
                    placeholder="0"
                    style={{ backgroundColor: "rgba(255,255,255,0.15)", color: "#ffffff" }}
                    className="w-full border border-white/25 placeholder-white/40 rounded-xl pl-7 pr-2 py-2 text-sm font-medium focus:outline-none focus:border-brand focus:bg-white/20"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-white/50">Tenure</label>
                <select
                  value={tenureMonths}
                  onChange={(e) => setTenureMonths(Number(e.target.value))}
                  style={{ backgroundColor: "rgba(255,255,255,0.15)", color: "#ffffff" }}
                  className="w-full mt-1 border border-white/25 rounded-xl px-2 py-2 text-sm font-medium focus:outline-none focus:border-brand"
                >
                  {[12, 24, 36, 48, 60, 72].map((m) => (
                    <option key={m} value={m} className="text-navy-900">{m} months</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between">
                <label className="text-[10px] text-white/50">Interest Rate</label>
                <span className="text-xs text-white/70 font-medium">{interestRate.toFixed(1)}% p.a.</span>
              </div>
              <input
                type="range"
                min="7"
                max="16"
                step="0.1"
                value={interestRate}
                onChange={(e) => setInterestRate(Number(e.target.value))}
                className="w-full mt-1.5 accent-brand"
              />
            </div>

            <div className="bg-white/10 border border-white/15 rounded-2xl p-4 text-center">
              <p className="text-[11px] text-white/60">Estimated Monthly EMI</p>
              <p className="text-3xl font-extrabold mt-1">{formatINR(emiAmount)}</p>
              <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-white/10 text-xs">
                <div>
                  <p className="text-white/50">Loan Amount</p>
                  <p className="font-semibold">{formatINR(loanAmount)}</p>
                </div>
                <div>
                  <p className="text-white/50">Total Payable</p>
                  <p className="font-semibold">{formatINR(emiAmount * tenureMonths)}</p>
                </div>
              </div>
            </div>

            <p className="text-[10px] text-white/40 mt-2">Indicative only — actual EMI depends on lender terms and eligibility.</p>

            {purchaseAction("w-full mt-4 flex items-center justify-center gap-2 bg-white text-navy-900 font-semibold py-3 rounded-xl hover:bg-white/90 transition")}
          </div>

          {/* Sold By — moved up beside the EMI calculator */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 md:p-5">
            <p className="text-[11px] text-white/50 uppercase tracking-wide">Sold By</p>
            <h2 className="text-base font-bold text-white flex items-center gap-1.5 mt-0.5">
              Well Cars Deal <BadgeCheck size={16} className="text-brand" />
            </h2>
            <p className="text-xs text-white/40 mb-4">Trusted Marketplace</p>
            <ul className="space-y-3">
              {trustBullets.map(({ icon: Icon, title, sub }) => (
                <li key={title} className="flex items-start gap-3">
                  <span className="mt-0.5 text-brand"><Icon size={16} /></span>
                  <div>
                    <p className="text-sm font-medium text-white leading-tight">{title}</p>
                    <p className="text-[11px] text-white/40">{sub}</p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-5 border border-white/15 rounded-xl p-3 text-center">
              <p className="text-sm font-semibold text-white">Have Questions?</p>
              <p className="text-[11px] text-white/40 mb-2">Request a callback from our experts</p>
              <a href="tel:+917836008277" className="w-full flex items-center justify-center gap-1.5 border border-brand text-brand text-sm font-semibold py-2 rounded-lg hover:bg-brand/10 transition"><PhoneCall size={14} />Call for purchase help</a>
            </div>
          </div>
          </div>
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
      <div id="overview" className="grid grid-cols-1 md:grid-cols-3 gap-6 scroll-mt-24">
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

          <div className="mt-5 pt-4 border-t border-gray-100">
            <h3 className="text-xs font-bold text-red-600 mb-3">LATEST UPDATES</h3>
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

          {totalFeatureCount > 0 && (
            <button onClick={() => scrollTo("Features")} className="mt-4 w-full text-xs font-semibold text-brand hover:text-brand-600 flex items-center justify-center gap-1">
              View all {totalFeatureCount} features <ChevronRight size={12} />
            </button>
          )}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10">
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
            <Link to="/buy-car" className="text-xs font-semibold text-brand hover:text-brand-600">View All</Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {similarCars.map((c) => <CarCard key={c.id} car={c} />)}
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
