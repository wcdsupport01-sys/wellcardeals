import React, { useEffect, useState, useCallback, useMemo } from "react";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";
import {
  Trophy,
  Phone,
  Mail,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Search,
  RefreshCw,
  Gavel,
  Radio,
  IndianRupee,
} from "lucide-react";

const formatINR = (v) => (v == null ? "—" : "₹" + Math.round(Number(v)).toLocaleString("en-IN"));

// ---------------------------------------------------------------------------
// Small time helpers
// ---------------------------------------------------------------------------
function useNow(tickMs = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), tickMs);
    return () => clearInterval(t);
  }, [tickMs]);
  return now;
}

function countdownLabel(endTime, now) {
  const diff = new Date(endTime).getTime() - now;
  if (diff <= 0) return null;
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1000);
  return `${h > 0 ? h + "h " : ""}${m}m ${s}s`;
}

function agoLabel(time, now) {
  const diff = Math.max(0, now - new Date(time).getTime());
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function waLink(phone) {
  if (!phone) return null;
  let digits = String(phone).replace(/[^\d]/g, "");
  if (digits.length === 10) digits = "91" + digits; // assume Indian mobile if no country code given
  return `https://wa.me/${digits}`;
}

// ---------------------------------------------------------------------------
// Build the buyer / dealer price tracks for a car — a car can carry two
// independent bidding tracks at once (see dealer_pricing_migration.sql).
// ---------------------------------------------------------------------------
function tracksForCar(car) {
  const tracks = [];
  if (car.base_price_buyer != null || car.current_bid_buyer != null) {
    tracks.push({
      role: "buyer",
      label: "Buyer",
      currentBid: car.current_bid_buyer ?? car.base_price_buyer,
      bidderId: car.highest_bidder_id_buyer,
      bidderName: car.highest_bidder_name_buyer,
      hasBid: Boolean(car.highest_bidder_name_buyer),
      contacted: car.buyer_winner_contacted,
      contactedAt: car.buyer_winner_contacted_at,
    });
  }
  if (car.base_price_dealer != null || car.current_bid_dealer != null || car.access_type === "dealer_only") {
    tracks.push({
      role: "dealer",
      label: "Dealer",
      currentBid: car.current_bid_dealer ?? car.base_price_dealer,
      bidderId: car.highest_bidder_id_dealer,
      bidderName: car.highest_bidder_name_dealer,
      hasBid: Boolean(car.highest_bidder_name_dealer),
      contacted: car.dealer_winner_contacted,
      contactedAt: car.dealer_winner_contacted_at,
    });
  }
  return tracks;
}

const ROLE_STYLES = {
  buyer: "bg-sky-500/15 text-sky-300",
  dealer: "bg-violet-500/15 text-violet-300",
};

// ---------------------------------------------------------------------------
// Winner card — shown for a track whose auction has ended and has a bidder
// ---------------------------------------------------------------------------
function WinnerCard({ car, track, now, onMarkContacted, onMarkSold, marking, soldSaving }) {
  const profile = track.bidderId ? track.profile : null;
  const phone = profile?.phone;
  const email = profile?.email;
  const wa = waLink(phone);

  return (
    <div
      className={`border rounded-2xl p-5 ${
        track.contacted ? "border-white/10 bg-white/[0.02]" : "border-amber-400/30 bg-amber-500/[0.06]"
      }`}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Trophy size={16} className={track.contacted ? "text-zinc-500" : "text-amber-400"} />
            <p className="font-semibold text-white truncate">{car.vehicle_title}</p>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase ${ROLE_STYLES[track.role]}`}>
              {track.label} track
            </span>
            {track.contacted && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">
                Contacted
              </span>
            )}
          </div>
          <p className="text-sm text-zinc-400">
            Auction ended {agoLabel(car.auction_end, now)} · Winning bid{" "}
            <span className="text-white font-semibold">{formatINR(track.currentBid)}</span>
          </p>

          <div className="mt-3 flex items-center gap-2 flex-wrap text-sm">
            <span className="font-medium text-white">{track.bidderName || "Unknown bidder"}</span>
            {phone && <span className="text-zinc-400">· {phone}</span>}
            {email && <span className="text-zinc-400">· {email}</span>}
            {!profile && track.bidderId && (
              <span className="text-zinc-500 text-xs">(loading contact…)</span>
            )}
            {!track.bidderId && (
              <span className="text-zinc-500 text-xs">(no account on file — name only)</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {phone && (
            <a
              href={`tel:${phone}`}
              className="flex items-center gap-1.5 text-xs font-semibold bg-white/5 hover:bg-white/10 text-white px-3 py-2 rounded-lg transition"
            >
              <Phone size={14} /> Call
            </a>
          )}
          {wa && (
            <a
              href={wa}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-xs font-semibold bg-emerald-600/90 hover:bg-emerald-600 text-white px-3 py-2 rounded-lg transition"
            >
              <MessageCircle size={14} /> WhatsApp
            </a>
          )}
          {email && (
            <a
              href={`mailto:${email}`}
              className="flex items-center gap-1.5 text-xs font-semibold bg-white/5 hover:bg-white/10 text-white px-3 py-2 rounded-lg transition"
            >
              <Mail size={14} /> Email
            </a>
          )}
          {!track.contacted && (
            <button
              disabled={marking}
              onClick={() => onMarkContacted(car.id, track.role)}
              className="flex items-center gap-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 px-3 py-2 rounded-lg transition"
            >
              <CheckCircle2 size={14} /> {marking ? "Saving…" : "Mark Contacted"}
            </button>
          )}
          {car.status !== "sold" && (
            <button
              disabled={soldSaving}
              onClick={() => onMarkSold(car.id, track.role)}
              className="flex items-center gap-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white px-3 py-2 rounded-lg transition"
            >
              <Trophy size={14} /> {soldSaving ? "Saving…" : "Mark as Sold"}
            </button>
          )}
          {car.status === "sold" && (
            <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-rose-500/15 text-rose-400">
              SOLD
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Compact row for the full auction list, expandable to show bid history
// ---------------------------------------------------------------------------
function AuctionRow({ car, now, isExpanded, onToggle, bidHistory, bidCount, profilesMap, onMarkContacted, onMarkSold, marking, soldSaving }) {
  const tracks = tracksForCar(car).map((t) => ({ ...t, profile: t.bidderId ? profilesMap[t.bidderId] : null }));
  const ended = car.auction_end ? new Date(car.auction_end).getTime() <= now : false;
  const countdown = car.auction_end ? countdownLabel(car.auction_end, now) : null;

  return (
    <div className="border border-white/10 rounded-xl bg-white/[0.02] overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-white/[0.03] transition">
        <div className="flex items-center gap-3 min-w-0">
          {car.thumbnail_url ? (
            <img src={car.thumbnail_url} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0 bg-zinc-800" />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-zinc-800 shrink-0 flex items-center justify-center text-zinc-600">
              <Gavel size={16} />
            </div>
          )}
          <div className="min-w-0">
            <p className="font-medium text-white truncate">{car.vehicle_title}</p>
            <div className="flex items-center gap-2 flex-wrap mt-0.5 text-xs text-zinc-400">
              {!ended ? (
                <span className="flex items-center gap-1 text-emerald-400 font-medium">
                  <Radio size={11} /> LIVE · {countdown || "ending"}
                </span>
              ) : (
                <span className="text-zinc-500">Ended {agoLabel(car.auction_end, now)}</span>
              )}
              <span>·</span>
              <span>{bidCount ?? 0} bid{bidCount === 1 ? "" : "s"}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <div className="hidden sm:flex items-center gap-4">
            {tracks.map((t) => (
              <div key={t.role} className="text-right">
                <p className="text-[10px] uppercase tracking-wide text-zinc-500">{t.label}</p>
                <p className="text-sm font-semibold text-white">{formatINR(t.currentBid)}</p>
              </div>
            ))}
          </div>
          {isExpanded ? <ChevronUp size={18} className="text-zinc-500" /> : <ChevronDown size={18} className="text-zinc-500" />}
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-white/10 px-4 py-4 space-y-4">
          {/* Winner callouts for tracks that have ended with a bid */}
          {tracks
            .filter((t) => ended && t.hasBid)
            .map((t) => (
              <WinnerCard
                key={t.role}
                car={car}
                track={t}
                now={now}
                onMarkContacted={onMarkContacted}
                onMarkSold={onMarkSold}
                marking={marking === `${car.id}:${t.role}`}
                soldSaving={soldSaving === `${car.id}:${t.role}`}
              />
            ))}

          {/* Current standing for tracks still live */}
          {!ended && (
            <div className="grid sm:grid-cols-2 gap-3">
              {tracks.map((t) => (
                <div key={t.role} className="border border-white/10 rounded-xl p-3">
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase ${ROLE_STYLES[t.role]}`}>
                      {t.label} track
                    </span>
                    <span className="text-sm font-bold text-white">{formatINR(t.currentBid)}</span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-1.5">
                    {t.hasBid ? (
                      <>Currently winning: <span className="text-white font-medium">{t.bidderName}</span></>
                    ) : (
                      "No bids yet — showing starting price"
                    )}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Full bid history */}
          <div>
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">Bid History</p>
            {!bidHistory ? (
              <p className="text-sm text-zinc-500">Loading…</p>
            ) : bidHistory.length === 0 ? (
              <p className="text-sm text-zinc-500">No bids placed yet.</p>
            ) : (
              <ul className="divide-y divide-white/5 max-h-72 overflow-y-auto">
                {bidHistory.map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase shrink-0 ${ROLE_STYLES[b.bidder_role] || "bg-zinc-500/15 text-zinc-400"}`}>
                        {b.bidder_role || "buyer"}
                      </span>
                      <span className="text-zinc-200 truncate">{b.bidder_name}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-zinc-500 text-xs">{agoLabel(b.created_at, now)}</span>
                      <span className="font-semibold text-white">{formatINR(b.amount)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function AuctionBidsPage() {
  const now = useNow();
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("followup"); // followup | live | all
  const [expanded, setExpanded] = useState({}); // { [carId]: bool }
  const [bidHistory, setBidHistory] = useState({}); // { [carId]: rows | undefined }
  const [bidCounts, setBidCounts] = useState({}); // { [carId]: number }
  const [profilesMap, setProfilesMap] = useState({});
  const [marking, setMarking] = useState(null);
  const [soldMarking, setSoldMarking] = useState(null);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setError("Supabase isn't configured yet.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("cars")
      .select("*")
      .not("auction_end", "is", null)
      .order("auction_end", { ascending: false });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    setCars(data || []);

    // Bid counts for every auction car, in one query.
    const ids = (data || []).map((c) => c.id);
    if (ids.length > 0) {
      const { data: bidRows } = await supabase.from("car_bids").select("car_id").in("car_id", ids);
      const counts = {};
      (bidRows || []).forEach((r) => {
        counts[r.car_id] = (counts[r.car_id] || 0) + 1;
      });
      setBidCounts(counts);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Load contact info for every current highest bidder across all cars.
  useEffect(() => {
    const ids = Array.from(
      new Set(cars.flatMap((c) => [c.highest_bidder_id_buyer, c.highest_bidder_id_dealer]).filter(Boolean))
    ).filter((id) => !profilesMap[id]);
    if (ids.length === 0) return;
    supabase
      .from("profiles")
      .select("id, full_name, email, phone, role")
      .in("id", ids)
      .then(({ data }) => {
        if (!data) return;
        setProfilesMap((prev) => {
          const next = { ...prev };
          data.forEach((p) => (next[p.id] = p));
          return next;
        });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cars]);

  // Realtime — live bids & winner updates, no refresh needed.
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const carsChannel = supabase
      .channel("admin-auction-cars")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "cars" }, (payload) => {
        setCars((prev) => prev.map((c) => (c.id === payload.new.id ? { ...c, ...payload.new } : c)));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "cars" }, (payload) => {
        if (payload.new.auction_end) {
          setCars((prev) => (prev.some((c) => c.id === payload.new.id) ? prev : [payload.new, ...prev]));
        }
      })
      .subscribe();

    const bidsChannel = supabase
      .channel("admin-auction-bids")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "car_bids" }, (payload) => {
        const row = payload.new;
        setBidCounts((prev) => ({ ...prev, [row.car_id]: (prev[row.car_id] || 0) + 1 }));
        setBidHistory((prev) => (prev[row.car_id] ? { ...prev, [row.car_id]: [row, ...prev[row.car_id]] } : prev));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(carsChannel);
      supabase.removeChannel(bidsChannel);
    };
  }, []);

  async function toggleExpand(carId) {
    setExpanded((prev) => ({ ...prev, [carId]: !prev[carId] }));
    if (!bidHistory[carId]) {
      const { data } = await supabase
        .from("car_bids")
        .select("*")
        .eq("car_id", carId)
        .order("created_at", { ascending: false })
        .limit(100);
      setBidHistory((prev) => ({ ...prev, [carId]: data || [] }));
    }
  }

  async function markContacted(carId, role) {
    const key = `${carId}:${role}`;
    setMarking(key);
    const field = role === "dealer" ? "dealer_winner_contacted" : "buyer_winner_contacted";
    const atField = role === "dealer" ? "dealer_winner_contacted_at" : "buyer_winner_contacted_at";
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase.functions.invoke("update-car", {
      body: { id: carId, [field]: true, [atField]: nowIso },
    });
    setMarking(null);
    if (error || data?.error) {
      alert(`Couldn't update: ${error?.message || data.error}`);
      return;
    }
    setCars((prev) => prev.map((c) => (c.id === carId ? { ...c, [field]: true, [atField]: nowIso } : c)));
  }

  async function markSold(carId, role) {
    const key = role ? `${carId}:${role}` : carId;
    setSoldMarking(key);
    try {
      // mark-sold is admin-only (verifies JWT + role='admin' server-side),
      // marks the winning track sold with the service_role key, and
      // best-effort pushes the winner's details to Google Sheets.
      const { data, error } = await supabase.functions.invoke("mark-sold", {
        body: { carId, role: role || "buyer" },
      });
      if (error || data?.error) throw new Error(error?.message || data.error);
      setCars((prev) => prev.map((c) => (c.id === carId ? { ...c, status: "sold" } : c)));
    } catch (fnError) {
      alert(`Couldn't mark as sold: ${fnError.message}`);
    } finally {
      setSoldMarking(null);
    }
  }

  // Attach profile objects + track breakdown for filtering/search.
  const enriched = useMemo(() => {
    return cars
      .filter((c) => (c.vehicle_title || "").toLowerCase().includes(query.trim().toLowerCase()))
      .map((c) => {
        const ended = c.auction_end ? new Date(c.auction_end).getTime() <= now : false;
        const tracks = tracksForCar(c);
        const needsFollowup = ended && tracks.some((t) => t.hasBid && !t.contacted);
        return { car: c, ended, tracks, needsFollowup };
      });
  }, [cars, query, now]);

  const followupList = enriched.filter((e) => e.needsFollowup);
  const liveList = enriched.filter((e) => !e.ended);
  const visibleList = tab === "followup" ? followupList : tab === "live" ? liveList : enriched;

  const sortedVisible = useMemo(() => {
    return [...visibleList].sort((a, b) => {
      if (tab === "live") return new Date(a.car.auction_end) - new Date(b.car.auction_end); // ending soonest first
      return new Date(b.car.auction_end) - new Date(a.car.auction_end); // most recently ended first
    });
  }, [visibleList, tab]);

  // Revenue snapshot — live standing value vs value sitting in the
  // follow-up queue, summed across both buyer and dealer tracks.
  const revenueSnapshot = useMemo(() => {
    let liveValue = 0;
    let followupValue = 0;
    enriched.forEach(({ ended, tracks, needsFollowup }) => {
      tracks.forEach((t) => {
        if (!ended && t.currentBid != null) liveValue += Number(t.currentBid) || 0;
        if (needsFollowup && t.hasBid && !t.contacted) followupValue += Number(t.currentBid) || 0;
      });
    });
    return { liveValue, followupValue };
  }, [enriched]);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white mb-1">Live Bids & Auction Winners</h1>
      <p className="text-sm text-zinc-400 mb-4">
        Track who's bidding on every car in real time. The moment an auction ends, the winner's contact details show up here so your team can reach out.
      </p>

      {/* Revenue snapshot */}
      {!loading && (cars.length > 0) && (
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="border border-white/10 rounded-xl p-3.5 bg-white/[0.02] flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg bg-emerald-600/20 flex items-center justify-center shrink-0">
              <Radio size={15} className="text-emerald-400" />
            </span>
            <div>
              <p className="text-[11px] text-zinc-500">Live auction value</p>
              <p className="text-sm font-bold text-white">{formatINR(revenueSnapshot.liveValue)}</p>
            </div>
          </div>
          <div className="border border-white/10 rounded-xl p-3.5 bg-white/[0.02] flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg bg-amber-600/20 flex items-center justify-center shrink-0">
              <IndianRupee size={15} className="text-amber-400" />
            </span>
            <div>
              <p className="text-[11px] text-zinc-500">Awaiting follow-up</p>
              <p className="text-sm font-bold text-white">{formatINR(revenueSnapshot.followupValue)}</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mb-5 sm:items-center sm:justify-between">
        <div className="flex gap-2">
          {[
            { key: "followup", label: `Needs Follow-up (${followupList.length})` },
            { key: "live", label: `Live Now (${liveList.length})` },
            { key: "all", label: "All Auctions" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                tab === t.key ? "bg-amber-500/15 text-amber-400" : "text-zinc-400 hover:bg-white/5"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by car name…"
              className="pl-8 pr-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-amber-400/50 w-48"
            />
          </div>
          <button
            onClick={load}
            className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-white/5 transition"
          >
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : error ? (
        <p className="text-sm text-red-400">{error}</p>
      ) : sortedVisible.length === 0 ? (
        <p className="text-sm text-zinc-500">
          {tab === "followup" ? "No winners waiting on a follow-up right now." : "No auctions match right now."}
        </p>
      ) : tab === "followup" ? (
        <div className="space-y-3">
          {sortedVisible.map(({ car, tracks }) => {
            const enrichedTracks = tracks.map((t) => ({ ...t, profile: t.bidderId ? profilesMap[t.bidderId] : null }));
            return enrichedTracks
              .filter((t) => t.hasBid && !t.contacted)
              .map((t) => (
                <WinnerCard
                  key={`${car.id}-${t.role}`}
                  car={car}
                  track={t}
                  now={now}
                  onMarkContacted={markContacted}
                  onMarkSold={markSold}
                  marking={marking === `${car.id}:${t.role}`}
                  soldSaving={soldMarking === `${car.id}:${t.role}`}
                />
              ));
          })}
        </div>
      ) : (
        <div className="space-y-2.5">
          {sortedVisible.map(({ car }) => (
            <AuctionRow
              key={car.id}
              car={car}
              now={now}
              isExpanded={Boolean(expanded[car.id])}
              onToggle={() => toggleExpand(car.id)}
              bidHistory={bidHistory[car.id]}
              bidCount={bidCounts[car.id]}
              profilesMap={profilesMap}
              onMarkContacted={markContacted}
              onMarkSold={markSold}
              marking={marking}
              soldSaving={soldMarking}
            />
          ))}
        </div>
      )}
    </div>
  );
}