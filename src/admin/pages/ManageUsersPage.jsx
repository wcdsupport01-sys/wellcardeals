import { useEffect, useMemo, useState } from "react";
import { UserPlus, Loader2, AlertCircle, Copy, Check, ShieldBan, XCircle, RotateCcw, Search, KeyRound, X } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../auth/AuthContext";
import { inputClass } from "../components/FormSection";
import { resetUserPassword } from "../../auth/authApi";

// Manage Users is for internal company staff only — the people who run the
// backend (admin/manager/team_lead) plus field agents. Dealers and buyers
// are customers, not staff: dealers are handled on the separate
// "Manage Dealers" page, and buyers don't get an admin-managed account here.
const ALL_ROLES = ["admin", "manager", "team_lead", "agent"];
const STAFF_ROLES = ["admin", "manager", "team_lead"]; // creatable via the "New Staff Account" form on this page
const CHANGEABLE_ROLES = ["admin", "manager", "team_lead", "agent"]; // roles this page can reassign between

const STATUS_STYLES = {
  approved: "bg-emerald-500/15 text-emerald-400",
  pending: "bg-amber-500/15 text-amber-400",
  rejected: "bg-red-500/15 text-red-400",
  suspended: "bg-zinc-500/15 text-zinc-400",
};

const ROLE_STYLES = {
  admin: "bg-amber-500/15 text-amber-400",
  manager: "bg-blue-500/15 text-blue-400",
  team_lead: "bg-violet-500/15 text-violet-400",
  agent: "bg-cyan-500/15 text-cyan-400",
};

