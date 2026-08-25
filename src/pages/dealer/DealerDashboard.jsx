import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Car, Gauge, Trophy, ImageOff, ArrowRight } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { fetchAuctionCars } from "../../api/carsApi";
import { supabase } from "../../lib/supabaseClient";
import useCountdown from "../../hooks/useCountdown";

// ---------------------------------------------------------------------------
// Every number and list on this page comes straight from Supabase (cars +
// car_bids, scoped to the signed-in dealer via RLS). Nothing here is
// placeholder/sample data — sections stay empty rather than showing fake
// numbers if there's nothing to report yet.
// ---------------------------------------------------------------------------

function LiveAuctionCard({ car }) {
  const countdown = useCountdown(new Date(car.auction_end).getTime());
  const cover = car.thumbnail_url || (Array.isArray(car.images) && car.images[0]);

  return (
    <div className="rounded-2xl border border-[#EAEEF7] p-4">
      <div className="flex items-start gap-3">
        <div className="h-16 w-16 rounded-xl bg-[#F1F4FB] overflow-hidden shrink-0 flex items-center justify-center">
          {cover ? (
            <img src={cover} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImageOff size={18} className="text-[#B7C0D8]" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-sm truncate">{car.vehicle_title}</p>
            <span className="shrink-0 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
              ● Live
            </span>
          </div>
          <p className="text-xs text-[#93A0BD] mt-1">Auction Ends In</p>
          <p className="text-sm font-bold text-[#1E4FD9]">
            {String(countdown.hours).padStart(2, "0")}:{String(countdown.minutes).padStart(2, "0")}:
            {String(countdown.seconds).padStart(2, "0")}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-[#93A0BD]">Current Bid</p>
          <p className="font-bold text-sm">₹{Number(car.current_bid_dealer || car.current_bid_buyer || 0).toLocaleString("en-IN")}</p>
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <Link to={`/cars/${car.id}`} className="flex-1 text-center bg-[#1E4FD9] text-white text-sm font-semibold rounded-xl py-2">
          Raise Bid
        </Link>
        <Link to={`/cars/${car.id}`} className="flex-1 text-center border border-[#DCE3F5] text-sm font-semibold rounded-xl py-2">
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

  const [myBids, setMyBids] = useState([]); // raw car_bids rows placed by this dealer
  const [wonCars, setWonCars] = useState([]); // cars this dealer is the ending highest bidder on
  const [loadingBids, setLoadingBids] = useState(true);

  useEffect(() => {
    let mounted = true;
    fetchAuctionCars(role, { dealerStatus, status: "live" })
      .then((data) => {
        if (mounted) setLiveCars((data || []).filter((c) => c.listing_type !== "buy_now_only").slice(0, 3));
      })
      .catch(() => mounted && setLiveCars([]))
      .finally(() => mounted && setLoadingCars(false));
    return () => {
      mounted = false;
    };
  }, [role, dealerStatus]);

  useEffect(() => {
    if (!user) return;
    let mounted = true;

    (async () => {
      setLoadingBids(true);
      try {
        // Every bid this dealer has placed, most recent first.
        const { data: bidRows, error: bidErr } = await supabase
          .from("car_bids")
          .select("id, car_id, amount, created_at, cars(vehicle_title, status, auction_end)")
          .eq("bidder_id", user.id)
          .order("created_at", { ascending: false })
          .limit(8);
        if (bidErr) throw bidErr;
        if (mounted) setMyBids(bidRows || []);

        // Auctions this dealer ended up winning (car marked sold with them as
        // the winning dealer bidder).
        const { data: wonRows, error: wonErr } = await supabase
          .from("cars")
          .select("id, vehicle_title, current_bid_dealer, updated_at")
          .eq("highest_bidder_id_dealer", user.id)
          .eq("status", "sold");
        if (wonErr) throw wonErr;
        if (mounted) setWonCars(wonRows || []);
      } catch {
        if (mounted) {
          setMyBids([]);
          setWonCars([]);
        }
      } finally {
        if (mounted) setLoadingBids(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [user]);

  const activeBidCarIds = new Set(
    myBids.filter((b) => b.cars?.status === "live").map((b) => b.car_id)
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Welcome back, {profile?.dealer_name || "Dealer"} 👋</h1>
        <p className="text-sm text-[#93A0BD]">{profile?.business_name || "Your dealership"}</p>
      </div>

      {/* ---------- Real stat cards ---------- */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-[#EAEEF7] p-5">
          <div className="flex items-center gap-3">
            <span className="h-11 w-11 rounded-xl bg-[#1E4FD9] text-white flex items-center justify-center">
              <Car size={19} />
            </span>
            <p className="text-sm text-[#6B7A9A]">Live Auctions</p>
          </div>
          <p className="text-2xl font-bold mt-3">{loadingCars ? "—" : liveCars.length}</p>
          <p className="text-xs text-[#93A0BD] mt-1">Open for bidding right now</p>
        </div>

        <div className="bg-white rounded-2xl border border-[#EAEEF7] p-5">
          <div className="flex items-center gap-3">
            <span className="h-11 w-11 rounded-xl bg-[#1E4FD9] text-white flex items-center justify-center">
              <Gauge size={19} />
            </span>
            <p className="text-sm text-[#6B7A9A]">My Active Bids</p>
          </div>
          <p className="text-2xl font-bold mt-3">{loadingBids ? "—" : activeBidCarIds.size}</p>
          <p className="text-xs text-[#93A0BD] mt-1">Cars you've bid on that are still live</p>
        </div>

        <div className="bg-white rounded-2xl border border-[#EAEEF7] p-5">
          <div className="flex items-center gap-3">
            <span className="h-11 w-11 rounded-xl bg-[#1E4FD9] text-white flex items-center justify-center">
              <Trophy size={19} />
            </span>
            <p className="text-sm text-[#6B7A9A]">Auctions Won</p>
          </div>
          <p className="text-2xl font-bold mt-3">{loadingBids ? "—" : wonCars.length}</p>
          <p className="text-xs text-[#93A0BD] mt-1">Cars you were the winning bidder on</p>
        </div>
      </div>

      {/* ---------- Live Auctions + My Recent Bids ---------- */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-[#EAEEF7] p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-sm">Live Auctions</h2>
            <Link to="/live-auctions" className="text-xs font-semibold text-[#1E4FD9] flex items-center gap-1">
              View All <ArrowRight size={12} />
            </Link>
          </div>
          <div className="space-y-3">
            {loadingCars && <p className="text-xs text-[#93A0BD]">Loading live auctions…</p>}
            {!loadingCars && liveCars.length === 0 && (
              <p className="text-xs text-[#93A0BD]">No live auctions right now.</p>
            )}
            {liveCars.map((car) => (
              <LiveAuctionCard key={car.id} car={car} />
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#EAEEF7] p-5">
          <h2 className="font-semibold text-sm mb-4">My Recent Bids</h2>
          <div className="space-y-3">
            {loadingBids && <p className="text-xs text-[#93A0BD]">Loading your bids…</p>}
            {!loadingBids && myBids.length === 0 && (
              <p className="text-xs text-[#93A0BD]">You haven't placed any bids yet.</p>
            )}
            {myBids.map((b) => (
              <div key={b.id} className="flex items-center justify-between border-b border-[#F1F4FB] last:border-0 pb-3 last:pb-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{b.cars?.vehicle_title || "Car"}</p>
                  <p className="text-[11px] text-[#93A0BD]">
                    {new Date(b.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-[#1E4FD9]">₹{Number(b.amount).toLocaleString("en-IN")}</p>
                  <p className="text-[10px] text-[#93A0BD]">{b.cars?.status === "live" ? "Live" : b.cars?.status || ""}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
