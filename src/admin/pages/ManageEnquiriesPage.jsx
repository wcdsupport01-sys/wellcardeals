import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { Mail, Phone, MessageSquare, CheckCircle2, Clock, Search, Trash2 } from "lucide-react";

const STATUS_STYLES = {
  new: "bg-amber-500/15 text-amber-400",
  contacted: "bg-blue-500/15 text-blue-400",
  resolved: "bg-emerald-500/15 text-emerald-400",
};

export default function ManageEnquiriesPage() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [filter, setFilter] = useState("new");
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("contact_messages")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) setError(error.message);
    else setMessages(data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function setStatus(id, status) {
    setUpdatingId(id);
    const { error } = await supabase.from("contact_messages").update({ status }).eq("id", id);
    setUpdatingId(null);
    if (error) {
      alert(`Couldn't update: ${error.message}`);
      return;
    }
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, status } : m)));
  }

  async function remove(id) {
    if (!window.confirm("Delete this enquiry?")) return;
    setUpdatingId(id);
    const { error } = await supabase.from("contact_messages").delete().eq("id", id);
    setUpdatingId(null);
    if (error) {
      alert(`Couldn't delete: ${error.message}`);
      return;
    }
    setMessages((prev) => prev.filter((m) => m.id !== id));
  }

  const counts = useMemo(() => {
    const c = { new: 0, contacted: 0, resolved: 0, all: messages.length };
    messages.forEach((m) => {
      if (c[m.status] !== undefined) c[m.status] += 1;
    });
    return c;
  }, [messages]);

  const filtered = useMemo(() => {
    let list = filter === "all" ? messages : messages.filter((m) => m.status === filter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (m) =>
          (m.name || "").toLowerCase().includes(q) ||
          (m.email || "").toLowerCase().includes(q) ||
          (m.phone || "").toLowerCase().includes(q) ||
          (m.message || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [messages, filter, search]);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white mb-1">Enquiries</h1>
      <p className="text-sm text-zinc-400 mb-6">
        Messages submitted from the website's Contact page "Send a Message" form.
      </p>

      <div className="flex flex-col sm:flex-row gap-3 mb-5 sm:items-center sm:justify-between">
        <div className="flex gap-2 flex-wrap">
          {["new", "contacted", "resolved", "all"].map((f) => (
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
            placeholder="Search name, email, message…"
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-amber-500/50"
          />
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : error ? (
        <p className="text-sm text-red-400">{error}</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-zinc-500">No enquiries match.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((m) => (
            <div
              key={m.id}
              className="flex flex-col md:flex-row md:items-start justify-between gap-3 border border-white/10 rounded-xl p-4 bg-white/[0.02]"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-white truncate">{m.name || "Visitor"}</p>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_STYLES[m.status] || "bg-zinc-500/15 text-zinc-400"}`}>
                    {m.status}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 flex items-center gap-1 mt-1">
                  <Mail size={12} /> {m.email}
                </p>
                {m.phone && (
                  <p className="text-xs text-zinc-500 flex items-center gap-1 mt-1">
                    <Phone size={12} /> {m.phone}
                  </p>
                )}
                <p className="text-sm text-zinc-300 flex items-start gap-1.5 mt-2">
                  <MessageSquare size={13} className="mt-0.5 shrink-0 text-zinc-500" /> {m.message}
                </p>
                <p className="text-[11px] text-zinc-600 mt-2">{new Date(m.created_at).toLocaleString()}</p>
              </div>

              <div className="flex gap-2 shrink-0">
                {m.status !== "contacted" && (
                  <button
                    disabled={updatingId === m.id}
                    onClick={() => setStatus(m.id, "contacted")}
                    className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-blue-500/15 text-blue-400 hover:bg-blue-500/25"
                  >
                    <Clock size={13} /> Mark Contacted
                  </button>
                )}
                {m.status !== "resolved" && (
                  <button
                    disabled={updatingId === m.id}
                    onClick={() => setStatus(m.id, "resolved")}
                    className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"
                  >
                    <CheckCircle2 size={13} /> Mark Resolved
                  </button>
                )}
                <button
                  disabled={updatingId === m.id}
                  onClick={() => remove(m.id)}
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
