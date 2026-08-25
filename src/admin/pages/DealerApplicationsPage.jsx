import React, { useEffect, useState } from "react";
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
  const readOnly = role === "team_lead";

  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("pending");
  const [updatingId, setUpdatingId] = useState(null);
  const [viewing, setViewing] = useState(null); // application object, for the details modal
  const [credentials, setCredentials] = useState(null); // { dealerId, tempPassword, businessName } after approving

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
    setUpdatingId(id);
    try {
      const updated = await approveDealerApplication(id);
      // Reflect the change immediately; if we're viewing "pending" only,
      // drop it from the list instead of re-fetching.
      setApplications((prev) =>
        filter === "pending"
          ? prev.filter((a) => a.id !== id)
          : prev.map((a) =>
              a.id === id ? { ...a, status: "approved", dealer_id: updated?.dealer_id } : a
            )
      );
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
      alert(`Couldn't approve: ${err.message}`);
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleReject(id) {
    setUpdatingId(id);
    try {
      await rejectDealerApplication(id);
      setApplications((prev) =>
        filter === "pending"
          ? prev.filter((a) => a.id !== id)
          : prev.map((a) => (a.id === id ? { ...a, status: "rejected" } : a))
      );
    } catch (err) {
      alert(`Couldn't reject: ${err.message}`);
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white mb-1">Dealer Applications</h1>
      <p className="text-sm text-zinc-400 mb-6">
        Review new dealer sign-up applications. Approving or rejecting here only updates the
        application status — no email is sent and no dealer login/password is created yet.
      </p>

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
          {applications.map((app) => (
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
                  onClick={() => setViewing(app)}
                  className="flex items-center gap-1.5 text-xs font-semibold border border-white/10 hover:bg-white/5 text-zinc-300 px-3 py-2 rounded-lg transition"
                >
                  <Eye size={14} /> View Details
                </button>

                {!readOnly && (
                  <>
                    <button
                      disabled={updatingId === app.id || app.status === "approved"}
                      onClick={() => handleApprove(app.id)}
                      className="flex items-center gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-3 py-2 rounded-lg transition ml-auto"
                    >
                      <CheckCircle2 size={14} />
                      {updatingId === app.id ? "…" : "Approve"}
                    </button>
                    <button
                      disabled={updatingId === app.id || app.status === "rejected"}
                      onClick={() => handleReject(app.id)}
                      className="flex items-center gap-1.5 text-xs font-semibold bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white px-3 py-2 rounded-lg transition"
                    >
                      <XCircle size={14} />
                      {updatingId === app.id ? "…" : "Reject"}
                    </button>
                  </>
                )}
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

            {!readOnly && (
              <div className="flex items-center gap-2 mt-6 pt-4 border-t border-white/10">
                <button
                  disabled={updatingId === viewing.id || viewing.status === "approved"}
                  onClick={async () => {
                    const updated = await handleApprove(viewing.id);
                    setViewing((v) =>
                      v ? { ...v, status: "approved", dealer_id: updated?.dealer_id ?? v.dealer_id } : v
                    );
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-3 py-2.5 rounded-lg transition"
                >
                  <CheckCircle2 size={14} /> Approve
                </button>
                <button
                  disabled={updatingId === viewing.id || viewing.status === "rejected"}
                  onClick={async () => {
                    await handleReject(viewing.id);
                    setViewing((v) => (v ? { ...v, status: "rejected" } : v));
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white px-3 py-2.5 rounded-lg transition"
                >
                  <XCircle size={14} /> Reject
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {credentials && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          onClick={() => setCredentials(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-emerald-500/20 bg-[#0B1120] p-6 relative"
          >
            <button
              onClick={() => setCredentials(null)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-white transition"
              aria-label="Close"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 size={18} className="text-emerald-400" />
              <h2 className="text-lg font-semibold text-white">Dealer Approved</h2>
            </div>
            <p className="text-sm text-zinc-400 mb-5">
              {credentials.businessName} — email sending isn't set up yet, so share these with the
              dealer manually.
            </p>

            <div className="space-y-3">
              <div>
                <p className="text-xs text-zinc-500 mb-1">Dealer ID</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm font-mono bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-blue-400">
                    {credentials.dealerId}
                  </code>
                  <button
                    onClick={() => navigator.clipboard.writeText(credentials.dealerId)}
                    className="text-xs font-semibold border border-white/10 hover:bg-white/5 text-zinc-300 px-3 py-2 rounded-lg transition"
                  >
                    Copy
                  </button>
                </div>
              </div>

              <div>
                <p className="text-xs text-zinc-500 mb-1">Temporary Password</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm font-mono bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-amber-400">
                    {credentials.tempPassword}
                  </code>
                  <button
                    onClick={() => navigator.clipboard.writeText(credentials.tempPassword)}
                    className="text-xs font-semibold border border-white/10 hover:bg-white/5 text-zinc-300 px-3 py-2 rounded-lg transition"
                  >
                    Copy
                  </button>
                </div>
              </div>

              <div>
                <p className="text-xs text-zinc-500 mb-1">Registered Email</p>
                <p className="text-sm text-zinc-300">{credentials.email}</p>
              </div>
            </div>

            <button
              onClick={() =>
                navigator.clipboard.writeText(
                  `Dealer ID: ${credentials.dealerId}\nPassword: ${credentials.tempPassword}\nLogin: https://wellcardeals.com/dealer-login`
                )
              }
              className="w-full mt-5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white px-3 py-2.5 rounded-lg transition"
            >
              Copy All (for WhatsApp/SMS)
            </button>

            <p className="text-[11px] text-zinc-500 text-center mt-3">
              This password is permanent until reset — dealers can't change it themselves.
              If they lose it, use "Reset Password" on the Manage Dealers page to issue a new one.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}