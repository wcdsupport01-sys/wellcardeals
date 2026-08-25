import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { fetchAuctionCars } from "../api/carsApi";
import CarCard from "./CarCard";

/**
 * FeaturedCarsCarousel
 * Same horizontal snap-scroll + arrow-nav UI that "Popular Cars By Budget"
 * used, but wired to real Supabase inventory (via fetchAuctionCars) instead
 * of hardcoded/dummy cars. No budget tabs, no fake data — only live cars.
 */
const FeaturedCarsCarousel = ({ limit = 8, viewMoreLink = "/buy-car" }) => {
  const { role, dealerStatus, loading: authLoading } = useAuth();
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const scrollerRef = useRef(null);

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

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

  const isApprovedDealer = role === "dealer" && dealerStatus === "approved";
  const displayCars = limit ? cars.slice(0, limit) : cars;

  const scrollByAmount = (dir) => {
    const el = scrollerRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.8 * (dir === "right" ? 1 : -1);
    el.scrollBy({ left: amount, behavior: "smooth" });
  };

  return (
    <section id="live-listings" className="py-16 md:py-20 bg-white scroll-mt-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Heading */}
        <div className="text-center mb-8">
          <span className="text-xs font-semibold tracking-widest text-accent-600 uppercase">
            Live Inventory
          </span>
          <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold text-navy-900 tracking-tight mt-2">
            Featured Cars
          </h2>
          <p className="mt-3 text-navy-700/70 max-w-xl mx-auto">
            Real inventory, updated live as dealers and our team add new cars.
          </p>
        </div>

        {/* Loading skeleton */}
        {(authLoading || loading) && (
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="w-[78%] sm:w-[45%] md:w-[31%] lg:w-[23%] shrink-0 rounded-2xl border border-navy-900/8 h-80 bg-navy-900/5 animate-pulse"
              />
            ))}
          </div>
        )}

        {/* Error */}
        {!loading && !authLoading && error && (
          <p className="text-sm text-red-600 text-center py-8">Couldn't load cars: {error}</p>
        )}

        {/* Empty */}
        {!loading && !authLoading && !error && displayCars.length === 0 && (
          <p className="text-sm text-navy-700/60 text-center py-8">
            No live listings right now — check back soon.
          </p>
        )}

        {/* Real cars, horizontal scroller */}
        {!loading && !authLoading && !error && displayCars.length > 0 && (
          <div className="relative">
            <button
              type="button"
              onClick={() => scrollByAmount("left")}
              className="hidden md:flex absolute -left-4 top-1/2 -translate-y-1/2 z-10 h-9 w-9 rounded-full bg-white border border-slate-200 shadow-md items-center justify-center text-navy-900 hover:bg-slate-50 transition"
              aria-label="Scroll left"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              onClick={() => scrollByAmount("right")}
              className="hidden md:flex absolute -right-4 top-1/2 -translate-y-1/2 z-10 h-9 w-9 rounded-full bg-white border border-slate-200 shadow-md items-center justify-center text-navy-900 hover:bg-slate-50 transition"
              aria-label="Scroll right"
            >
              <ChevronRight size={18} />
            </button>

            <div
              ref={scrollerRef}
              className="flex gap-4 overflow-x-auto no-scrollbar snap-x snap-mandatory scroll-smooth pb-2"
            >
              {displayCars.map((car) => (
                <div
                  key={car.id}
                  className="w-[78%] sm:w-[45%] md:w-[31%] lg:w-[23%] shrink-0 snap-start"
                >
                  <CarCard car={car} isApprovedDealer={isApprovedDealer} />
                </div>
              ))}

              {cars.length > limit && viewMoreLink && (
                <Link
                  to={viewMoreLink}
                  className="w-[45%] sm:w-[31%] md:w-[23%] lg:w-[18%] shrink-0 snap-start flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-navy-900/20 bg-navy-900/[0.02] hover:bg-navy-900/5 transition text-navy-900 font-semibold text-sm min-h-[200px]"
                >
                  <span className="h-10 w-10 rounded-full bg-navy-900 text-white flex items-center justify-center">
                    <ChevronRight size={18} />
                  </span>
                  View More
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default FeaturedCarsCarousel;
