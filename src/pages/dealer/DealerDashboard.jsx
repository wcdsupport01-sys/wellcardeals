import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Gavel, Heart, RefreshCw, Search, ArrowUpRight } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { supabase } from "../../lib/supabaseClient";
import {
  bidErrorMessage,
  minimumBid,
  money,
  timeLeft,
} from "../../dealer/auction";
import useAuctionClock from "../../dealer/useAuctionClock";
import { BidStatus } from "../../dealer/DealerBidPanel";

const TABS = [
  ["live", "Live auctions"],
  ["bids", "My bids"],
  ["watchlist", "Watchlist"],
  ["results", "Results"],
];
const PAGE_SIZE = 24;

export default function DealerDashboard() {
  const { user, profile } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some(([key]) => key === params.get("tab"))
    ? params.get("tab")
    : "live";
  const query = params.get("q") || "";
  const setQuery = (value) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value) next.set("q", value);
        else next.delete("q");
        return next;
      },
      { replace: true },
    );
  const [search, setSearch] = useState(params.get("q") || "");
  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [watchBusy, setWatchBusy] = useState(null);
  const [watchError, setWatchError] = useState("");
  const [online, setOnline] = useState(navigator.onLine);
  const [refresh, setRefresh] = useState(0);
  const instant = useAuctionClock();
  const [lastSync, setLastSync] = useState(0);
  const [clock, setClock] = useState(null);

  useEffect(() => {
    const id = setTimeout(() => {
      setSearch(query);
      setPage(0);
    }, 300);
    return () => clearTimeout(id);
  }, [query]);

  useEffect(() => {
    let active = true;
    const abort = new AbortController();
    async function load() {
      setLoading(true);
      try {
        const { data: response, error: failure } = await supabase
          .rpc("get_dealer_auction_dashboard", {
            p_tab: tab,
            p_search: search.trim(),
            p_offset: page * PAGE_SIZE,
            p_limit: PAGE_SIZE,
          })
          .abortSignal(
            AbortSignal.any([abort.signal, AbortSignal.timeout(12000)]),
          );
        if (failure) throw failure;
        if (
          !response?.summary ||
          !Array.isArray(response.items) ||
          !Number.isFinite(Date.parse(response.server_time))
        )
          throw new Error("Unable to verify auction data.");
        if (active) {
          setClock({
            server: Date.parse(response.server_time),
            at: performance.now(),
          });
          setData({ ...response, view: `${tab}/${search}/${page}` });
          setError("");
          setLastSync(performance.now());
        }
      } catch (failure) {
        if (active) setError(bidErrorMessage(failure));
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
      abort.abort();
    };
  }, [tab, search, page, refresh]);

  useEffect(() => {
    const timer = setInterval(() => setRefresh((value) => value + 1), 15000);
    const changed = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) setRefresh((value) => value + 1);
    };
    window.addEventListener("online", changed);
    window.addEventListener("offline", changed);
    let queued = null;
    const requestRefresh = () => {
      if (queued !== null) return;
      queued = setTimeout(() => {
        queued = null;
        setRefresh((value) => value + 1);
      }, 500);
    };
    const channel = supabase
      .channel(`dealer-dashboard-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "cars" },
        requestRefresh,
      )
      .subscribe();
    return () => {
      clearTimeout(queued);
      clearInterval(timer);
      window.removeEventListener("online", changed);
      window.removeEventListener("offline", changed);
      supabase.removeChannel(channel);
    };
  }, [user.id]);

  async function toggleWatch(car) {
    if (watchBusy) return;
    setWatchBusy(car.id);
    setWatchError("");
    try {
      const query = car.watchlisted
        ? supabase
            .from("wishlist")
            .delete()
            .eq("buyer_id", user.id)
            .eq("car_id", car.id)
        : supabase
            .from("wishlist")
            .upsert(
              { buyer_id: user.id, car_id: car.id },
              { onConflict: "buyer_id,car_id", ignoreDuplicates: true },
            );
      const { error: failure } = await query;
      if (failure) throw failure;
      setRefresh((value) => value + 1);
    } catch {
      setWatchError("Could not update your watchlist. Please try again.");
    } finally {
      setWatchBusy(null);
    }
  }

  const switchTab = useCallback(
    (next) => {
      setParams((current) => {
        const result = new URLSearchParams(current);
        result.set("tab", next);
        return result;
      });
      setPage(0);
    },
    [setParams],
  );
  const now = clock
    ? clock.server + Math.max(0, instant.mono - clock.at)
    : instant.wall;
  const viewData = data?.view === `${tab}/${search}/${page}` ? data : null;
  const stale =
    !online || Boolean(error) || !lastSync || instant.mono - lastSync > 25000;

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-gradient-to-br from-slate-950 via-blue-950 to-blue-800 text-white p-6 md:p-8">
        <p className="text-xs uppercase tracking-widest text-blue-200 mb-2">
          Approved dealer workspace
        </p>
        <h1 className="text-2xl md:text-3xl font-bold">Your auction desk</h1>
        <p className="text-sm text-blue-100 mt-2">
          {profile?.business_name || profile?.dealer_name || "Welcome back"}.
          Track your bids and review every amount before you confirm.
        </p>
        <p className="text-xs text-blue-200 mt-4">
          Highest bid ≠ confirmed purchase. Final sale requires team approval.
        </p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            onClick={() => switchTab(key)}
            className={`text-left rounded-2xl border p-4 ${tab === key ? "bg-blue-50 border-blue-400" : "bg-white border-slate-200"}`}
          >
            <p className="text-xs text-slate-600">{label}</p>
            <p className="text-2xl font-bold mt-2">
              {data?.summary[key] ?? "—"}
            </p>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-3 justify-between items-center">
        <div
          role="status"
          className={`text-xs ${stale ? "text-amber-800" : "text-slate-500"}`}
        >
          {!online
            ? "Offline · displayed prices may be outdated"
            : stale
              ? "Auction data needs refreshing"
              : `Verified ${Math.floor(Math.max(0, instant.mono - lastSync) / 1000)}s ago · refreshes every 15s`}
        </div>
        <button
          onClick={() => setRefresh((value) => value + 1)}
          disabled={loading || !online}
          className="flex items-center gap-2 text-sm text-blue-700 font-semibold disabled:opacity-40"
        >
          <RefreshCw size={15} /> Refresh
        </button>
      </div>
      <div
        className="flex gap-2 overflow-x-auto pb-1"
        role="tablist"
        aria-label="Auction views"
      >
        {TABS.map(([key, label]) => (
          <button
            role="tab"
            aria-selected={tab === key}
            key={key}
            onClick={() => switchTab(key)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${tab === key ? "bg-blue-700 text-white" : "bg-white text-slate-600 border"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <label className="flex gap-2 items-center bg-white border rounded-xl p-3">
        <Search size={18} className="text-slate-400" />
        <input
          aria-label="Search auctions"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search car or location"
          className="bg-transparent w-full text-sm outline-none"
        />
      </label>
      {error && (
        <div
          role="alert"
          className="bg-red-50 text-red-800 rounded-xl p-4 text-sm"
        >
          {error} Previously loaded data may be outdated.
        </div>
      )}
      {watchError && (
        <p role="alert" className="text-red-700 text-sm">
          {watchError}
        </p>
      )}
      {loading && (
        <p role="status" className="text-sm text-slate-500">
          Updating auctions…
        </p>
      )}
      {!loading && !error && viewData?.items.length === 0 && (
        <div className="bg-white rounded-2xl border p-8 text-center">
          <Gavel className="mx-auto text-blue-500 mb-3" />
          <h2 className="font-semibold">No auctions in this view</h2>
          <p className="text-sm text-slate-500 mt-2">
            Try another tab or clear your search. Use the heart on a car to add
            it to your watchlist.
          </p>
        </div>
      )}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {viewData?.items.map((car) => (
          <article
            key={car.id}
            className="bg-white rounded-2xl border border-slate-200 overflow-hidden"
          >
            <div className="relative h-40 bg-slate-100">
              {car.thumbnail_url || car.images?.[0] ? (
                <img
                  src={car.thumbnail_url || car.images[0]}
                  alt={car.vehicle_title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="h-full grid place-items-center text-slate-400 text-sm">
                  No vehicle photo
                </div>
              )}
              <button
                onClick={() => toggleWatch(car)}
                disabled={Boolean(watchBusy) || !online}
                aria-label={`${car.watchlisted ? "Remove from" : "Add to"} watchlist: ${car.vehicle_title}`}
                aria-pressed={car.watchlisted}
                className="absolute right-3 top-3 rounded-full bg-white p-2 text-blue-700 shadow disabled:opacity-50"
              >
                <Heart
                  size={18}
                  fill={car.watchlisted ? "currentColor" : "none"}
                />
              </button>
            </div>
            <div className="p-4">
              <BidStatus
                car={car}
                userId={user.id}
                myBid={car.last_bid}
                now={now}
              />
              <h2 className="font-bold mt-3">{car.vehicle_title}</h2>
              <p className="text-xs text-slate-500 mt-1">
                {[car.year, car.location].filter(Boolean).join(" · ")}
              </p>
              <dl className="grid grid-cols-2 gap-3 my-4 text-sm">
                <div>
                  <dt className="text-xs text-slate-500">Highest bid</dt>
                  <dd className="font-bold">{money(car.current_bid_dealer)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Your last bid</dt>
                  <dd className="font-semibold">
                    {money(car.last_bid?.amount)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Next minimum</dt>
                  <dd>
                    {car.is_live && timeLeft(car.auction_end, now) !== "Ended"
                      ? money(minimumBid(car))
                      : "Closed"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Time remaining</dt>
                  <dd className="font-mono">
                    {timeLeft(car.auction_end, now)}
                  </dd>
                </div>
              </dl>
              <p className="text-xs text-slate-500 mb-3">
                Your bids on this car: {car.my_bid_count}
              </p>
              <Link
                to={`/cars/${car.id}#dealer-bidding`}
                className="w-full rounded-xl bg-blue-700 text-white py-3 px-3 flex justify-center items-center gap-2 font-semibold text-sm"
              >
                {car.is_live && timeLeft(car.auction_end, now) !== "Ended"
                  ? "View & review bid"
                  : "View auction result"}
                <ArrowUpRight size={15} />
              </Link>
            </div>
          </article>
        ))}
      </div>
      {viewData && (
        <div className="flex justify-between items-center gap-3 text-sm">
          <button
            disabled={page === 0 || loading}
            onClick={() => setPage((value) => value - 1)}
            className="border rounded-xl px-4 py-2 disabled:opacity-40"
          >
            Previous
          </button>
          <span>
            {viewData.total} results · Page {page + 1}
          </span>
          <button
            disabled={(page + 1) * PAGE_SIZE >= viewData.total || loading}
            onClick={() => setPage((value) => value + 1)}
            className="border rounded-xl px-4 py-2 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
