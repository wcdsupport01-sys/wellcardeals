import CredentialField from "../components/CredentialField";
import AdminDialog from "../components/AdminDialog";
import { exportCSV } from "../lib/csv";
import { backendCommand } from "../../lib/backendCommands";
import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Building2,
  User,
  Phone,
  Mail,
  CalendarDays,
  CheckCircle2,
  XCircle,
  Eye,
  X,
  MapPin,
} from "lucide-react";
import {
  fetchDealerApplications,
  approveDealerApplication,
  rejectDealerApplication,
} from "../../auth/authApi";
import { useAuth } from "../../auth/AuthContext";

const STATUS_STYLES = {
  pending: "bg-amber-500/15 text-amber-400",
  approved: "bg-emerald-500/15 text-emerald-400",
  rejected: "bg-red-500/15 text-red-400",
};

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function DealerApplicationsPage() {
  const { role } = useAuth();
  const readOnly = !["admin", "manager"].includes(role);

  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("pending");
  const [updatingId, setUpdatingId] = useState(null);
  const [viewing, setViewing] = useState(null); // application object, for the details modal
  const [provisioning, setProvisioning] = useState(null);
  const [credentials, setCredentials] = useState(null); // { dealerId, tempPassword, businessName } after approving
  const [actionError, setActionError] = useState("");
  const [search,setSearch]=useState("");
  const actionLock = useRef(false);

  const manageAccountUrl = (application) => {
    const identifier = application.auth_user_id || application.dealer_id;
    return identifier ? `/admin/dealers?dealer=${encodeURIComponent(identifier)}` : `/admin/dealers?q=${encodeURIComponent(application.email || "")}`;
  };

  function applyReceipt(updated) {
    const fields = { status: updated.status, dealer_id: updated.dealer_id, auth_user_id: updated.auth_user_id, updated_at: updated.updated_at };
    setApplications((prev) => filter !== "all" && updated.status !== filter ? prev.filter((application) => application.id !== updated.id) : prev.map((application) => application.id === updated.id ? { ...application, ...fields } : application));
    window.dispatchEvent(new Event("wcd-admin-refresh"));
    setViewing((previous) => previous?.id === updated.id ? { ...previous, ...fields } : previous);
  }

  async function load(status = filter) {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDealerApplications(status);
      setApplications(data);
    } catch (err) {
      setError(err.message || "Couldn't load dealer applications.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(filter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function handleApprove(id) {
    if (readOnly || actionLock.current) return null;
    const application = applications.find((item) => item.id === id);
    if (!application || application.status !== "pending") return null;
    actionLock.current = true;
    setActionError("");
    setUpdatingId(id);
    try {
      const updated = await approveDealerApplication(id);
      applyReceipt(updated);
      // Email isn't wired up yet — surface the credentials here so the
      // admin can copy/share them manually.
      if (updated?.tempPassword) {
        setCredentials({
          dealerId: updated.dealer_id,
          tempPassword: updated.tempPassword,
          businessName: updated.business_name,
          email: updated.email,
        });
      }
      return updated;
    } catch (err) {
      if (err.provisioningUserId) setProvisioning({ application_id:id, auth_user_id:err.provisioningUserId });
      setActionError(`Couldn't approve: ${err.message}`);
      return null;
    } finally {
      actionLock.current = false;
      setUpdatingId(null);
    }
  }

  async function handleReject(id) {
    if (readOnly || actionLock.current) return null;
    const application = applications.find((item) => item.id === id);
    if (!application || application.status !== "pending") return null;
    actionLock.current = true;
    setActionError("");
    setUpdatingId(id);
    try {
      const updated = await rejectDealerApplication(id);
      applyReceipt(updated);
      return updated;
    } catch (err) {
      setActionError(`Couldn't reject: ${err.message}`);
      return null;
    } finally {
      actionLock.current = false;
      setUpdatingId(null);
    }
  }

  async function reconcile() {
    setUpdatingId(provisioning.application_id);
    try {
      await backendCommand("dealer_finalize", provisioning);
      setProvisioning(null); await load();
      alert("Account setup completed. Open Dealers to issue a fresh password.");
    } catch (failure) { alert(failure.message || "Setup could not be confirmed. Retry after reviewing the application."); }
    finally { setUpdatingId(null); }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white mb-1">Dealer Applications</h1>
      {provisioning && <div role="alert" className="my-4 border border-amber-500 p-4 text-amber-200">This application's account setup needs confirmation. <button disabled={Boolean(updatingId)} onClick={reconcile} className="underline">Finish account setup</button></div>}
      <p className="text-sm text-zinc-400 mb-6">
        Review pending dealer applications. Approval creates and links the dealer login; credentials
        are shown once for staff to share manually. Manage approved dealers' access from Manage Dealers.
      </p>
      {actionError && !viewing && <div role="alert" className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{actionError} <button type="button" onClick={() => { setActionError(""); load(); }} className="underline ml-2">Reload applications</button></div>}

      <div className="aw-list-tools"><label><span className="sr-only">Search dealer applications</span><input aria-label="Search dealer applications" placeholder="Search business, email or dealer…" value={search} onChange={e=>setSearch(e.target.value)}/></label><button type="button" className="aw-button" onClick={()=>exportCSV("dealer-applications",["Application","Business","Contact","Email","Status","Dealer ID"],applications.map(a=>[a.id,a.business_name,a.dealer_name,a.email,a.status,a.dealer_id]))}>Export current list</button></div>
      <div className="flex gap-2 mb-5">
        {["pending", "approved", "rejected", "all"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition ${
              filter === f ? "bg-amber-500/15 text-amber-400" : "text-zinc-400 hover:bg-white/5"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : error ? (
        <p className="text-sm text-red-400">{error}</p>
      ) : applications.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No {filter !== "all" ? filter : ""} dealer applications.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {applications.filter(a=>[a.business_name,a.dealer_name,a.email,a.dealer_id].some(v=>String(v||"").toLowerCase().includes(search.toLowerCase()))).map((app) => (
            <div
              key={app.id}
              className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 flex flex-col gap-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Building2 size={16} className="text-blue-400 shrink-0" />
                  <p className="font-semibold text-white truncate">{app.business_name}</p>
                </div>
                <span
                  className={`shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize ${
                    STATUS_STYLES[app.status] || "bg-zinc-500/15 text-zinc-400"
                  }`}
                >
                  {app.status}
                </span>
              </div>

              {app.dealer_id && (
                <span className="w-fit text-[11px] font-mono font-semibold tracking-wide bg-blue-500/10 text-blue-400 px-2.5 py-1 rounded-lg">
                  {app.dealer_id}
                </span>
              )}

              <div className="space-y-1.5 text-sm text-zinc-300">
                <p className="flex items-center gap-2">
                  <User size={13} className="text-zinc-500 shrink-0" />
                  <span className="truncate">{app.dealer_name}</span>
                </p>
                <p className="flex items-center gap-2">
                  <Phone size={13} className="text-zinc-500 shrink-0" />
                  <span className="truncate">{app.mobile_number}</span>
                </p>
                <p className="flex items-center gap-2">
                  <Mail size={13} className="text-zinc-500 shrink-0" />
                  <span className="truncate">{app.email}</span>
                </p>
                <p className="flex items-center gap-2 text-zinc-500 text-xs">
                  <CalendarDays size={13} className="shrink-0" />
                  Applied {formatDate(app.created_at)}
                </p>
              </div>

              <div className="flex items-center gap-2 mt-1 pt-3 border-t border-white/10">
                <button
                  onClick={() => { setActionError(""); setViewing(app); }}
                  className="flex items-center gap-1.5 text-xs font-semibold border border-white/10 hover:bg-white/5 text-zinc-300 px-3 py-2 rounded-lg transition"
                >
                  <Eye size={14} /> View Details
                </button>

                {!readOnly && app.status === "pending" && (
                  <>
                    <button
                      disabled={Boolean(updatingId)}
                      onClick={() => handleApprove(app.id)}
                      className="flex items-center gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-3 py-2 rounded-lg transition ml-auto"
                    >
                      <CheckCircle2 size={14} />
                      {updatingId === app.id ? "…" : "Approve"}
                    </button>
                    <button
                      disabled={Boolean(updatingId)}
                      onClick={() => handleReject(app.id)}
                      className="flex items-center gap-1.5 text-xs font-semibold bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white px-3 py-2 rounded-lg transition"
                    >
                      <XCircle size={14} />
                      {updatingId === app.id ? "…" : "Reject"}
                    </button>
                  </>
                )}
                {!readOnly && app.status === "approved" && <Link to={manageAccountUrl(app)} className="ml-auto text-xs font-semibold text-blue-300 border border-blue-400/30 rounded-lg px-3 py-2">Manage account</Link>}
              </div>
            </div>
          ))}
        </div>
      )}

      {viewing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          onClick={() => setViewing(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0B1120] p-6 relative"
          >
            <button
              onClick={() => setViewing(null)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-white transition"
              aria-label="Close"
            >
              <X size={18} />
            </button>

            <h2 className="text-lg font-semibold text-white mb-1">{viewing.business_name}</h2>
            {actionError && <div role="alert" className="my-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">{actionError} <button type="button" onClick={() => { setViewing(null); setActionError(""); load(); }} className="underline ml-2">Reload applications</button></div>}
            <span
              className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize mb-4 ${
                STATUS_STYLES[viewing.status] || "bg-zinc-500/15 text-zinc-400"
              }`}
            >
              {viewing.status}
            </span>

            {viewing.dealer_id && (
              <div className="mb-4">
                <span className="text-[11px] font-mono font-semibold tracking-wide bg-blue-500/10 text-blue-400 px-2.5 py-1 rounded-lg">
                  {viewing.dealer_id}
                </span>
              </div>
            )}

            <dl className="space-y-3 text-sm">
              <div className="flex items-start gap-2.5">
                <User size={15} className="text-zinc-500 mt-0.5 shrink-0" />
                <div>
                  <dt className="text-xs text-zinc-500">Dealer Name</dt>
                  <dd className="text-zinc-200">{viewing.dealer_name}</dd>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <MapPin size={15} className="text-zinc-500 mt-0.5 shrink-0" />
                <div>
                  <dt className="text-xs text-zinc-500">Business Address</dt>
                  <dd className="text-zinc-200">{viewing.business_address}</dd>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Phone size={15} className="text-zinc-500 mt-0.5 shrink-0" />
                <div>
                  <dt className="text-xs text-zinc-500">Mobile</dt>
                  <dd className="text-zinc-200">{viewing.mobile_number}</dd>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Mail size={15} className="text-zinc-500 mt-0.5 shrink-0" />
                <div>
                  <dt className="text-xs text-zinc-500">Email</dt>
                  <dd className="text-zinc-200">{viewing.email}</dd>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <CalendarDays size={15} className="text-zinc-500 mt-0.5 shrink-0" />
                <div>
                  <dt className="text-xs text-zinc-500">Registration Date</dt>
                  <dd className="text-zinc-200">{formatDate(viewing.created_at)}</dd>
                </div>
              </div>
            </dl>

            {!readOnly && viewing.status === "pending" && (
              <div className="flex items-center gap-2 mt-6 pt-4 border-t border-white/10">
                <button
                  disabled={Boolean(updatingId)}
                  onClick={() => handleApprove(viewing.id)}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-3 py-2.5 rounded-lg transition"
                >
                  <CheckCircle2 size={14} /> Approve
                </button>
                <button
                  disabled={Boolean(updatingId)}
                  onClick={() => handleReject(viewing.id)}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white px-3 py-2.5 rounded-lg transition"
                >
                  <XCircle size={14} /> Reject
                </button>
              </div>
            )}
            {!readOnly && viewing.status === "approved" && <div className="mt-6 border-t border-white/10 pt-4"><p className="text-xs text-zinc-400 mb-3">This application is approved. Use the dealer account to review or suspend access.</p><Link to={manageAccountUrl(viewing)} className="block rounded-lg border border-blue-400/30 px-3 py-2.5 text-center text-xs font-semibold text-blue-300">Manage account</Link></div>}
          </div>
        </div>
      )}

      {credentials && <AdminDialog title="Dealer approved · Login credentials" onClose={()=>setCredentials(null)}><p className="aw-muted">{credentials.businessName} — copy the newly issued credentials now. Share them manually; closing this window clears them from the panel.</p><CredentialField label="Dealer login ID" value={credentials.dealerId}/><CredentialField label="New password" value={credentials.tempPassword} secret/><p className="aw-muted">Login at wellcardeals.com/dealer-login. Lost credentials can be replaced from Dealer accounts.</p><button type="button" className="aw-button aw-primary" onClick={()=>setCredentials(null)}>Done</button></AdminDialog>}

    </div>
  );
}
