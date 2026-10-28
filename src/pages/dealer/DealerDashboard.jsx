import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useOutletContext, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, ArrowRight, CalendarDays, Car, ChevronDown, Clock3,
  Gauge, Gavel, Heart, LayoutGrid, List, MapPin, RefreshCw,
  ScanLine, Search, ShieldCheck, TrendingUp, Trophy,
} from "lucide-react";
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
  ["live", "Live auctions", Gavel, "Open for bidding"],
  ["bids", "My bids", TrendingUp, "Your bidding activity"],
  ["watchlist", "Watchlist", Heart, "Saved for a closer look"],
  ["results", "Results", Trophy, "Your closed auctions"],
];
const PAGE_SIZE = 24;

function DealerVehiclePhoto({ image, title }) {
  const [failed, setFailed] = useState(false);
  if (!image || failed) {
    return <div className="dealer-photo-placeholder"><Car aria-hidden="true" /><span>No vehicle photo</span></div>;
  }
  return <img src={image} alt={title} loading="lazy" onError={() => setFailed(true)} />;
}

export default function DealerDashboard() {
  const { user, profile } = useAuth();
  const { openHelp } = useOutletContext();
  const [layout, setLayout] = useState("grid");
  const [citySearch, setCitySearch] = useState("");
  const locationRef = useRef(null);
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
    const dismissLocation = (event) => {
      const details = locationRef.current;
      if (details?.open && !details.contains(event.target)) details.open = false;
    };
    document.addEventListener("pointerdown", dismissLocation);
    return () => document.removeEventListener("pointerdown", dismissLocation);
  }, []);

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
    <div className="dealer-auction-desk">
      <div className="dealer-heading-row">
        <div>
          <p className="dealer-eyebrow">WELCOME BACK{profile?.business_name || profile?.dealer_name ? `, ${profile.business_name || profile.dealer_name}` : ""}</p>
          <h1>Your auction desk<span aria-hidden="true">.</span></h1>
          <p className="dealer-intro">Good cars. Clear bids. Your next opportunity starts here.</p>
        </div>
        <div>
          <div role="status" className={`dealer-market-state${stale ? " is-stale" : ""}`}>
            <span className="dealer-state-dot" aria-hidden="true" />
            <span>{!online ? "Offline · prices may be outdated" : stale ? (loading ? "Checking auction updates" : "Auction data needs refreshing") : "Live auction updates"}</span>
          </div>
          <p className="dealer-sync-caption">{lastSync ? `Verified ${Math.floor(Math.max(0, instant.mono - lastSync) / 1000)}s ago · refreshes every 15s` : "Checking the latest auction data"}</p>
        </div>
      </div>

      <section className="dealer-stats" aria-label="Your auction overview">
        {TABS.map((item) => {
          const [key, label, Icon, description] = item;
          return (
          <button key={key} onClick={() => switchTab(key)}
            className={`dealer-stat${tab === key ? " active" : ""}`}
            aria-label={`${label} ${data?.summary[key] ?? "—"}`}>
            <span className="dealer-stat-label">{label}</span>
            <span className="dealer-stat-icon"><Icon size={17} aria-hidden="true" /></span>
            <strong className="dealer-stat-value">{data?.summary[key] == null ? "—" : String(data.summary[key]).padStart(2, "0")}</strong>
            <span className="dealer-stat-desc">{description}</span>
          </button>
          );
        })}
      </section>

      <section className="dealer-guide">
        <span className="dealer-guide-icon"><ScanLine size={21} aria-hidden="true" /></span>
        <div><strong>A good bid starts with a closer look.</strong><p>Review the vehicle details and minimum amount before you confirm.</p></div>
        <button onClick={openHelp}><span>How bidding works</span><ArrowRight size={16} aria-hidden="true" /></button>
      </section>

      <div className="dealer-tabs" role="tablist" aria-label="Auction views">
        {TABS.map(([key, label]) => (
          <button role="tab" aria-selected={tab === key} key={key} className="dealer-tab" onClick={() => switchTab(key)}>
            {label}<span className="dealer-tab-count">{data?.summary[key] ?? "—"}</span>
          </button>
        ))}
      </div>
      <div className="dealer-toolbar">
        <label className="dealer-search"><Search size={17} aria-hidden="true" />
          <input aria-label="Search auctions" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by make, model or city..." />
        </label>
        <details className="dealer-location" ref={locationRef} onKeyDown={(event) => {
          if (event.key === "Escape") { event.currentTarget.open = false; event.currentTarget.querySelector("summary")?.focus(); }
        }}>
          <summary><MapPin size={15} aria-hidden="true" />Location<ChevronDown size={13} aria-hidden="true" /></summary>
          <form className="dealer-location-popover" onSubmit={(event) => {
            event.preventDefault(); setQuery(citySearch.trim());
            if (locationRef.current) { locationRef.current.open = false; locationRef.current.querySelector("summary")?.focus(); }
          }}>
            <label htmlFor="dealer-city-search">Search a city or location</label>
            <input id="dealer-city-search" value={citySearch} onChange={(event) => setCitySearch(event.target.value)} placeholder="Enter a city or area" />
            <button className="dealer-primary-button" type="submit">Find auctions <ArrowRight size={13} aria-hidden="true" /></button>
          </form>
        </details>
        <div className="dealer-view-switch" aria-label="Display layout">
          <button aria-label="Grid view" aria-pressed={layout === "grid"} onClick={() => setLayout("grid")}><LayoutGrid size={17} /></button>
          <button aria-label="List view" aria-pressed={layout === "list"} onClick={() => setLayout("list")}><List size={17} /></button>
        </div>
      </div>
      <div className="dealer-results-row">
        <p>{viewData ? <><strong>{viewData.total} {viewData.total === 1 ? "car" : "cars"}</strong> {query ? `matching “${query}”` : "in this view"}</> : "Loading auction results…"}</p>
        <div className="dealer-results-actions">
          {query && <button onClick={() => { setQuery(""); setCitySearch(""); }}>Clear search</button>}
          <span className="dealer-sort-note"><Clock3 size={13} aria-hidden="true" />{tab === "results" ? "Most recent first" : "Ending soonest"}</span>
          <button onClick={() => setRefresh((value) => value + 1)} disabled={loading || !online}><RefreshCw size={14} className={loading ? "animate-spin" : undefined} aria-hidden="true" />Refresh</button>
        </div>
      </div>
      {error && <div role="alert" className="dealer-error">{error} Previously loaded data may be outdated.</div>}
      {watchError && <div role="alert" className="dealer-error">{watchError}</div>}
      {loading && <p role="status" className="dealer-updating">Updating auctions…</p>}
      {!loading && !error && viewData?.items.length === 0 && (
        <div className="dealer-empty-state">
          {tab === "watchlist" ? <Heart aria-hidden="true" /> : <Gavel aria-hidden="true" />}
          <h2>No auctions in this view</h2>
          <p>{query ? "Try another car or location, or clear your search." : "Try another tab. Use the heart on a car to add it to your watchlist."}</p>
          {query && <button className="dealer-secondary-button" onClick={() => { setQuery(""); setCitySearch(""); }}>Clear search</button>}
        </div>
      )}
      <div className={`dealer-auction-grid${layout === "list" ? " is-list" : ""}`}>
        {loading && !viewData && [0, 1, 2].map((key) => <div className="dealer-auction-skeleton" key={key} aria-hidden="true"><div /><div><span /><span /><span /></div></div>)}
        {viewData?.items.map((car) => {
          const remaining = timeLeft(car.auction_end, now);
          const live = car.is_live && remaining !== "Ended";
          const urgent = live && Date.parse(car.auction_end) - now <= 300000;
          const image = car.thumbnail_url || car.images?.[0];
          const detailUrl = `/cars/${car.id}#dealer-bidding`;
          return (
            <article key={car.id} className="dealer-auction-card">
              <div className="dealer-car-photo">
                <Link to={detailUrl} aria-label={`Open auction: ${car.vehicle_title}`}>
                  <DealerVehiclePhoto key={image || "no-photo"} image={image} title={car.vehicle_title} />
                </Link>
                <span className="dealer-car-id">ID {String(car.id).slice(0, 8).toUpperCase()}</span>
                <button onClick={() => toggleWatch(car)} disabled={Boolean(watchBusy) || !online}
                  aria-label={`${car.watchlisted ? "Remove from" : "Add to"} watchlist: ${car.vehicle_title}`}
                  aria-pressed={car.watchlisted} className="dealer-watch-button">
                  <Heart size={17} fill={car.watchlisted ? "currentColor" : "none"} />
                </button>
                <span className={`dealer-live-label${!live || stale ? " is-closed" : ""}`}><span className="dealer-state-dot" aria-hidden="true" />{live ? (stale ? "CHECK STATUS" : "LIVE AUCTION") : "AUCTION CLOSED"}</span>
              </div>
              <div className="dealer-car-body">
                <BidStatus car={car} userId={user.id} myBid={car.last_bid} now={now} />
                <h2><Link to={detailUrl}>{car.vehicle_title}</Link></h2>
                <p className="dealer-car-subtitle">{car.variant && <><span>{car.variant}</span><span aria-hidden="true">·</span></>}{car.location && <><MapPin size={12} aria-hidden="true" /><span>{car.location}</span></>}</p>
                <div className="dealer-car-meta">
                  {car.year && <span><CalendarDays size={12} aria-hidden="true" />{car.year}</span>}
                  {car.mileage_km != null && Number.isFinite(Number(car.mileage_km)) && <span><Gauge size={12} aria-hidden="true" />{Number(car.mileage_km).toLocaleString("en-IN")} km</span>}
                  <span title="Your saved bids on this car"><Gavel size={12} aria-hidden="true" />{car.my_bid_count ?? 0} saved bids</span>
                </div>
                <dl className="dealer-card-bids">
                  <div><dt>Highest bid</dt><dd className="dealer-price">{money(car.current_bid_dealer)}</dd></div>
                  <div className={`dealer-card-time${urgent ? " is-urgent" : ""}`}><dt>Time remaining</dt><dd><Clock3 size={12} aria-hidden="true" />{remaining}</dd></div>
                </dl>
                <p className="dealer-card-last-bid"><span>Your last bid</span><strong>{money(car.last_bid?.amount)}</strong></p>
              </div>
              <div className="dealer-car-footer">
                <dl><dt>Next minimum</dt><dd>{live ? money(minimumBid(car)) : "Closed"}</dd></dl>
                <Link to={detailUrl} className="dealer-primary-button">{live ? "View & bid" : "View result"}<ArrowRight size={14} aria-hidden="true" /></Link>
              </div>
            </article>
          );
        })}
      </div>
      {viewData && viewData.total > 0 && (
        <div className="dealer-pagination">
          <button disabled={page === 0 || loading} onClick={() => setPage((value) => value - 1)}><ArrowLeft size={13} aria-hidden="true" />Previous</button>
          <span>{viewData.total} results · Page {page + 1}</span>
          <button disabled={(page + 1) * PAGE_SIZE >= viewData.total || loading} onClick={() => setPage((value) => value + 1)}>Next<ArrowRight size={13} aria-hidden="true" /></button>
        </div>
      )}
      <div className="dealer-market-footer"><span><ShieldCheck size={13} aria-hidden="true" />Every accepted bid has a saved record.</span><span>Highest bid is subject to seller approval.</span></div>
      <footer className="dealer-page-footer"><span>© {new Date().getFullYear()} WellCarDeals · Your auction workspace.</span><span>Find. Bid. Drive.</span></footer>
    </div>
  );
}
