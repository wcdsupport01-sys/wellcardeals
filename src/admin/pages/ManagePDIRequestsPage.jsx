import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { Phone, Car, MessageSquare, MapPin, CheckCircle2, Clock, CalendarClock, XCircle, Search, Trash2 } from "lucide-react";

const STATUS_STYLES = {
  pending: "bg-amber-500/15 text-amber-400",
  scheduled: "bg-blue-500/15 text-blue-400",
  completed: "bg-emerald-500/15 text-emerald-400",
  cancelled: "bg-zinc-500/15 text-zinc-400",
};

export default function ManagePDIRequestsPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [filter, setFilter] = useState("pending");
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("pdi_requests")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) setError(error.message);
    else setRequests(data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function setStatus(id, status) {
    setUpdatingId(id);
    const { error } = await supabase.from("pdi_requests").update({ status }).eq("id", id);
    setUpdatingId(null);
    if (error) {
      alert(`Couldn't update: ${error.message}`);
      return;
    }
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
  }

  async function remove(id) {
    if (!window.confirm("Delete this PDI request?")) return;
    setUpdatingId(id);
    const { error } = await supabase.from("pdi_requests").delete().eq("id", id);
    setUpdatingId(null);
    if (error) {
      alert(`Couldn't delete: ${error.message}`);
      return;
    }
    setRequests((prev) => prev.filter((r) => r.id !== id));
  }

  const counts = useMemo(() => {
    const c = { pending: 0, scheduled: 0, completed: 0, cancelled: 0, all: requests.length };
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
          (r.name || "").toLowerCase().includes(q) ||
          (r.phone || "").toLowerCase().includes(q) ||
          (r.car_details || "").toLowerCase().includes(q) ||
          (r.location || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [requests, filter, search]);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white mb-1">PDI Requests</h1>
      <p className="text-sm text-zinc-400 mb-6">
        Pre-Delivery Inspection requests submitted from the website's "Request PDI" form.
      </p>

      <div className="flex flex-col sm:flex-row gap-3 mb-5 sm:items-center sm:justify-between">
        <div className="flex gap-2 flex-wrap">
          {["pending", "scheduled", "completed", "cancelled", "all"].map((f) => (
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
            placeholder="Search name, phone, car…"
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-amber-500/50"
          />
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : error ? (
        <p className="text-sm text-red-400">{error}</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-zinc-500">No PDI requests match.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <div
              key={r.id}
              className="flex flex-col md:flex-row md:items-start justify-between gap-3 border border-white/10 rounded-xl p-4 bg-white/[0.02]"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-white truncate">{r.name}</p>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_STYLES[r.status] || "bg-zinc-500/15 text-zinc-400"}`}>
                    {r.status}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 flex items-center gap-1 mt-1">
                  <Phone size={12} /> {r.phone}
                </p>
                <p className="text-sm text-zinc-300 flex items-start gap-1.5 mt-2">
                  <Car size={13} className="mt-0.5 shrink-0 text-zinc-500" /> {r.car_details}
                </p>
                {r.location && (
                  <p className="text-xs text-zinc-500 flex items-center gap-1 mt-1">
                    <MapPin size={12} /> {r.location}
                  </p>
                )}
                {r.message && (
                  <p className="text-sm text-zinc-400 flex items-start gap-1.5 mt-1.5">
                    <MessageSquare size={13} className="mt-0.5 shrink-0 text-zinc-500" /> {r.message}
                  </p>
                )}
                <p className="text-[11px] text-zinc-600 mt-2">{new Date(r.created_at).toLocaleString()}</p>
              </div>

              <div className="flex gap-2 shrink-0 flex-wrap">
                {r.status !== "scheduled" && (
                  <button
                    disabled={updatingId === r.id}
                    onClick={() => setStatus(r.id, "scheduled")}
                    className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-blue-500/15 text-blue-400 hover:bg-blue-500/25"
                  >
                    <CalendarClock size={13} /> Schedule
                  </button>
                )}
                {r.status !== "completed" && (
                  <button
                    disabled={updatingId === r.id}
                    onClick={() => setStatus(r.id, "completed")}
                    className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"
                  >
                    <CheckCircle2 size={13} /> Completed
                  </button>
                )}
                {r.status !== "cancelled" && (
                  <button
                    disabled={updatingId === r.id}
                    onClick={() => setStatus(r.id, "cancelled")}
                    className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-zinc-500/15 text-zinc-400 hover:bg-zinc-500/25"
                  >
                    <XCircle size={13} /> Cancel
                  </button>
                )}
                <button
                  disabled={updatingId === r.id}
                  onClick={() => remove(r.id)}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-zinc-500/15 text-zinc-400 hover:bg-red-500/20 hover:text-red-400"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
