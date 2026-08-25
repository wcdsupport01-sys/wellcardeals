import { useEffect, useState } from "react";
import {
  Car, Hourglass, Gavel, ShoppingCart, Users, Handshake, Trophy,
  ArrowUp, ArrowDown, Eye, Check, X, Plus, AlertTriangle, ArrowRight,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import { Link } from "react-router-dom";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";

function StatCard({ icon: Icon, iconBg, label, value, delta, deltaUp, to }) {
  const Wrapper = to ? Link : "div";
  return (
    <Wrapper
      to={to}
      className={`bg-[#111827] border border-white/10 rounded-2xl p-5 flex flex-col gap-4 ${
        to ? "hover:border-white/20 transition" : ""
      }`}
    >
      <div className="flex items-center gap-3">
        <span className={`w-11 h-11 rounded-xl flex items-center justify-center ${iconBg}`}>
          <Icon size={20} className="text-white" />
        </span>
        <span className="text-sm text-zinc-400">{label}</span>
      </div>
      <div>
        <p className="text-2xl font-bold text-white">{value}</p>
        {delta && (
          <p className={`text-xs mt-1 flex items-center gap-1 ${deltaUp ? "text-emerald-400" : "text-rose-400"}`}>
            {deltaUp ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
            {delta}
          </p>
        )}
      </div>
    </Wrapper>
  );
}

// A single row in the unified "Needs Your Attention" queue — every pending
// item across the platform, in one place, so nothing gets missed.
function AttentionRow({ icon: Icon, iconBg, title, subtitle, count, to, ctaLabel }) {
  if (!count) return null;
  return (
    <Link
      to={to}
      className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] transition px-4 py-3.5"
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
          <Icon size={16} className="text-white" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-white">{title}</p>
          <p className="text-xs text-zinc-500 truncate">{subtitle}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs font-semibold bg-amber-500/15 text-amber-400 px-2.5 py-1 rounded-full">
          {count}
        </span>
        <span className="hidden sm:flex items-center gap-1 text-xs text-zinc-400">
          {ctaLabel} <ArrowRight size={12} />
        </span>
      </div>
    </Link>
  );
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalCars: 0,
    liveAuctions: 0,
    dealers: 0,
    soldTotal: 0,
    pendingDealers: 0,
    pendingAuctionRequests: 0,
    pendingBuyRequests: 0,
    negotiationQueue: 0,
    needsFollowup: 0,
  });
  const [chartData, setChartData] = useState([]);
  const [pendingCars, setPendingCars] = useState([]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const nowIso = new Date().toISOString();

        const [
          totalRes,
          liveRes,
          dealersRes,
          soldRes,
          pendingDealersRes,
          pendingAuctionReqRes,
          pendingBuyReqRes,
          negotiationRes,
          endedUncontactedRes,
          recentRes,
        ] = await Promise.all([
          supabase.from("cars").select("*", { count: "exact", head: true }),
          supabase.from("cars").select("*", { count: "exact", head: true }).eq("channel", "auction").gt("auction_end", nowIso),
          supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "dealer").eq("status", "approved"),
          supabase.from("cars").select("*", { count: "exact", head: true }).eq("status", "sold"),
          supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "dealer").eq("status", "pending"),
          supabase.from("car_auction_requests").select("*", { count: "exact", head: true }).eq("status", "pending"),
          supabase.from("car_purchase_requests").select("*", { count: "exact", head: true }).eq("status", "pending"),
          supabase.from("cars_negotiation_queue").select("*", { count: "exact", head: true }),
          supabase
            .from("cars")
            .select("id, highest_bidder_name_buyer, highest_bidder_name_dealer, buyer_winner_contacted, dealer_winner_contacted")
            .not("auction_end", "is", null)
            .lte("auction_end", nowIso),
          supabase.from("cars").select("id, title, brand, model, status, created_at, dealer_id")
            .eq("status", "draft").order("created_at", { ascending: false }).limit(5),
        ]);

        // A car "needs follow-up" if any of its tracks ended with a winning
        // bid that hasn't been marked contacted yet.
        const needsFollowup = (endedUncontactedRes.data || []).filter(
          (c) =>
            (c.highest_bidder_name_buyer && !c.buyer_winner_contacted) ||
            (c.highest_bidder_name_dealer && !c.dealer_winner_contacted)
        ).length;

        setStats({
          totalCars: totalRes.count ?? 0,
          liveAuctions: liveRes.count ?? 0,
          dealers: dealersRes.count ?? 0,
          soldTotal: soldRes.count ?? 0,
          pendingDealers: pendingDealersRes.count ?? 0,
          pendingAuctionRequests: pendingAuctionReqRes.count ?? 0,
          pendingBuyRequests: pendingBuyReqRes.count ?? 0,
          negotiationQueue: negotiationRes.count ?? 0,
          needsFollowup,
        });

        setPendingCars(recentRes.data ?? []);

        // Listings-added trend for the last 14 days
        const { data: recentCars } = await supabase
          .from("cars")
          .select("created_at")
          .order("created_at", { ascending: false })
          .limit(500);

        const days = {};
        const today = new Date();
        for (let i = 13; i >= 0; i--) {
          const d = new Date(today);
          d.setDate(d.getDate() - i);
          const key = d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
          days[key] = 0;
        }
        (recentCars || []).forEach((c) => {
          const key = new Date(c.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
          if (key in days) days[key] += 1;
        });
        setChartData(Object.entries(days).map(([date, listings]) => ({ date, listings })));
      } catch (err) {
        console.error("Dashboard load failed:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const totalNeedsAttention =
    stats.pendingDealers + stats.pendingAuctionRequests + stats.pendingBuyRequests +
    stats.negotiationQueue + stats.needsFollowup;

  return (
    <div className="min-h-screen -mx-4 md:-mx-8 -my-8 px-4 md:px-8 py-8 bg-[#0B1120]">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-white">Dashboard</h1>
        <p className="text-zinc-400 text-sm mt-1">Welcome back, Admin! Here's what's happening today.</p>
      </div>

      {!isSupabaseConfigured && (
        <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300 text-sm px-4 py-3">
          Supabase isn't configured yet, so these stats are showing 0 / empty. Add your env keys to see live numbers.
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard icon={Car} iconBg="bg-blue-600" label="Total Cars" value={loading ? "—" : stats.totalCars} delta="Live count" deltaUp />
        <StatCard icon={Gavel} iconBg="bg-violet-600" label="Live Auctions" value={loading ? "—" : stats.liveAuctions} delta="Running now" deltaUp to="/admin/bids" />
        <StatCard icon={Users} iconBg="bg-emerald-600" label="Approved Dealers" value={loading ? "—" : stats.dealers} delta="Registered" deltaUp to="/admin/dealers" />
        <StatCard icon={Trophy} iconBg="bg-rose-600" label="Cars Sold" value={loading ? "—" : stats.soldTotal} delta="All time" deltaUp />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Needs Your Attention — unified queue across every module */}
        <div className="lg:col-span-2 bg-[#111827] border border-white/10 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-400" />
              <h3 className="text-white font-semibold">Needs Your Attention</h3>
            </div>
            {!loading && (
              <span className="text-xs font-semibold bg-amber-500/15 text-amber-400 px-2.5 py-1 rounded-full">
                {totalNeedsAttention} total
              </span>
            )}
          </div>

          {loading ? (
            <p className="text-zinc-500 text-sm py-8 text-center">Loading…</p>
          ) : totalNeedsAttention === 0 ? (
            <p className="text-zinc-500 text-sm py-8 text-center">All caught up — nothing pending right now.</p>
          ) : (
            <div className="space-y-2.5">
              <AttentionRow
                icon={Trophy} iconBg="bg-amber-600"
                title="Auction winners awaiting contact"
                subtitle="Auction ended with a winning bid, not yet reached out to"
                count={stats.needsFollowup}
                to="/admin/bids"
                ctaLabel="Follow up"
              />
              <AttentionRow
                icon={Handshake} iconBg="bg-purple-600"
                title="Cars in negotiation queue"
                subtitle="Auction ended with zero bids — needs a direct deal"
                count={stats.negotiationQueue}
                to="/admin/negotiate"
                ctaLabel="Negotiate"
              />
              <AttentionRow
                icon={Gavel} iconBg="bg-blue-600"
                title="Sell-your-car requests"
                subtitle="Buyers waiting for approval + agent assignment"
                count={stats.pendingAuctionRequests}
                to="/admin/auction-requests"
                ctaLabel="Review"
              />
              <AttentionRow
                icon={ShoppingCart} iconBg="bg-emerald-600"
                title="Buy Now requests"
                subtitle="Buyers waiting to be contacted for a direct purchase"
                count={stats.pendingBuyRequests}
                to="/admin/buy-requests"
                ctaLabel="Review"
              />
              <AttentionRow
                icon={Hourglass} iconBg="bg-zinc-600"
                title="Dealer sign-ups"
                subtitle="New dealer applications waiting for approval"
                count={stats.pendingDealers}
                to="/admin/dealers"
                ctaLabel="Review"
              />
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="bg-[#111827] border border-white/10 rounded-2xl p-5">
          <h3 className="text-white font-semibold mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            <Link to="/admin/add-car" className="bg-white/5 hover:bg-white/10 transition rounded-xl p-4 flex flex-col items-center gap-2 text-center">
              <Plus size={20} className="text-blue-400" />
              <span className="text-xs text-zinc-300 font-medium">Add New Car</span>
            </Link>
            <Link to="/admin/bids" className="bg-white/5 hover:bg-white/10 transition rounded-xl p-4 flex flex-col items-center gap-2 text-center">
              <Gavel size={20} className="text-violet-400" />
              <span className="text-xs text-zinc-300 font-medium">Manage Auctions</span>
            </Link>
            <Link to="/admin/dealers" className="bg-white/5 hover:bg-white/10 transition rounded-xl p-4 flex flex-col items-center gap-2 text-center">
              <Users size={20} className="text-emerald-400" />
              <span className="text-xs text-zinc-300 font-medium">Dealers</span>
            </Link>
            <Link to="/admin/buy-requests" className="bg-white/5 hover:bg-white/10 transition rounded-xl p-4 flex flex-col items-center gap-2 text-center">
              <ShoppingCart size={20} className="text-amber-400" />
              <span className="text-xs text-zinc-300 font-medium">Buy Requests</span>
            </Link>
            <Link to="/admin/auction-requests" className="bg-white/5 hover:bg-white/10 transition rounded-xl p-4 flex flex-col items-center gap-2 text-center">
              <Car size={20} className="text-blue-400" />
              <span className="text-xs text-zinc-300 font-medium">Sell Requests</span>
            </Link>
            <Link to="/admin/negotiate" className="bg-white/5 hover:bg-white/10 transition rounded-xl p-4 flex flex-col items-center gap-2 text-center">
              <Handshake size={20} className="text-purple-400" />
              <span className="text-xs text-zinc-300 font-medium">Negotiate</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Trend chart */}
      <div className="bg-[#111827] border border-white/10 rounded-2xl p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold">New Listings — Last 14 Days</h3>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="listingsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
              <XAxis dataKey="date" stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: "#111827", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "#fff" }}
              />
              <Area type="monotone" dataKey="listings" stroke="#3b82f6" strokeWidth={2} fill="url(#listingsGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Pending approvals table */}
      <div className="bg-[#111827] border border-white/10 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold">Draft Cars Awaiting Publish</h3>
          <Link to="/admin/all-cars" className="text-xs text-blue-400 hover:underline">View All</Link>
        </div>

        {loading ? (
          <p className="text-zinc-500 text-sm py-8 text-center">Loading…</p>
        ) : pendingCars.length === 0 ? (
          <p className="text-zinc-500 text-sm py-8 text-center">No draft cars right now.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-zinc-500 text-xs uppercase border-b border-white/10">
                  <th className="pb-2 font-medium">Car</th>
                  <th className="pb-2 font-medium">Submitted On</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingCars.map((car) => (
                  <tr key={car.id} className="border-b border-white/5 last:border-0">
                    <td className="py-3 text-white font-medium">
                      {car.title || `${car.brand ?? ""} ${car.model ?? ""}`.trim() || "Untitled"}
                    </td>
                    <td className="py-3 text-zinc-400">
                      {car.created_at ? new Date(car.created_at).toLocaleDateString("en-IN") : "—"}
                    </td>
                    <td className="py-3">
                      <span className="bg-amber-500/15 text-amber-400 text-xs font-semibold px-2.5 py-1 rounded-full">
                        Draft
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300"><Eye size={14} /></button>
                        <button className="p-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400"><Check size={14} /></button>
                        <button className="p-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-400"><X size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}