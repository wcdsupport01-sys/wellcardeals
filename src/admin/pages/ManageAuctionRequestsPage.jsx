import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { Phone, CheckCircle2, XCircle, Search } from "lucide-react";

const STATUS_STYLES = {
  pending: "bg-amber-500/15 text-amber-400",
  approved: "bg-emerald-500/15 text-emerald-400",
  rejected: "bg-red-500/15 text-red-400",
};

const formatINR = (value) =>
  value == null ? "—" : "₹" + Math.round(Number(value)).toLocaleString("en-IN");

export default function ManageAuctionRequestsPage() {
  const [requests, setRequests] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [filter, setFilter] = useState("pending");
  const [search, setSearch] = useState("");
  // Per-request draft picks (listing_type + agent) before hitting Approve.
  const [drafts, setDrafts] = useState({});

  async function load() {
    setLoading(true);
    setError(null);
    const [{ data, error }, { data: agentRows }] = await Promise.all([
      supabase.from("car_auction_requests").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, full_name, agent_code").eq("role", "agent").eq("status", "approved"),
    ]);
    if (error) setError(error.message);
    else setRequests(data || []);
    setAgents(agentRows || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function setDraft(id, field, value) {
    setDrafts((d) => ({ ...d, [id]: { ...d[id], [field]: value } }));
  }

  async function approveWithAssignment(r) {
    const draft = drafts[r.id] || {};
    const listing_type = draft.listing_type || r.listing_type;
    const assigned_agent_id = draft.assigned_agent_id ?? r.assigned_agent_id;
    if (!listing_type) return alert("Pick Auction or Buy Now before approving.");
    if (!assigned_agent_id) return alert("Assign an agent before approving.");

    setUpdatingId(r.id);
    const { error } = await supabase
      .from("car_auction_requests")
      .update({ status: "approved", listing_type, assigned_agent_id, agent_status: "assigned" })
      .eq("id", r.id);
    setUpdatingId(null);
    if (error) {
      alert(`Couldn't approve: ${error.message}`);
      return;
    }
    setRequests((prev) =>
      prev.map((x) => (x.id === r.id ? { ...x, status: "approved", listing_type, assigned_agent_id, agent_status: "assigned" } : x))
    );
  }

  async function setStatus(id, status) {
    setUpdatingId(id);
    const { error } = await supabase.from("car_auction_requests").update({ status }).eq("id", id);
    setUpdatingId(null);
    if (error) {
      alert(`Couldn't update: ${error.message}`);
      return;
    }
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
  }

  const counts = useMemo(() => {
    const c = { pending: 0, approved: 0, rejected: 0, all: requests.length };
    requests.forEach((r) => {
      if (c[r.status] !== undefined) c[r.status] += 1;
    });
    return c;
  }, [requests]);

  const filtered = useMemo(() => {
    let list = filter === "all" ? requests : requests.filter((r) => r.status === filter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (r) =>
          (r.vehicle_title || "").toLowerCase().includes(q) ||
          (r.buyer_name || "").toLowerCase().includes(q) ||
          (r.buyer_phone || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [requests, filter, search]);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white mb-1">Sell-Your-Car Requests</h1>
      <p className="text-sm text-zinc-400 mb-6">
        Buyers who asked to put their own car up for dealer auction. Approve to move forward and list it via
        <span className="text-zinc-300"> Add Car</span>, or reject with a note.
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
            placeholder="Search car, buyer, phone…"
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-amber-500/50"
          />
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : error ? (
        <p className="text-sm text-red-400">{error}</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-zinc-500">No requests match.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <div
              key={r.id}
              className="flex flex-col md:flex-row md:items-center justify-between gap-3 border border-white/10 rounded-xl p-4 bg-white/[0.02]"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-white truncate">{r.vehicle_title}</p>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_STYLES[r.status] || "bg-zinc-500/15 text-zinc-400"}`}>
                    {r.status}
                  </span>
                </div>
                <p className="text-sm text-zinc-300 mt-1">
                  {r.buyer_name || "Buyer"} · {r.year || "—"} · {r.km_driven ? `${r.km_driven.toLocaleString("en-IN")} km` : "—"} · Wants {formatINR(r.expected_price)}
                </p>
                {r.buyer_phone && (
                  <p className="text-xs text-zinc-500 flex items-center gap-1 mt-1">
                    <Phone size={12} /> {r.buyer_phone}
                  </p>
                )}
                {r.description && <p className="text-xs text-zinc-500 mt-1">{r.description}</p>}
                {r.status === "approved" && (
                  <p className="text-xs text-zinc-500 mt-1">
                    {r.listing_type === "buy_now_only" ? "Buy Now" : "Auction"} · Agent:{" "}
                    {agents.find((a) => a.id === r.assigned_agent_id)?.full_name || "—"} ·{" "}
                    {r.agent_status === "submitted" ? "Uploaded" : "Awaiting upload"}
                  </p>
                )}
                <p className="text-[11px] text-zinc-600 mt-1">{new Date(r.created_at).toLocaleString()}</p>
              </div>

              <div className="flex flex-col gap-2 shrink-0 md:items-end">
                {r.status !== "approved" && r.status !== "rejected" && (
                  <div className="flex flex-wrap gap-2">
                    <select
                      className="text-xs rounded-lg bg-zinc-900 border border-white/10 px-2 py-1.5 text-zinc-200"
                      value={drafts[r.id]?.listing_type || ""}
                      onChange={(e) => setDraft(r.id, "listing_type", e.target.value)}
                    >
                      <option value="" disabled>Auction / Buy Now?</option>
                      <option value="auction">Auction</option>
                      <option value="buy_now_only">Buy Now</option>
                    </select>
                    <select
                      className="text-xs rounded-lg bg-zinc-900 border border-white/10 px-2 py-1.5 text-zinc-200"
                      value={drafts[r.id]?.assigned_agent_id || ""}
                      onChange={(e) => setDraft(r.id, "assigned_agent_id", e.target.value)}
                    >
                      <option value="" disabled>Assign agent...</option>
                      {agents.map((a) => (
                        <option key={a.id} value={a.id}>{a.full_name} ({a.agent_code})</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="flex gap-2">
                {r.status !== "approved" && (
                  <button
                    disabled={updatingId === r.id}
                    onClick={() => approveWithAssignment(r)}
                    className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"
                  >
                    <CheckCircle2 size={13} /> Approve &amp; Assign
                  </button>
                )}
                {r.status !== "rejected" && (
                  <button
                    disabled={updatingId === r.id}
                    onClick={() => setStatus(r.id, "rejected")}
                    className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25"
                  >
                    <XCircle size={13} /> Reject
                  </button>
                )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}