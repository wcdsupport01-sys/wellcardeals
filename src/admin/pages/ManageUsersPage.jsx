import AdminRecordCollection from "../components/AdminRecordCollection";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  UserPlus, Loader2, AlertCircle, Copy, Check, ShieldBan,
  XCircle, RotateCcw, Search, KeyRound, X, Eye, EyeOff,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../auth/AuthContext";
import { inputClass } from "../components/FormSection";
import { resetUserPassword } from "../../auth/authApi";
import {
  DEFAULT_COMPANY_EMAIL,
  pendingStaffLoginId,
  clearPendingStaff,
  createStaffAccount,
} from "../lib/staffAccounts";

const ALL_ROLES = ["admin", "manager", "team_lead", "agent"];
const STAFF_ROLES = ["admin", "manager", "team_lead"];

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

function roleLabel(role) {
  if (role === "team_lead") return "Team Lead";
  return role ? role[0].toUpperCase() + role.slice(1) : "Unknown";
}

function companyContact(user) {
  return user.company_email || DEFAULT_COMPANY_EMAIL;
}

function Field({ label, children }) {
  return (
    <label className="block space-y-1.5 text-xs font-semibold text-zinc-300">
      <span>{label}</span>
      {children}
    </label>
  );
}

function CopyRow({ label, value, secret = false }) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function handleCopy() {
    setCopyError("");
    try {
      await navigator.clipboard.writeText(String(value ?? ""));
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopyError(
        secret
          ? "Use Show, then select and copy the password manually."
          : "Select and copy this value manually.",
      );
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="mb-1 text-xs font-semibold text-slate-500">{label}</p>
      <div className="flex items-center gap-2">
        <input
          aria-label={label}
          readOnly
          value={String(value ?? "")}
          type={secret && !visible ? "password" : "text"}
          autoComplete="off"
          onFocus={(event) => event.target.select()}
          className="min-w-0 flex-1 bg-transparent text-sm font-mono font-semibold text-slate-900 outline-none"
        />
        {secret && (
          <button
            type="button"
            onClick={() => setVisible((old) => !old)}
            aria-label={visible ? "Hide password" : "Show password"}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          >
            {visible ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        )}
        <button
          type="button"
          onClick={handleCopy}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {copyError && (
        <p role="status" className="mt-2 text-xs text-amber-700">
          {copyError}
        </p>
      )}
    </div>
  );
}

function PasswordDialog({ credential, onClose }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const node = dialogRef.current;
    if (node && !node.open) node.showModal();
    return () => {
      if (node?.open) node.close();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="staff-password-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
      className="w-[calc(100%_-_2rem)] max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl backdrop:bg-slate-950/60"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close password"
        className="absolute right-4 top-4 rounded-lg p-1 text-slate-500"
      >
        <X size={18} />
      </button>
      <div className="mb-2 flex items-center gap-2 pr-6">
        <KeyRound size={18} className="text-blue-600" />
        <h2 id="staff-password-title" className="text-lg font-bold">
          New password issued
        </h2>
      </div>
      <p className="mb-4 text-sm text-slate-600">
        {credential.user.full_name || "Staff account"} — the old password
        has stopped working. Copy the new password before closing.
      </p>
      <div className="space-y-3">
        {credential.user.staff_login_id && (
          <CopyRow label="Staff ID" value={credential.user.staff_login_id} />
        )}
        <CopyRow
          label="Company contact email"
          value={companyContact(credential.user)}
        />
        <CopyRow label="New password" value={credential.password} secret />
      </div>
      <p className="mt-4 text-xs text-slate-500">
        The password is shown for this reset only.
      </p>
      <button
        type="button"
        onClick={onClose}
        className="mt-5 w-full rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white hover:bg-blue-500"
      >
        Done
      </button>
    </dialog>
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
  const [notice, setNotice] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [fullName, setFullName] = useState("");
  const [companyEmail, setCompanyEmail] = useState(DEFAULT_COMPANY_EMAIL);
  const [staffLoginId, setStaffLoginId] = useState("");
  const [phone, setPhone] = useState("");
  const [newRole, setNewRole] = useState("manager");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [credentials, setCredentials] = useState(null);
  const [checking, setChecking] = useState(false);
  const [resettingId, setResettingId] = useState(null);
  const [newCredential, setNewCredential] = useState(null);

  const createLock = useRef(false);
  const mutationLock = useRef(false);
  const mounted = useRef(false);
  const loadVersion = useRef(0);

  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    setLoading(true);
    setError(null);
    try {
      const { data, error: readError } = await supabase
        .from("profiles")
        .select("*")
        .in("role", ALL_ROLES)
        .order("created_at", { ascending: false });

      if (readError) throw readError;
      if (mounted.current && loadVersion.current === version) {
        setUsers(data || []);
      }
    } catch (failure) {
      if (mounted.current && loadVersion.current === version) {
        setError(failure.message || "Staff could not be loaded.");
      }
    } finally {
      if (mounted.current && loadVersion.current === version) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    load();
    return () => {
      mounted.current = false;
      loadVersion.current += 1;
    };
  }, [load]);

  function toggleForm() {
    if (createLock.current) return;
    setCredentials(null);
    setCreateError("");

    if (showForm) {
      setPassword("");
      setShowForm(false);
      return;
    }

    try {
      setStaffLoginId(pendingStaffLoginId(currentUser?.id));
      setShowForm(true);
    } catch (failure) {
      setCreateError(failure.message || "The staff form could not be opened.");
    }
  }

  async function handleCreate(event) {
    event.preventDefault();
    if (createLock.current) return;

    createLock.current = true;
    setCreating(true);
    setCreateError("");

    try {
      const result = await createStaffAccount(
        supabase,
        { fullName, companyEmail, staffLoginId, phone, role: newRole, password },
        currentUser?.id,
      );
      setCredentials(result);
      setFullName("");
      setPhone("");
      setPassword("");
      setSearch(result.staffLoginId);
      setRoleFilter("all");
      setStatusFilter("all");
      await load();
    } catch (failure) {
      setCreateError(
        failure.message ||
        "The result could not be confirmed. Check this Staff ID before retrying.",
      );
    } finally {
      createLock.current = false;
      setCreating(false);
    }
  }

  async function checkPendingAccount() {
    if (!staffLoginId || checking || createLock.current) return;
    setChecking(true);

    try {
      const { data, error: readError } = await supabase
        .from("profiles")
        .select("id,staff_login_id,role")
        .eq("staff_login_id", staffLoginId)
        .maybeSingle();

      if (readError) throw readError;
      setSearch(staffLoginId);
      setRoleFilter("all");
      setStatusFilter("all");

      if (
        data?.id &&
        data.staff_login_id === staffLoginId &&
        ALL_ROLES.includes(data.role)
      ) {
        clearPendingStaff(currentUser?.id, staffLoginId);
        setPassword("");
        setCredentials(null);
        setShowForm(false);
        setCreateError("");
        await load();
        setNotice({
          id: data.id,
          text: "This Staff ID already has an account. Use Reset Password if its password was not received.",
          isError: false,
        });
      } else {
        setCreateError(
          "No staff profile was found for this ID. Keep this ID when retrying. " +
          "If its login already exists, account setup may need to be completed.",
        );
      }
    } catch (failure) {
      setCreateError(
        failure.message ||
        "The Staff ID could not be checked. Keep the same ID when retrying.",
      );
    } finally {
      setChecking(false);
    }
  }

  async function updateAccount(user, changes) {
    if (mutationLock.current || user.id === currentUser?.id) return;

    if (!currentUser?.id) {
      setNotice({
        id: user.id,
        text: "Sign in before changing this account.",
        isError: true,
      });
      return;
    }

    mutationLock.current = true;
    setBusyId(user.id);
    setNotice(null);

    try {
      const { data, error: writeError } = await supabase
        .from("profiles")
        .update(changes)
        .eq("id", user.id)
        .select("id,role,status")
        .maybeSingle();

      if (writeError) throw writeError;

      if (
        !data ||
        data.id !== user.id ||
        Object.entries(changes).some(([key, value]) => data[key] !== value)
      ) {
        throw new Error("The update was not confirmed. Reload staff before retrying.");
      }

      setUsers((previous) => previous.map((item) =>
        item.id === user.id ? { ...item, ...data } : item,
      ));
    } catch (failure) {
      setNotice({
        id: user.id,
        text: failure.message || "The account update could not be confirmed.",
        isError: true,
      });
    } finally {
      mutationLock.current = false;
      setBusyId(null);
    }
  }

  async function handleResetPassword(user) {
    if (mutationLock.current) return;
    mutationLock.current = true;

    try {
      if (!currentUser?.id) {
        throw new Error("Sign in before resetting this password.");
      }

      const reference = user.staff_login_id || user.email || user.id;
      if (!window.confirm(
        `Issue a new password for ${user.full_name || "this staff account"} ` +
        `(${reference})? Their old password will stop working immediately.`,
      )) return;

      setResettingId(user.id);
      setNotice(null);

      const result = await resetUserPassword(user.id, undefined, {
        expectedActorId: currentUser.id,
      });
      setNewCredential({ user, password: result.password });
    } catch (failure) {
      setNotice({
        id: user.id,
        text: failure.message || "The password reset could not be confirmed.",
        isError: true,
      });
    } finally {
      mutationLock.current = false;
      setResettingId(null);
    }
  }

  const roleCounts = useMemo(() => {
    const counts = { all: users.length };
    ALL_ROLES.forEach((role) => { counts[role] = 0; });
    users.forEach((user) => {
      if (ALL_ROLES.includes(user.role)) counts[user.role] += 1;
    });
    return counts;
  }, [users]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users.filter((user) => {
      if (roleFilter !== "all" && user.role !== roleFilter) return false;
      if (statusFilter !== "all" && user.status !== statusFilter) return false;

      return !query || [
        user.full_name, companyContact(user),
        user.staff_login_id, user.email, user.id,
      ].some((value) => String(value || "").toLowerCase().includes(query));
    });
  }, [users, roleFilter, statusFilter, search]);

  const displayRows = useMemo(() => filtered.map((user) => ({
    ...user,
    email: companyContact(user),
  })), [filtered]);

  const mutating = Boolean(busyId || resettingId);

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-2xl font-bold text-white">Manage Users</h1>
        <button
          type="button"
          onClick={toggleForm}
          disabled={creating}
          className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-3.5 py-2 text-sm font-bold text-black hover:bg-amber-400 disabled:opacity-60"
        >
          <UserPlus size={16} /> New Staff Account
        </button>
      </div>

      <p className="mb-6 text-sm text-zinc-400">
        Manage admins, managers, team leads and agents. Staff can share the
        company contact email; each new staff member signs in with a separate
        Staff ID and password. Dealers are managed on Manage Dealers.
      </p>

      {!showForm && createError && (
        <p role="alert" className="mb-4 text-sm text-red-400">{createError}</p>
      )}

      {showForm && (
        <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          {!credentials ? (
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Full name">
                  <input required className={inputClass} value={fullName}
                    disabled={creating} autoComplete="off"
                    onChange={(event) => setFullName(event.target.value)} />
                </Field>

                <Field label="Company contact email">
                  <input type="email" required className={inputClass}
                    value={companyEmail} disabled={creating} autoComplete="off"
                    onChange={(event) => setCompanyEmail(event.target.value)} />
                </Field>

                <Field label="Staff ID · generated automatically">
                  <input readOnly className={inputClass}
                    value={staffLoginId} autoComplete="off" />
                </Field>

                <Field label="Role">
                  <select className={inputClass} value={newRole}
                    disabled={creating}
                    onChange={(event) => setNewRole(event.target.value)}>
                    {STAFF_ROLES.map((role) => (
                      <option key={role} value={role} className="bg-zinc-900">
                        {roleLabel(role)}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Phone · optional">
                  <input type="tel" className={inputClass} value={phone}
                    disabled={creating} autoComplete="off"
                    onChange={(event) => setPhone(event.target.value)} />
                </Field>

                <Field label="Password · leave blank to generate">
                  <input type="password" className={inputClass}
                    value={password} disabled={creating}
                    autoComplete="new-password"
                    onChange={(event) => setPassword(event.target.value)} />
                </Field>
              </div>

              <p className="text-xs text-zinc-400">
                Use the same company email for every staff member.
                Login uses the Staff ID shown above.
              </p>

              {createError && (
                <div role="alert" className="space-y-2">
                  <p className="flex items-start gap-2 text-sm text-red-400">
                    <AlertCircle size={15} className="mt-0.5 shrink-0" />
                    {createError}
                  </p>
                  <button type="button" onClick={checkPendingAccount}
                    disabled={checking || creating}
                    className="text-xs font-semibold text-blue-400 underline underline-offset-2 disabled:opacity-60">
                    {checking ? "Checking Staff ID…" : "Check this Staff ID"}
                  </button>
                </div>
              )}

              <button type="submit" disabled={creating || checking}
                className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-60">
                {creating && <Loader2 size={16} className="animate-spin" />}
                Create Account
              </button>
            </form>
          ) : (
            <div className="space-y-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-emerald-400">
                <Check size={15} />
                Account created. Copy the Staff ID and password before closing.
              </p>
              <CopyRow label="Staff ID" value={credentials.staffLoginId} />
              <CopyRow label="Company contact email" value={credentials.companyEmail} />
              <CopyRow label="Password" value={credentials.password} secret />

              {credentials.directorySyncPending && (
                <p className="text-xs text-amber-400">
                  Account created. Its directory copy could not be confirmed.
                </p>
              )}

              <button type="button"
                onClick={() => {
                  setCredentials(null);
                  setPassword("");
                  setStaffLoginId("");
                  setShowForm(false);
                }}
                className="text-sm font-semibold text-blue-400 underline underline-offset-2">
                Done
              </button>
            </div>
          )}
        </div>
      )}

      <div className="mb-3 flex flex-col gap-3 sm:flex-row">
        <div className="relative max-w-sm flex-1">
          <Search size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, Staff ID or company email…"
            aria-label="Search staff"
            className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm text-white placeholder:text-zinc-500 focus:border-blue-500/50 focus:outline-none" />
        </div>

        <div className="flex flex-wrap gap-2">
          {["all", "approved", "pending", "rejected", "suspended"].map((status) => (
            <button type="button" key={status}
              onClick={() => setStatusFilter(status)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize ${
                statusFilter === status
                  ? "bg-blue-500/15 text-blue-400"
                  : "text-zinc-400 hover:bg-white/5"
              }`}>
              {status}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {["all", ...ALL_ROLES].map((role) => (
          <button type="button" key={role}
            onClick={() => setRoleFilter(role)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold capitalize ${
              roleFilter === role
                ? "bg-amber-500/15 text-amber-400"
                : "text-zinc-400 hover:bg-white/5"
            }`}>
            {role === "all" ? "All" : roleLabel(role)}
            <span className="text-[10px] opacity-70">
              ({roleCounts[role] ?? 0})
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : error ? (
        <div role="alert">
          <p className="text-sm text-red-400">{error}</p>
          <button type="button" onClick={load}
            className="mt-2 text-sm font-semibold text-blue-400 underline">
            Retry
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-zinc-500">No users match.</p>
      ) : (
        <AdminRecordCollection rows={displayRows} kind="user">
          {filtered.map((user) => {
            const isSelf = user.id === currentUser?.id;

            return (
              <div key={user.id}
                className="flex flex-col justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4 md:flex-row md:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-bold text-white">
                      {user.full_name || "Unnamed"}
                    </p>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${
                      ROLE_STYLES[user.role] || "bg-zinc-500/15 text-zinc-400"
                    }`}>
                      {roleLabel(user.role)}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${
                      STATUS_STYLES[user.status] || "bg-zinc-500/15 text-zinc-400"
                    }`}>
                      {user.status}
                    </span>
                    {isSelf && (
                      <span className="text-[11px] text-zinc-500">(you)</span>
                    )}
                  </div>

                  <p className="mt-1 text-sm text-zinc-400">
                    Company contact: {companyContact(user)}
                  </p>

                  {user.staff_login_id ? (
                    <p className="mt-1 text-sm font-mono font-semibold text-blue-400">
                      Staff ID: {user.staff_login_id}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-zinc-400">
                      Account reference: {user.email || user.id}
                    </p>
                  )}

                  {notice?.id === user.id && (
                    <p role="status" className={`mt-2 text-xs ${
                      notice.isError ? "text-red-400" : "text-emerald-400"
                    }`}>
                      {notice.text}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <select disabled={isSelf || mutating} value={user.role}
                    title={isSelf ? "You cannot change your own role" : "Change role"}
                    onChange={(event) =>
                      updateAccount(user, { role: event.target.value })}
                    className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-xs text-zinc-200 disabled:opacity-50">
                    {ALL_ROLES.map((role) => (
                      <option key={role} value={role} className="bg-zinc-900">
                        {roleLabel(role)}
                      </option>
                    ))}
                  </select>

                  <button type="button" disabled={mutating}
                    onClick={() => handleResetPassword(user)}
                    className="flex items-center gap-1.5 rounded-lg border border-blue-400/30 px-3 py-2 text-xs font-semibold text-blue-400 hover:bg-blue-500/10 disabled:opacity-50">
                    <KeyRound size={14} />
                    {resettingId === user.id ? "Resetting…" : "Reset Password"}
                  </button>

                  {user.status === "suspended" ? (
                    <button type="button" disabled={isSelf || mutating}
                      onClick={() => updateAccount(user, { status: "approved" })}
                      className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">
                      <RotateCcw size={14} /> Reinstate
                    </button>
                  ) : (
                    <button type="button" disabled={isSelf || mutating}
                      onClick={() => updateAccount(user, { status: "suspended" })}
                      className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-white/5 disabled:opacity-50">
                      <ShieldBan size={14} /> Suspend
                    </button>
                  )}

                  {user.status !== "rejected" && (
                    <button type="button" disabled={isSelf || mutating}
                      onClick={() => updateAccount(user, { status: "rejected" })}
                      className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-50">
                      <XCircle size={14} /> Ban
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </AdminRecordCollection>
      )}

      {newCredential && (
        <PasswordDialog
          credential={newCredential}
          onClose={() => setNewCredential(null)}
        />
      )}
    </div>
  );
}
