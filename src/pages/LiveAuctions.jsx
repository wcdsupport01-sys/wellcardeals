import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, SlidersHorizontal, Gavel, ShieldCheck, Clock, MapPin, Lock, Tag } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { fetchAuctionCars } from "../api/carsApi";

const formatINR = (value) =>
  value == null ? "—" : "₹" + Math.round(Number(value)).toLocaleString("en-IN");

const pad = (n) => n.toString().padStart(2, "0");

const sortOptions = [
  { label: "Ending Soon", value: "ending" },
  { label: "Highest Bid", value: "highest" },
];

function useCountdownTo(endTime) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!endTime) return { hours: 0, minutes: 0, seconds: 0, isEnded: false, noTimer: true };
  const diff = Math.max(0, new Date(endTime).getTime() - now);
  const isEnded = diff <= 0;
  return {
    hours: Math.floor(diff / 3_600_000),
    minutes: Math.floor((diff % 3_600_000) / 60_000),
    seconds: Math.floor((diff % 60_000) / 1000),
    isEnded,
    noTimer: false,
  };
}

const Card = ({ car, isApprovedDealer }) => {
  const countdown = useCountdownTo(car.auction_end);
  const isDealerOnly = car.access_type === "dealer_only";
  const basePrice = isApprovedDealer ? car.base_price_dealer : car.base_price_buyer;
  const currentBid = isApprovedDealer ? car.current_bid_dealer : car.current_bid_buyer;
  const cover = car.thumbnail_url || (Array.isArray(car.images) && car.images[0]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.35 }}
      className="group relative bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-2xl hover:-translate-y-1 transition-all duration-300"
    >
      <Link to={`/cars/${car.id}`} className="relative h-52 overflow-hidden block bg-gray-100">
        {cover ? (
          <img
            src={cover}
            alt={car.vehicle_title}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">No image</div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0" />

        {!countdown.isEnded && car.status === "live" && (
          <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-[#0B2545]/85 backdrop-blur-sm text-white text-xs font-semibold px-3 py-1.5 rounded-full">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
            LIVE
          </div>
        )}
        {isDealerOnly && (
          <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-[#1E6FD9]/95 backdrop-blur-sm text-white text-xs font-semibold px-3 py-1.5 rounded-full">
            <Lock size={12} /> DEALERS ONLY
          </div>
        )}
        {!isDealerOnly && isApprovedDealer && (
          <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-white/90 backdrop-blur-sm text-gray-900 text-xs font-medium px-3 py-1.5 rounded-full">
            <Tag size={12} /> Dealer Price
          </div>
        )}
        {!countdown.noTimer && (
          <div
            className={`absolute bottom-3 left-3 flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full backdrop-blur-sm ${
              countdown.isEnded
                ? "bg-gray-800/80 text-gray-300"
                : countdown.hours === 0 && countdown.minutes < 10
                ? "bg-red-600/90 text-white"
                : "bg-white/90 text-gray-900"
            }`}
          >
            <Clock size={13} />
            {countdown.isEnded
              ? "Auction Ended"
              : `${countdown.hours > 0 ? pad(countdown.hours) + ":" : ""}${pad(countdown.minutes)}:${pad(
                  countdown.seconds
                )}`}
          </div>
        )}
      </Link>

      <div className="p-5">
        <Link to={`/cars/${car.id}`}>
          <h3 className="text-lg font-semibold text-gray-900 leading-tight hover:underline underline-offset-2 truncate">
            {car.vehicle_title}
          </h3>
        </Link>
        <p className="text-sm text-gray-500 mt-0.5">{car.year || ""}</p>
        <div className="flex items-center gap-1 text-gray-400 text-xs mt-2">
          <MapPin size={13} />
          {car.location || "Location TBD"}
        </div>
        <div className="mt-4 flex items-end justify-between">
          <div>
            <p className="text-xs text-gray-400">{currentBid ? "Current Bid" : "Starting Price"}</p>
            <p className="text-xl font-bold text-gray-900">{formatINR(currentBid || basePrice)}</p>
          </div>
        </div>
        <Link
          to={`/cars/${car.id}`}
          className="mt-5 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-[#1E6FD9] text-white hover:bg-[#155ab3] transition"
        >
          <Gavel size={16} />
          View & Bid
        </Link>
      </div>
    </motion.div>
  );
};

const LiveAuctions = () => {
  const { role, dealerStatus, loading: authLoading } = useAuth();
  const isApprovedDealer = role === "dealer" && dealerStatus === "approved";

  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("ending");

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    setLoading(true);
    fetchAuctionCars(role, { dealerStatus })
      .then((data) => {
        if (!cancelled) setCars(data || []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [role, dealerStatus, authLoading]);

  const filtered = useMemo(() => {
    let result = cars
      .filter((c) => c.listing_type !== "buy_now_only")
      .filter((c) => (c.vehicle_title || "").toLowerCase().includes(query.trim().toLowerCase()));
    if (sort === "ending") {
      result = [...result].sort((a, b) => new Date(a.auction_end || 0) - new Date(b.auction_end || 0));
    } else if (sort === "highest") {
      const bidOf = (c) => (isApprovedDealer ? c.current_bid_dealer : c.current_bid_buyer) || 0;
      result = [...result].sort((a, b) => bidOf(b) - bidOf(a));
    }
    return result;
  }, [cars, query, sort, isApprovedDealer]);

  return (
    <div className="bg-white text-gray-900 min-h-screen">
      {/* HERO */}
      <section className="relative bg-white pt-28 pb-10 overflow-hidden">
        <div className="relative z-10 max-w-7xl mx-auto px-6">
          <div className="flex items-center gap-2 mb-3 text-[#1E6FD9]">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
            </span>
            <p className="text-xs uppercase tracking-widest font-semibold">Live Right Now</p>
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-[#0B2545] tracking-tight">
            Live Auctions
          </h1>
          <p className="mt-4 text-gray-500 max-w-2xl">
            Participate in live auctions and win exciting deals. Real, verified listings — search by name and place your bid before the timer runs out.
          </p>
          <div className="mt-6">
            <span className="inline-flex items-center gap-2 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-full">
              <ShieldCheck size={14} />
              {cars.length} live listing{cars.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      </section>

      {/* SEARCH + SORT */}
      <section className="sticky top-[72px] md:top-[88px] z-30 bg-white/95 backdrop-blur-md border-b border-gray-200 py-5">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
          <div className="relative w-full md:max-w-sm">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by car name..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E6FD9]/50 focus:bg-white transition"
            />
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <SlidersHorizontal size={16} className="text-gray-400" />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E6FD9]/50"
            >
              {sortOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* GRID */}
      <section className="max-w-7xl mx-auto px-6 py-14">
        <p className="text-sm text-gray-500 mb-6">
          Showing <span className="font-semibold text-gray-900">{filtered.length}</span>{" "}
          {filtered.length === 1 ? "result" : "results"}
          {query && (
            <>
              {" "}
              for "<span className="font-medium">{query}</span>"
            </>
          )}
        </p>

        {authLoading || loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-gray-200 h-80 bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <p className="text-sm text-red-600">Couldn't load auctions: {error}</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-gray-400 text-lg">
              {cars.length === 0 ? "No live listings right now — check back soon." : "No cars match your search."}
            </p>
            {query && (
              <button
                onClick={() => setQuery("")}
                className="mt-4 text-sm font-medium text-[#1E6FD9] underline underline-offset-4"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <motion.div layout className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <AnimatePresence>
              {filtered.map((car) => (
                <Card key={car.id} car={car} isApprovedDealer={isApprovedDealer} />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </section>
    </div>
  );
};

export default LiveAuctions;
