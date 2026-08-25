import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { CheckCircle2, XCircle, Clock, ShieldBan, Copy, RefreshCw, ShieldCheck, Eye, KeyRound, X, Search } from "lucide-react";
import { approveDealerManualCode, regenerateDealerManualCode, resetDealerPassword } from "../../auth/authApi";
import { useAuth } from "../../auth/AuthContext";

const STATUS_STYLES = {
  pending: "bg-amber-500/15 text-amber-400",
  approved: "bg-emerald-500/15 text-emerald-400",
  rejected: "bg-red-500/15 text-red-400",
  suspended: "bg-zinc-500/15 text-zinc-400",
};

export default function ManageDealersPage() {
  const { role } = useAuth();
  // Team Lead now has the same full edit access as Manager — this page no
  // longer treats team_lead as read-only.
  const readOnly = false;
  const [dealers, setDealers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [sendingId, setSendingId] = useState(null);
  const [notice, setNotice] = useState(null); // { id, text }
  const [visibleCodes, setVisibleCodes] = useState({}); // { [dealerId]: code } — shown after generating, for manual send
  const [filter, setFilter] = useState("pending");
  const [search, setSearch] = useState("");
  const [resettingId, setResettingId] = useState(null);
  const [newCredential, setNewCredential] = useState(null); // { dealer, password } — shown in a modal right after a reset

  async function load() {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("role", "dealer")
      .order("created_at", { ascending: false });
    if (error) setError(error.message);
    else setDealers(data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function setStatus(id, status) {
    setUpdatingId(id);
    const { error } = await supabase.from("profiles").update({ status }).eq("id", id);
    setUpdatingId(null);
    if (error) {
      alert(`Couldn't update: ${error.message}`);
      return;
    }
    setDealers((prev) => prev.map((d) => (d.id === id ? { ...d, status } : d)));
  }

  // Approve + generate the access code. Nothing is sent automatically yet
  // (Twilio/WhatsApp aren't wired up) — the code is shown below so the
  // admin can copy it and send it manually over WhatsApp/SMS themself.
  async function approveWithCode(id) {
    setSendingId(id);
    setNotice(null);
    try {
      const code = await approveDealerManualCode(id);
      setDealers((prev) =>
        prev.map((d) => (d.id === id ? { ...d, status: "approved", dealer_access_code_verified: false } : d))
      );
      setVisibleCodes((prev) => ({ ...prev, [id]: code }));
      setNotice({ id, text: "Approved — code generated below. Copy it and send it yourself." });
    } catch (err) {
      setNotice({ id, text: err.message || "Something went wrong.", isError: true });
    } finally {
      setSendingId(null);
    }
  }

  async function regenerateCode(id) {
    setSendingId(id);
    setNotice(null);
    try {
      const code = await regenerateDealerManualCode(id);
      setDealers((prev) =>
        prev.map((d) => (d.id === id ? { ...d, dealer_access_code_verified: false } : d))
      );
      setVisibleCodes((prev) => ({ ...prev, [id]: code }));
      setNotice({ id, text: "New code generated below." });
    } catch (err) {
      setNotice({ id, text: err.message || "Something went wrong.", isError: true });
    } finally {
      setSendingId(null);
    }
  }

  async function copyCode(code) {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      // clipboard API unavailable — code is still visible to copy by hand
    }
  }

  // Dealers can't set/change their own password — if one gets locked out
  // or mixes up their credentials, an admin or manager issues them a
  // brand new one here instead. The password is shown exactly once in the
  // modal below; it's never stored anywhere after that.
  async function handleResetPassword(dealer) {
    if (
      !window.confirm(
        `Issue ${dealer.business_name || dealer.full_name || "this dealer"} a brand new password? Their old password will stop working immediately.`
      )
    ) {
      return;
    }
    setResettingId(dealer.id);
    setNotice(null);
    try {
      const result = await resetDealerPassword(dealer.id);
      setNewCredential({ dealer, password: result.password });
    } catch (err) {
      setNotice({ id: dealer.id, text: err.message || "Couldn't reset password.", isError: true });
    } finally {
      setResettingId(null);
    }
  }

  async function copyPassword(password) {
    try {
      await navigator.clipboard.writeText(password);
    } catch {
      // clipboard API unavailable — password is still visible to copy by hand
    }
  }

  const counts = useMemo(() => {
    const c = { pending: 0, approved: 0, rejected: 0, suspended: 0, all: dealers.length };
    dealers.forEach((d) => {
      if (c[d.status] !== undefined) c[d.status] += 1;
    });
    return c;
  }, [dealers]);

  const filtered = useMemo(() => {
    let list = filter === "all" ? dealers : dealers.filter((d) => d.status === filter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (d) =>
          (d.business_name || "").toLowerCase().includes(q) ||
          (d.full_name || "").toLowerCase().includes(q) ||
          (d.email || "").toLowerCase().includes(q) ||
          (d.phone || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [dealers, filter, search]);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white mb-1">Manage Dealers</h1>
      <p className="text-sm text-zinc-400 mb-6">
        {readOnly
          ? "Read-only view of dealer sign-ups and their approval status."
          : "Approve or reject dealer sign-ups. Only approved dealers can see dealer pricing and dealer-only inventory."}
      </p>

      <div className="flex flex-col sm:flex-row gap-3 mb-5 sm:items-center sm:justify-between">
        <div className="flex gap-2 flex-wrap">
          {["pending", "approved", "rejected", "suspended", "all"].map((f) => (
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
            placeholder="Search name, email, phone…"
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-amber-500/50"
          />
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : error ? (
        <p className="text-sm text-red-400">{error}</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-zinc-500">No dealers match.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((d) => (
            <div
              key={d.id}
              className="flex flex-col md:flex-row md:items-center justify-between gap-3 border border-white/10 rounded-xl p-4 bg-white/[0.02]"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-white truncate">
                    {d.business_name || d.full_name || "Unnamed dealer"}
                  </p>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_STYLES[d.status] || "bg-zinc-500/15 text-zinc-400"}`}>
                    {d.status}
                  </span>
                </div>
                <p className="text-sm text-zinc-400 mt-0.5">{d.email}</p>
                {d.phone && <p className="text-xs text-zinc-500 mt-0.5">{d.phone}</p>}
                <p className="text-xs text-zinc-600 mt-1">
                  Applied {d.created_at ? new Date(d.created_at).toLocaleDateString("en-IN") : "—"}
                </p>
                {d.license_url && (
                  <a
                    href={d.license_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-amber-400 underline underline-offset-2 mt-1 inline-block"
                  >
                    View license document
                  </a>
                )}
                {d.status === "approved" && (
                  <p className={`text-xs mt-1 flex items-center gap-1 ${d.dealer_access_code_verified ? "text-emerald-400" : "text-amber-400"}`}>
                    <ShieldCheck size={12} />
                    {d.dealer_access_code_verified
                      ? "Access code verified — can join live auctions"
                      : "Waiting for dealer to enter the code"}
                  </p>
                )}
                {visibleCodes[d.id] && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-sm font-mono tracking-[0.3em] bg-amber-500/10 text-amber-300 px-3 py-1.5 rounded-lg">
                      {visibleCodes[d.id]}
                    </span>
                    <button
                      onClick={() => copyCode(visibleCodes[d.id])}
                      className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white"
                      title="Copy code"
                    >
                      <Copy size={13} /> Copy
                    </button>
                  </div>
                )}
                {notice?.id === d.id && (
                  <p className={`text-xs mt-1 ${notice.isError ? "text-red-400" : "text-emerald-400"}`}>{notice.text}</p>
                )}
              </div>

              {readOnly ? (
                <div className="flex items-center gap-1.5 text-xs text-zinc-500 shrink-0">
                  <Eye size={13} /> View only
                </div>
              ) : (
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  {d.status !== "approved" && (
                    <button
                      disabled={updatingId === d.id || sendingId === d.id}
                      onClick={() => approveWithCode(d.id)}
                      className="flex items-center gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-3 py-2 rounded-lg transition"
                    >
                      <CheckCircle2 size={14} /> {sendingId === d.id ? "Generating…" : "Approve & Generate Code"}
                    </button>
                  )}
                  {d.status === "approved" && (
                    <button
                      disabled={sendingId === d.id}
                      onClick={() => regenerateCode(d.id)}
                      className="flex items-center gap-1.5 text-xs font-semibold border border-amber-400/30 text-amber-400 hover:bg-amber-500/10 disabled:opacity-50 px-3 py-2 rounded-lg transition"
                    >
                      <RefreshCw size={14} /> {sendingId === d.id ? "Generating…" : "New Code"}
                    </button>
                  )}
                  {d.status === "approved" && (
                    <button
                      disabled={resettingId === d.id}
                      onClick={() => handleResetPassword(d)}
                      className="flex items-center gap-1.5 text-xs font-semibold border border-blue-400/30 text-blue-400 hover:bg-blue-500/10 disabled:opacity-50 px-3 py-2 rounded-lg transition"
                    >
                      <KeyRound size={14} /> {resettingId === d.id ? "Resetting…" : "Reset Password"}
                    </button>
                  )}
                  {d.status !== "rejected" && (
                    <button
                      disabled={updatingId === d.id}
                      onClick={() => setStatus(d.id, "rejected")}
                      className="flex items-center gap-1.5 text-xs font-semibold bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white px-3 py-2 rounded-lg transition"
                    >
                      <XCircle size={14} /> Reject
                    </button>
                  )}
                  {d.status === "approved" && (
                    <button
                      disabled={updatingId === d.id}
                      onClick={() => setStatus(d.id, "suspended")}
                      className="flex items-center gap-1.5 text-xs font-semibold border border-white/10 hover:bg-white/5 disabled:opacity-50 text-zinc-300 px-3 py-2 rounded-lg transition"
                    >
                      <ShieldBan size={14} /> Suspend
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {newCredential && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          onClick={() => setNewCredential(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-blue-500/20 bg-[#0B1120] p-6 relative"
          >
            <button
              onClick={() => setNewCredential(null)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-white transition"
              aria-label="Close"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2 mb-1">
              <KeyRound size={18} className="text-blue-400" />
              <h2 className="text-lg font-semibold text-white">New Password Issued</h2>
            </div>
            <p className="text-sm text-zinc-400 mb-5">
              {newCredential.dealer.business_name || newCredential.dealer.full_name} — their old
              password no longer works. Share this with them yourself; it won't be shown again.
            </p>

            <div>
              <p className="text-xs text-zinc-500 mb-1">New Password</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm font-mono bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-blue-400">
                  {newCredential.password}
                </code>
                <button
                  onClick={() => copyPassword(newCredential.password)}
                  className="text-xs font-semibold border border-white/10 hover:bg-white/5 text-zinc-300 px-3 py-2 rounded-lg transition"
                >
                  Copy
                </button>
              </div>
            </div>

            <p className="text-[11px] text-zinc-500 text-center mt-5">
              Only admins and managers can issue dealer passwords — dealers can't set their own.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}