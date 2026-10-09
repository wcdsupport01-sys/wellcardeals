
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  ShoppingCart,
  Gavel,
  MapPin,
  Fuel,
  Settings2,
  Gauge,
  BadgeCheck,
  ShieldCheck,
  Heart,
  Clock,
  Eye,
} from "lucide-react";

const formatINR = (value) => {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return "—";
  }

  return "₹" + Math.round(amount).toLocaleString("en-IN");
};

const pad = (n) => String(n).padStart(2, "0");

function useCountdownTo(endTime) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!endTime) return;

    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, [endTime]);

  if (!endTime) {
    return {
      hours: 0,
      minutes: 0,
      seconds: 0,
      isEnded: false,
      noTimer: true,
    };
  }

  const end = new Date(endTime).getTime();

  if (!Number.isFinite(end)) {
    return {
      hours: 0,
      minutes: 0,
      seconds: 0,
      isEnded: false,
      noTimer: true,
    };
  }

  const diff = Math.max(0, end - now);

  return {
    hours: Math.floor(diff / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
    isEnded: diff <= 0,
    noTimer: false,
  };
}

function Spec({ icon: Icon, label }) {
  if (label === null || label === undefined || label === "") {
    return null;
  }

  return (
    <span className="flex items-center gap-1 text-[12px] text-[#5B6B8C]">
      <Icon size={13} className="text-[#8B98B8]" />
      {label}
    </span>
  );
}

export default function CarCard({
  car,
  isApprovedDealer = false,
  onToggleWishlist,
  wishlisted = false,
}) {
  const countdown = useCountdownTo(car.auction_end);

  const isBuyNow = car.listing_type === "buy_now_only";
  const isAuction = !isBuyNow;

  const basePrice = isApprovedDealer
    ? car.base_price_dealer
    : car.base_price_buyer;

  const currentBid = isApprovedDealer
    ? car.current_bid_dealer
    : car.current_bid_buyer;

  const hasCurrentBid =
    currentBid !== null &&
    currentBid !== undefined &&
    currentBid !== "" &&
    Number(currentBid) > 0;

  const buyNowPrice =
    car.buy_now_price ?? basePrice;

  const displayPrice = isBuyNow
    ? buyNowPrice
    : hasCurrentBid
    ? currentBid
    : basePrice;

  const priceLabel = isBuyNow
    ? "Best Price"
    : hasCurrentBid
    ? "Current Bid"
    : "Starting Bid";

  const canBid =
    isAuction &&
    isApprovedDealer &&
    !countdown.isEnded;

  const buttonText = isBuyNow
    ? "View Details"
    : canBid
    ? "View & Bid"
    : "View Auction";

  const ButtonIcon = isBuyNow
    ? ShoppingCart
    : canBid
    ? Gavel
    : Eye;

  const cover =
    car.thumbnail_url ||
    (Array.isArray(car.images) ? car.images[0] : null);

  return (
    <div className="group relative flex flex-col rounded-2xl border border-[#E3E8F5] bg-white overflow-hidden transition-shadow hover:shadow-[0_12px_32px_-12px_rgba(11,37,69,0.18)]">

      {/* Car image */}
      <Link
        to={`/cars/${car.id}`}
        className="relative block h-48 bg-[#F5F8FD] overflow-hidden"
      >
        {cover ? (
          <img
            src={cover}
            alt={car.vehicle_title || "Car"}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[#93A0BD] text-sm">
            No image
          </div>
        )}

        {/* Status badges */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5">
          {car.is_verified && (
            <span className="flex items-center gap-1 bg-white/95 backdrop-blur text-[#0B2545] text-[11px] font-semibold px-2.5 py-1 rounded-full shadow-sm">
              <BadgeCheck
                size={12}
                className="text-[#2563EB]"
              />
              Verified
            </span>
          )}

          {isBuyNow && (
            <span className="bg-emerald-600 text-white text-[11px] font-semibold px-2.5 py-1 rounded-full">
              Buy Now
            </span>
          )}

          {isAuction &&
            car.status === "live" &&
            !countdown.isEnded && (
              <span className="flex items-center gap-1 bg-red-600 text-white text-[11px] font-bold px-2.5 py-1 rounded-full">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
                </span>
                LIVE
              </span>
            )}
        </div>

        {/* Wishlist */}
        <button
          type="button"
          aria-label="Toggle wishlist"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleWishlist?.(car);
          }}
          className="absolute top-3 right-3 flex items-center justify-center w-8 h-8 rounded-full bg-white/95 backdrop-blur shadow-sm hover:scale-105 transition"
        >
          <Heart
            size={15}
            className={
              wishlisted
                ? "fill-red-500 text-red-500"
                : "text-[#5B6B8C]"
            }
          />
        </button>

        {/* Auction countdown */}
        {isAuction && !countdown.noTimer && (
          <div
            className={`absolute bottom-0 left-0 right-0 flex items-center justify-center gap-2 text-[11px] font-bold py-1.5 ${
              countdown.isEnded
                ? "bg-[#0B2545]/85 text-white"
                : countdown.hours === 0 &&
                  countdown.minutes < 10
                ? "bg-red-600/90 text-white"
                : "bg-[#0B2545]/80 text-white"
            }`}
          >
            <Clock size={12} />

            {countdown.isEnded
              ? "Auction Ended"
              : `${
                  countdown.hours > 0
                    ? `${pad(countdown.hours)}h `
                    : ""
                }${pad(countdown.minutes)}m ${pad(
                  countdown.seconds
                )}s left`}
          </div>
        )}
      </Link>

      {/* Car details */}
      <div className="flex flex-col flex-1 p-4">
        <Link to={`/cars/${car.id}`}>
          <h3 className="text-[15px] font-bold text-[#0B2545] leading-snug truncate group-hover:text-[#2563EB] transition">
            {car.vehicle_title || "Vehicle Details"}
          </h3>
        </Link>

        {/* Specifications */}
        <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-1.5">
          <Spec icon={Gauge} label={car.year} />

          <Spec
            icon={Fuel}
            label={car.fuel_types?.name}
          />

          <Spec
            icon={Settings2}
            label={car.transmissions?.name}
          />

          <Spec
            icon={Gauge}
            label={
              car.mileage_km != null
                ? `${Number(
                    car.mileage_km
                  ).toLocaleString("en-IN")} km`
                : null
            }
          />
        </div>

        {/* Location */}
        <div className="flex items-center gap-1 text-[12px] text-[#8B98B8] mt-1.5">
          <MapPin size={12} />
          {car.location || "Location TBD"}
        </div>

        {/* Price */}
        <div className="mt-3 pt-3 border-t border-[#EEF1F8] flex items-end justify-between">
          <div>
            <p className="text-[11px] text-[#8B98B8] uppercase tracking-wide">
              {priceLabel}
            </p>

            <p className="text-lg font-extrabold text-[#0B2545] leading-tight">
              {formatINR(displayPrice)}
            </p>
          </div>

          {car.is_verified && (
            <span className="flex items-center gap-1 text-[11px] text-emerald-700">
              <ShieldCheck size={13} />
              150+ checks
            </span>
          )}
        </div>

        {/* Action */}
        <Link
          to={`/cars/${car.id}`}
          className="mt-3 flex items-center justify-center gap-2 w-full rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold py-2.5 transition"
        >
          <ButtonIcon size={15} />
          {buttonText}
        </Link>
      </div>
    </div>
  );
}
