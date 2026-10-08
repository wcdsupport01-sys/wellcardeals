
import React, { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { fetchAuctionCars } from "../api/carsApi";
import CarCard from "./CarCard";

const AuctionGrid = ({
  filters,
  limit,
  viewMoreLink,
  onResultsCount,
  mode = "all",
}) => {
  const { role, dealerStatus, loading: authLoading } = useAuth();

  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (authLoading) return;

    let cancelled = false;

    setLoading(true);
    setError(null);

    fetchAuctionCars(role, { dealerStatus })
      .then((data) => {
        if (!cancelled) {
          setCars(data || []);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setCars([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [role, dealerStatus, authLoading]);

  const isApprovedDealer =
    role === "dealer" && dealerStatus === "approved";

  const modeCars = cars.filter((car) => {
    if (mode === "buy_now") {
      return (
        car.listing_type === "buy_now_only" &&
        car.access_type === "all"
      );
    }

    if (mode === "auction") {
      return car.listing_type !== "buy_now_only";
    }

    return true;
  });

  const visibleCars = modeCars.filter((car) => {
    if (!filters) return true;

    const price = isApprovedDealer
      ? car.base_price_dealer
      : car.base_price_buyer;

    if (filters.search) {
      const q = filters.search.trim().toLowerCase();

      const haystack = `
        ${car.vehicle_title || ""}
        ${car.brand || ""}
        ${car.model || ""}
        ${car.location || ""}
      `.toLowerCase();

      if (!haystack.includes(q)) return false;
    }

    if (filters.city) {
      const loc = (car.location || "").toLowerCase();

      if (!loc.includes(filters.city.toLowerCase())) {
        return false;
      }
    }

    if (filters.maxPrice) {
      if (
        price == null ||
        Number(price) > Number(filters.maxPrice)
      ) {
        return false;
      }
    }

    if (filters.brands && filters.brands.length > 0) {
      const brand = (
        car.brand ||
        car.vehicle_title ||
        ""
      ).toLowerCase();

      const matchesAny = filters.brands.some((b) =>
        brand.includes(b.toLowerCase())
      );

      if (!matchesAny) return false;
    }

    if (
      filters.priceMin != null &&
      price != null &&
      Number(price) < Number(filters.priceMin)
    ) {
      return false;
    }

    if (
      filters.priceMax != null &&
      price != null &&
      Number(price) > Number(filters.priceMax)
    ) {
      return false;
    }

    if (
      filters.yearMin != null &&
      car.year != null &&
      Number(car.year) < Number(filters.yearMin)
    ) {
      return false;
    }

    if (
      filters.yearMax != null &&
      car.year != null &&
      Number(car.year) > Number(filters.yearMax)
    ) {
      return false;
    }

    return true;
  });

  useEffect(() => {
    if (!authLoading && !loading && !error) {
      onResultsCount?.(visibleCars.length);
    }
  }, [
    visibleCars.length,
    authLoading,
    loading,
    error,
    onResultsCount,
  ]);

  if (authLoading || loading) {
    const skeletonCount = limit || 6;

    if (limit) {
      return (
        <div className="-mx-6 px-6 sm:mx-0 sm:px-0">
          <div className="flex sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 overflow-x-auto sm:overflow-visible no-scrollbar">
            {Array.from({ length: skeletonCount }).map(
              (_, i) => (
                <div
                  key={i}
                  className="w-[78%] sm:w-auto shrink-0 rounded-2xl border border-gray-200 h-80 bg-gray-100 animate-pulse"
                />
              )
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: skeletonCount }).map(
          (_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-gray-200 h-80 bg-gray-100 animate-pulse"
            />
          )
        )}
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-red-600">
        Couldn't load cars: {error}
      </p>
    );
  }

  if (visibleCars.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        No cars match right now — try widening your filters.
      </p>
    );
  }

  const displayCars = limit
    ? visibleCars.slice(0, limit)
    : visibleCars;

  if (limit) {
    return (
      <div className="-mx-6 px-6 sm:mx-0 sm:px-0">
        <div className="flex sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 overflow-x-auto sm:overflow-visible no-scrollbar snap-x snap-mandatory pb-2">
          <AnimatePresence>
            {displayCars.map((car) => (
              <div
                key={car.id}
                className="w-[78%] sm:w-auto shrink-0 snap-start"
              >
                <CarCard
                  car={car}
                  isApprovedDealer={isApprovedDealer}
                />
              </div>
            ))}
          </AnimatePresence>

          {visibleCars.length > limit && viewMoreLink && (
            <Link
              to={viewMoreLink}
              className="w-[45%] sm:w-auto shrink-0 snap-start flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-200 bg-gray-50 hover:bg-gray-100 transition text-[#0B2545] font-semibold text-sm min-h-[200px] sm:min-h-full"
            >
              <span className="h-10 w-10 rounded-full bg-[#0B2545] text-white flex items-center justify-center">
                <ArrowRight size={18} />
              </span>
              View More
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      <AnimatePresence>
        {displayCars.map((car) => (
          <CarCard
            key={car.id}
            car={car}
            isApprovedDealer={isApprovedDealer}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};

export default AuctionGrid;
