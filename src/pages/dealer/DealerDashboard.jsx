
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Car, Gauge, Trophy, ImageOff,
  ArrowRight, RefreshCw, Search
} from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { fetchAuctionCars } from "../../api/carsApi";
import { supabase } from "../../lib/supabaseClient";
import useCountdown from "../../hooks/useCountdown";

// Dashboard data comes from Supabase.

function LiveAuctionCard({ car }) {
  const countdown = useCountdown(
    new Date(car.auction_end).getTime()
  );

  const cover =
    car.thumbnail_url ||
    (Array.isArray(car.images) && car.images[0]);

  return (
    <div className="rounded-2xl border border-[#EAEEF7] p-4">
      <div className="flex items-start gap-3">
        <div className="h-16 w-16 rounded-xl bg-[#F1F4FB] overflow-hidden shrink-0 flex items-center justify-center">
          {cover ? (
            <img
              src={cover}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <ImageOff
              size={18}
              className="text-[#B7C0D8]"
            />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-sm truncate">
              {car.vehicle_title}
            </p>
            <span className="shrink-0 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
              ● Live
            </span>
          </div>

          <p className="text-xs text-[#93A0BD] mt-1">
            Auction Ends In
          </p>
          <p className="text-sm font-bold text-[#1E4FD9]">
            {String(countdown.hours).padStart(2, "0")}:
            {String(countdown.minutes).padStart(2, "0")}:
            {String(countdown.seconds).padStart(2, "0")}
          </p>
        </div>

        <div className="text-right shrink-0">
          <p className="text-xs text-[#93A0BD]">
            Current Bid
          </p>
          <p className="font-bold text-sm">
            ₹{Number(
              car.current_bid_dealer ||
              car.current_bid_buyer ||
              0
            ).toLocaleString("en-IN")}
          </p>
        </div>
      </div>

      <div className="flex gap-2 mt-3">
        <Link
          to={`/cars/${car.id}`}
          className="flex-1 text-center bg-[#1E4FD9] text-white text-sm font-semibold rounded-xl py-2"
        >
          Raise Bid
        </Link>

        <Link
          to={`/cars/${car.id}`}
          className="flex-1 text-center border border-[#DCE3F5] text-sm font-semibold rounded-xl py-2"
        >
          View Details
        </Link>
      </div>
    </div>
  );
}

export default function DealerDashboard() {
  const { user, profile, role, dealerStatus } = useAuth();

  const [liveCars, setLiveCars] = useState([]);
  const [loadingCars, setLoadingCars] = useState(true);
  const [myBids, setMyBids] = useState([]);
  const [wonCars, setWonCars] = useState([]);
  const [loadingBids, setLoadingBids] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    const timer = window.setInterval(
      () => setRefreshKey((n) => n + 1),
      30000
    );
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let mounted = true;

    fetchAuctionCars(role, {
      dealerStatus,
      status: "live"
    })
      .then((data) => {
        if (mounted) {
          setLiveCars(
            (data || []).filter(
              (c) => c.listing_type !== "buy_now_only"
            )
          );
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(
            err.message || "Unable to load auctions"
          );
        }
      })
      .finally(() => {
        if (mounted) setLoadingCars(false);
      });

    return () => {
      mounted = false;
    };
  }, [role, dealerStatus, refreshKey]);

  useEffect(() => {
    if (!user) return;
    let mounted = true;

    (async () => {
      setLoadingBids(true);

      try {
        const { data: bidRows, error: bidErr } =
          await supabase
            .from("car_bids")
            .select(
              "id, car_id, amount, created_at, cars(vehicle_title, status, auction_end)"
            )
            .eq("bidder_id", user.id)
            .order("created_at", {
              ascending: false
            })
            .limit(8);

        if (bidErr) throw bidErr;

        if (mounted) {
          setMyBids(bidRows || []);
          setError("");
          setLastUpdated(new Date());
        }

        const { data: wonRows, error: wonErr } =
          await supabase
            .from("cars")
            .select(
              "id, vehicle_title, current_bid_dealer, updated_at"
            )
            .eq(
              "highest_bidder_id_dealer",
              user.id
            )
            .eq("status", "sold");

        if (wonErr) throw wonErr;

        if (mounted) {
          setWonCars(wonRows || []);
        }
      } catch (err) {
        if (mounted) {
          setError(
            err.message ||
            "Unable to refresh your bids"
          );
        }
      } finally {
        if (mounted) setLoadingBids(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [user, refreshKey]);

  const activeBidCarIds = new Set(
    myBids
      .filter((b) => b.cars?.status === "live")
      .map((b) => b.car_id)
  );

  const visibleCars = liveCars.filter((car) =>
    (car.vehicle_title || "")
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">
          Welcome back,{" "}
          {profile?.dealer_name || "Dealer"} 👋
        </h1>

        <p className="text-sm text-[#93A0BD]">
          {profile?.business_name ||
            "Your dealership"}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-[#6B7A9A]">
          Auto-refresh every 30 seconds
          {lastUpdated
            ? ` · Updated ${lastUpdated.toLocaleTimeString("en-IN")}`
            : ""}
        </div>

        <button
          type="button"
          onClick={() =>
            setRefreshKey((n) => n + 1)
          }
          className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold text-[#1E4FD9]"
        >
          <RefreshCw size={15} />
          Refresh now
        </button>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-[#EAEEF7] p-5">
          <div className="flex items-center gap-3">
            <span className="h-11 w-11 rounded-xl bg-[#1E4FD9] text-white flex items-center justify-center">
              <Car size={19} />
            </span>
            <p className="text-sm text-[#6B7A9A]">
              Live Auctions
            </p>
          </div>

          <p className="text-2xl font-bold mt-3">
            {loadingCars ? "—" : liveCars.length}
          </p>

          <p className="text-xs text-[#93A0BD] mt-1">
            Open for bidding right now
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-[#EAEEF7] p-5">
          <div className="flex items-center gap-3">
            <span className="h-11 w-11 rounded-xl bg-[#1E4FD9] text-white flex items-center justify-center">
              <Gauge size={19} />
            </span>

            <p className="text-sm text-[#6B7A9A]">
              My Active Bids
            </p>
          </div>

          <p className="text-2xl font-bold mt-3">
            {loadingBids
              ? "—"
              : activeBidCarIds.size}
          </p>

          <p className="text-xs text-[#93A0BD] mt-1">
            Cars you've bid on that are still live
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-[#EAEEF7] p-5">
          <div className="flex items-center gap-3">
            <span className="h-11 w-11 rounded-xl bg-[#1E4FD9] text-white flex items-center justify-center">
              <Trophy size={19} />
            </span>

            <p className="text-sm text-[#6B7A9A]">
              Auctions Won
            </p>
          </div>

          <p className="text-2xl font-bold mt-3">
            {loadingBids ? "—" : wonCars.length}
          </p>

          <p className="text-xs text-[#93A0BD] mt-1">
            Cars you were the winning bidder on
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-[#EAEEF7] p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-sm">
              Live Auctions
            </h2>

            <Link
              to="/live-auctions"
              className="text-xs font-semibold text-[#1E4FD9] flex items-center gap-1"
            >
              View All
              <ArrowRight size={12} />
            </Link>
          </div>

          <label className="mb-3 flex items-center gap-2 rounded-xl border px-3 py-2">
            <Search
              size={16}
              className="text-gray-400"
            />

            <input
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
              placeholder="Search live cars"
              className="w-full bg-transparent text-sm outline-none"
            />
          </label>

          <div className="space-y-3">
            {loadingCars && (
              <p className="text-xs text-[#93A0BD]">
                Loading live auctions…
              </p>
            )}

            {!loadingCars &&
              visibleCars.length === 0 && (
                <p className="text-xs text-[#93A0BD]">
                  No matching live auctions right now.
                </p>
              )}

            {visibleCars.slice(0, 6).map((car) => (
              <LiveAuctionCard
                key={car.id}
                car={car}
              />
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#EAEEF7] p-5">
          <h2 className="font-semibold text-sm mb-4">
            My Recent Bids
          </h2>

          <div className="space-y-3">
            {loadingBids && (
              <p className="text-xs text-[#93A0BD]">
                Loading your bids…
              </p>
            )}

            {!loadingBids &&
              myBids.length === 0 && (
                <p className="text-xs text-[#93A0BD]">
                  You haven't placed any bids yet.
                </p>
              )}

            {myBids.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between border-b border-[#F1F4FB] last:border-0 pb-3 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {b.cars?.vehicle_title || "Car"}
                  </p>

                  <p className="text-[11px] text-[#93A0BD]">
                    {new Date(
                      b.created_at
                    ).toLocaleString("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "short"
                    })}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-[#1E4FD9]">
                    ₹{Number(
                      b.amount
                    ).toLocaleString("en-IN")}
                  </p>

                  <p className="text-[10px] text-[#93A0BD]">
                    {b.cars?.status === "live"
                      ? "Live"
                      : b.cars?.status || ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
