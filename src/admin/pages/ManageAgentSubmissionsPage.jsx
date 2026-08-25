import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../auth/AuthContext";
import { CheckCircle2, XCircle, Phone, MapPin, User2, Search, Image as ImageIcon } from "lucide-react";

// Team Lead / Manager / Admin review queue for cars that field agents have
// submitted via AgentAddCarPage.jsx. Approving here publishes the car live
// on the site by setting status: "live" (see STATUS_OPTIONS in
// src/admin/lib/lookups.js) together with access_type: "all" and
// listing_type: "buy_now_only" — exactly what fetchAuctionCars() in
// carsApi.js requires for a buyer to see it, with no separate publish step.
const STATUS_STYLES = {
  pending: "bg-amber-500/15 text-amber-400",
  approved: "bg-emerald-500/15 text-emerald-400",
  rejected: "bg-red-500/15 text-red-400",
};

const formatINR = (v) => (v == null ? "—" : "₹" + Math.round(Number(v)).toLocaleString("en-IN"));

export default function ManageAgentSubmissionsPage() {
  const { user } = useAuth();
  const [cars, setCars] = useState([]);
  const [agentsMap, setAgentsMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("pending");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  async function load() {
    setLoading(true);
    setError(null);
    // Joins brand/model names in the same style as fetchAuctionCars()
    // (which joins fuel_types/transmissions) — brand_id/model_id are
    // foreign keys, not plain text, so the name has to come from the join.
    const { data, error } = await supabase
      .from("cars")
      .select("*, brands(name), models(name), fuel_types(name)")
      .not("submitted_by_agent_id", "is", null)
      .order("created_at", { ascending: false });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    setCars(data || []);

    const agentIds = Array.from(new Set((data || []).map((c) => c.submitted_by_agent_id).filter(Boolean)));
    if (agentIds.length > 0) {
      const { data: agentRows } = await supabase
        .from("profiles")
        .select("id, full_name, agent_code")
        .in("id", agentIds);
      const map = {};
      (agentRows || []).forEach((a) => (map[a.id] = a));
      setAgentsMap(map);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function approve(car) {
    setBusyId(car.id);
    const { error } = await supabase
      .from("cars")
      .update({
        tl_review_status: "approved",
        status: "live",
        visibility: "visible",
        access_type: "all",
        tl_reviewed_by: user.id,
        tl_reviewed_at: new Date().toISOString(),
      })
      .eq("id", car.id);
    setBusyId(null);
    if (error) {
      alert(`Couldn't approve: ${error.message}`);
      return;
    }
    setCars((prev) =>
      prev.map((c) =>
        c.id === car.id
          ? { ...c, tl_review_status: "approved", status: "live", visibility: "visible", access_type: "all" }
          : c
      )
    );
  }

  async function reject(car) {
    if (!rejectReason.trim()) {
      alert("Add a short reason so the agent knows what to fix.");
      return;
    }
    setBusyId(car.id);
    const { error } = await supabase
      .from("cars")
      .update({
        tl_review_status: "rejected",
        tl_reviewed_by: user.id,
        tl_reviewed_at: new Date().toISOString(),
        tl_rejection_reason: rejectReason.trim(),
      })
      .eq("id", car.id);
    setBusyId(null);
    if (error) {
      alert(`Couldn't reject: ${error.message}`);
      return;
    }
    setCars((prev) =>
      prev.map((c) =>
        c.id === car.id ? { ...c, tl_review_status: "rejected", tl_rejection_reason: rejectReason.trim() } : c
      )
    );
    setRejectingId(null);
    setRejectReason("");
  }

  const counts = useMemo(() => {
    const c = { pending: 0, approved: 0, rejected: 0, all: cars.length };
    cars.forEach((car) => {
      if (c[car.tl_review_status] !== undefined) c[car.tl_review_status] += 1;
    });
    return c;
  }, [cars]);

  const filtered = useMemo(() => {
    let list = filter === "all" ? cars : cars.filter((c) => c.tl_review_status === filter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (c) =>
          (c.vehicle_title || "").toLowerCase().includes(q) ||
          (c.seller_name || "").toLowerCase().includes(q) ||
          (c.seller_phone || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [cars, filter, search]);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white mb-1">Agent Submissions</h1>
      <p className="text-sm text-zinc-400 mb-6">
        Cars your field agents added from the seller's location. Approve to publish it live on the
        site immediately, or reject with a note so the agent can fix and resubmit.
      </p>

      <div className="flex flex-col sm:flex-row gap-3 mb-5 sm:items-center sm:justify-between">
        <div className="flex gap-2 flex-wrap">
          {["pending", "approved", "rejected", "all"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition flex items-center gap-1.5 ${
                filter === f ? "bg-amber-500/15 text-amber-400" : "text-zinc-400 hover:bg-white/5"
              }`}
            >
              {f}
              <span className="text-[10px] opacity-70">({counts[f] ?? 0})</span>
            </button>
          ))}
        </div>
        <div className="relative sm:w-64">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search car, seller, phone…"
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-amber-500/50"
          />
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : error ? (
        <p className="text-sm text-red-400">{error}</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-zinc-500">No submissions match.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((car) => {
            const agent = agentsMap[car.submitted_by_agent_id];
            return (
              <div key={car.id} className="border border-white/10 rounded-xl p-4 bg-white/[0.02]">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                  <div className="flex gap-3 min-w-0">
                    {car.thumbnail_url ? (
                      <img src={car.thumbnail_url} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0 bg-zinc-800" />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-zinc-800 shrink-0 flex items-center justify-center text-zinc-600">
                        <ImageIcon size={18} />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-white truncate">{car.vehicle_title}</p>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_STYLES[car.tl_review_status] || "bg-zinc-500/15 text-zinc-400"}`}>
                          {car.tl_review_status}
                        </span>
                      </div>
                      <p className="text-sm text-zinc-300 mt-1">
                        {car.brands?.name || "—"} {car.models?.name || ""} · {car.year || "—"} ·{" "}
                        {car.mileage_km ? `${Number(car.mileage_km).toLocaleString("en-IN")} km` : "—"} ·{" "}
                        {car.fuel_types?.name || "—"} · {formatINR(car.buy_now_price)}
                      </p>
                      <p className="text-xs text-zinc-500 flex items-center gap-1 mt-1">
                        <User2 size={12} /> Agent: {agent?.full_name || "—"} {agent?.agent_code ? `(${agent.agent_code})` : ""}
                      </p>
                      {car.seller_name && (
                        <p className="text-xs text-zinc-500 mt-0.5">Seller: {car.seller_name}</p>
                      )}
                      {car.seller_phone && (
                        <p className="text-xs text-zinc-500 flex items-center gap-1 mt-0.5">
                          <Phone size={12} /> {car.seller_phone}
                        </p>
                      )}
                      {car.location && (
                        <p className="text-xs text-zinc-500 flex items-center gap-1 mt-0.5">
                          <MapPin size={12} /> {car.location}
                        </p>
                      )}
                      {car.seller_notes && <p className="text-xs text-zinc-500 mt-1">Note: {car.seller_notes}</p>}
                      {car.tl_review_status === "rejected" && car.tl_rejection_reason && (
                        <p className="text-xs text-red-400 mt-1">Rejected: {car.tl_rejection_reason}</p>
                      )}
                      <p className="text-[11px] text-zinc-600 mt-1">{new Date(car.created_at).toLocaleString()}</p>
                    </div>
                  </div>

                  {car.tl_review_status === "pending" && (
                    <div className="flex flex-col gap-2 shrink-0 md:items-end">
                      <div className="flex gap-2">
                        <button
                          disabled={busyId === car.id}
                          onClick={() => approve(car)}
                          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"
                        >
                          <CheckCircle2 size={13} /> Approve &amp; Publish
                        </button>
                        <button
                          disabled={busyId === car.id}
                          onClick={() => setRejectingId(rejectingId === car.id ? null : car.id)}
                          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25"
                        >
                          <XCircle size={13} /> Reject
                        </button>
                      </div>
                      {rejectingId === car.id && (
                        <div className="flex gap-2 w-full md:w-64">
                          <input
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Reason for rejection…"
                            className="flex-1 text-xs rounded-lg bg-zinc-900 border border-white/10 px-2 py-1.5 text-zinc-200"
                          />
                          <button
                            disabled={busyId === car.id}
                            onClick={() => reject(car)}
                            className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white"
                          >
                            Confirm
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}