function CopyRow({ label, value }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-zinc-900/70 border border-white/10 px-4 py-3">
      <div className="min-w-0">
        <p className="text-xs text-zinc-500">{label}</p>
        <p className="text-sm font-mono font-semibold text-white tracking-wide truncate">{value}</p>
      </div>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="shrink-0 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/5 flex items-center gap-1.5"
      >
        {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

export default function ManageUsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [busyId, setBusyId] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [newRole, setNewRole] = useState("manager");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [credentials, setCredentials] = useState(null);

  // Password reset — works for ANY account (admin, manager, team lead,
  // dealer, buyer). New password is shown exactly once in a modal, right
  // after generation, and is never stored or shown again after that.
  const [resettingId, setResettingId] = useState(null);
  const [resetNotice, setResetNotice] = useState(null); // { id, text, isError }
  const [newCredential, setNewCredential] = useState(null); // { user, password }

  async function load() {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .in("role", ALL_ROLES) // staff only — dealers/buyers never show up here
      .order("created_at", { ascending: false });
    if (error) setError(error.message);
    else setUsers(data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setCreateError("");
    if (!fullName.trim() || !email.trim()) {
      setCreateError("Name and email are required.");
      return;
    }
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-staff-user", {
        body: {
          fullName: fullName.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          role: newRole,
          password: password.trim() || undefined,
        },
      });
      if (error || data?.error) throw new Error(data?.error || error.message);
      setCredentials(data);
      setFullName("");
      setEmail("");
      setPhone("");
      setPassword("");
      await load();
    } catch (err) {
      setCreateError(err.message || "Couldn't create the account.");
    } finally {
      setCreating(false);
    }
  }

  // Change role for anyone — ADMIN "Owner" power. Direct table write relies
  // on the "profiles: admins update all" RLS policy (auth_schema.sql) +
  // prevent_self_privilege_escalation trigger, both of which only let a
  // caller whose OWN role is 'admin' touch the role/status columns of
  // another row — see rbac_manager_teamlead_migration.sql.
  async function changeRole(id, role) {
    setBusyId(id);
    const { error } = await supabase.from("profiles").update({ role }).eq("id", id);
    setBusyId(null);
    if (error) {
      alert(`Couldn't change role: ${error.message}`);
      return;
    }
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, role } : u)));
  }

  async function setStatus(id, status) {
    setBusyId(id);
    const { error } = await supabase.from("profiles").update({ status }).eq("id", id);
    setBusyId(null);
    if (error) {
      alert(`Couldn't update: ${error.message}`);
      return;
    }
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, status } : u)));
  }

  async function handleResetPassword(user) {
    if (
      !window.confirm(
        `Issue ${user.full_name || user.email} a brand new password? Their old password will stop working immediately.`
      )
    ) {
      return;
    }
    setResettingId(user.id);
    setResetNotice(null);
    try {
      const result = await resetUserPassword(user.id);
      setNewCredential({ user, password: result.password });
    } catch (err) {
      setResetNotice({ id: user.id, text: err.message || "Couldn't reset password.", isError: true });
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

  const roleCounts = useMemo(() => {
    const c = { all: users.length };
    ALL_ROLES.forEach((r) => (c[r] = 0));
    users.forEach((u) => {
      if (c[u.role] !== undefined) c[u.role] += 1;
    });
    return c;
  }, [users]);

  const filtered = useMemo(() => {
    let list = users;
    if (roleFilter !== "all") list = list.filter((u) => u.role === roleFilter);
    if (statusFilter !== "all") list = list.filter((u) => u.status === statusFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (u) => (u.full_name || "").toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [users, roleFilter, statusFilter, search]);

  return (
    <div>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-1">
        <h1 className="text-2xl font-semibold text-white">Manage Users</h1>
        <button
          onClick={() => {
            setShowForm((v) => !v);
            setCredentials(null);
            setCreateError("");
          }}
          className="flex items-center gap-1.5 text-sm font-semibold bg-amber-500 hover:bg-amber-400 text-black px-3.5 py-2 rounded-xl transition"
        >
          <UserPlus size={16} /> New Staff Account
        </button>
      </div>
      <p className="text-sm text-zinc-400 mb-6">
        Add, edit, suspend/ban, reset the password, or change the role of anyone on your team — admins, managers,
        team leads, and agents. Dealers are managed separately on the "Manage Dealers" page.
      </p>

      {showForm && (
        <div className="mb-6 border border-white/10 rounded-2xl p-5 bg-white/[0.02]">
          {!credentials ? (
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input placeholder="Full name" className={inputClass} value={fullName} onChange={(e) => setFullName(e.target.value)} />
                <input type="email" placeholder="Email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} />
                <input placeholder="Phone (optional)" className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} />
                <select className={inputClass} value={newRole} onChange={(e) => setNewRole(e.target.value)}>
                  {STAFF_ROLES.map((r) => (
                    <option key={r} value={r} className="bg-zinc-900">
                      {r === "team_lead" ? "Team Lead" : r[0].toUpperCase() + r.slice(1)}
                    </option>
                  ))}
                </select>
                <input
                  placeholder="Password (optional — auto-generated if blank)"
                  className={`${inputClass} sm:col-span-2`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {createError && (
                <p className="text-sm text-red-400 flex items-center gap-2">
                  <AlertCircle size={14} /> {createError}
                </p>
              )}
              <button
                type="submit"
                disabled={creating}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2.5 rounded-xl"
              >
                {creating && <Loader2 size={16} className="animate-spin" />} Create Account
              </button>
            </form>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-emerald-400 flex items-center gap-2">
                <Check size={15} /> Account created — copy these credentials now, they won't be shown again.
              </p>
              <CopyRow label="Email" value={credentials.email} />
              <CopyRow label="Password" value={credentials.password} />
              <button onClick={() => setShowForm(false)} className="text-xs text-zinc-400 hover:text-white underline underline-offset-2">
                Done
              </button>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mb-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-blue-500/50"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {["all", "approved", "pending", "rejected", "suspended"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition ${
                statusFilter === s ? "bg-blue-500/15 text-blue-400" : "text-zinc-400 hover:bg-white/5"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 flex-wrap mb-5">
        {["all", ...ALL_ROLES].map((r) => (
          <button
            key={r}
            onClick={() => setRoleFilter(r)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition flex items-center gap-1.5 ${
              roleFilter === r ? "bg-amber-500/15 text-amber-400" : "text-zinc-400 hover:bg-white/5"
            }`}
          >
            {r === "team_lead" ? "Team Lead" : r}
            <span className="text-[10px] opacity-70">({roleCounts[r] ?? 0})</span>
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : error ? (
        <p className="text-sm text-red-400">{error}</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-zinc-500">No users match.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((u) => {
            const isSelf = u.id === currentUser?.id;
            return (
              <div key={u.id} className="flex flex-col md:flex-row md:items-center justify-between gap-3 border border-white/10 rounded-xl p-4 bg-white/[0.02]">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-white truncate">{u.full_name || "Unnamed"}</p>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize ${ROLE_STYLES[u.role] || "bg-zinc-500/15 text-zinc-400"}`}>
                      {u.role === "team_lead" ? "Team Lead" : u.role}
                    </span>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_STYLES[u.status] || "bg-zinc-500/15 text-zinc-400"}`}>
                      {u.status}
                    </span>
                    {isSelf && <span className="text-[11px] text-zinc-500">(you)</span>}
                  </div>
                  <p className="text-sm text-zinc-400 mt-0.5">{u.email}</p>
                  {resetNotice?.id === u.id && (
                    <p className={`text-xs mt-1 ${resetNotice.isError ? "text-red-400" : "text-emerald-400"}`}>{resetNotice.text}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <select
                    disabled={isSelf || busyId === u.id || !CHANGEABLE_ROLES.includes(u.role)}
                    value={u.role}
                    onChange={(e) => changeRole(u.id, e.target.value)}
                    title={isSelf ? "You can't change your own role" : "Change role"}
                    className="text-xs bg-white/5 border border-white/10 rounded-lg px-2.5 py-2 text-zinc-200 disabled:opacity-50"
                  >
                    {CHANGEABLE_ROLES.includes(u.role) ? (
                      CHANGEABLE_ROLES.map((r) => (
                        <option key={r} value={r} className="bg-zinc-900">
                          {r === "team_lead" ? "Team Lead" : r[0].toUpperCase() + r.slice(1)}
                        </option>
                      ))
                    ) : (
                      <option value={u.role} className="bg-zinc-900">
                        {u.role}
                      </option>
                    )}
                  </select>

                  <button
                    disabled={resettingId === u.id}
                    onClick={() => handleResetPassword(u)}
                    title="Issue a new password for this account"
                    className="flex items-center gap-1.5 text-xs font-semibold border border-blue-400/30 text-blue-400 hover:bg-blue-500/10 disabled:opacity-50 px-3 py-2 rounded-lg transition"
                  >
                    <KeyRound size={14} /> {resettingId === u.id ? "Resetting…" : "Reset Password"}
                  </button>

                  {u.status !== "suspended" ? (
                    <button
                      disabled={isSelf || busyId === u.id}
                      onClick={() => setStatus(u.id, "suspended")}
                      title={isSelf ? "You can't suspend your own account" : "Suspend"}
                      className="flex items-center gap-1.5 text-xs font-semibold border border-white/10 hover:bg-white/5 disabled:opacity-50 text-zinc-300 px-3 py-2 rounded-lg transition"
                    >
                      <ShieldBan size={14} /> Suspend
                    </button>
                  ) : (
                    <button
                      disabled={busyId === u.id}
                      onClick={() => setStatus(u.id, "approved")}
                      className="flex items-center gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-3 py-2 rounded-lg transition"
                    >
                      <RotateCcw size={14} /> Reinstate
                    </button>
                  )}
                  {u.status !== "rejected" && (
                    <button
                      disabled={isSelf || busyId === u.id}
                      onClick={() => setStatus(u.id, "rejected")}
                      title={isSelf ? "You can't ban your own account" : "Ban"}
                      className="flex items-center gap-1.5 text-xs font-semibold bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white px-3 py-2 rounded-lg transition"
                    >
                      <XCircle size={14} /> Ban
                    </button>
                  )}
                </div>
              </div>
            );
          })}
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
              {newCredential.user.full_name || newCredential.user.email} — their old password no
              longer works. Share this with them yourself; it won't be shown again.
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
              Only admins can issue password resets — accounts can't set their own.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}