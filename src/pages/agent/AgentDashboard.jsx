import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Phone, UploadCloud, CheckCircle2, Clock } from "lucide-react";
import { fetchMyAssignedRequests } from "../../agent/lib/agentApi";

const formatINR = (value) =>
  value == null ? "—" : "₹" + Math.round(Number(value)).toLocaleString("en-IN");

const LISTING_TYPE_LABEL = {
  auction: "Auction",
  buy_now_only: "Buy Now",
};

export default function AgentDashboard() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setRequests(await fetchMyAssignedRequests());
    } catch (e) {
      setError(e.message || "Couldn't load your assigned cars.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const pending = requests.filter((r) => r.agent_status !== "submitted");
  const done = requests.filter((r) => r.agent_status === "submitted");

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-1">Assigned Cars</h1>
      <p className="text-sm text-[#6B7A9A] mb-6">
        Cars admin has assigned to you. Visit the seller, inspect the car, then upload full details & photos.
      </p>

      {loading ? (
        <p className="text-sm text-[#8593B0]">Loading…</p>
      ) : error ? (
        <p className="text-sm text-red-500">{error}</p>
      ) : (
        <>
          <h2 className="text-sm font-semibold text-[#4B5A78] mb-3 flex items-center gap-1.5">
            <Clock size={14} /> Pending Upload ({pending.length})
          </h2>
          {pending.length === 0 ? (
            <p className="text-sm text-[#8593B0] mb-8">Nothing assigned right now.</p>
          ) : (
            <div className="space-y-3 mb-8">
              {pending.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-col md:flex-row md:items-center justify-between gap-3 border border-[#E3E8F5] rounded-xl p-4 bg-white"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-[#0B2545] truncate">{r.vehicle_title}</p>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                        {LISTING_TYPE_LABEL[r.listing_type] || "Type TBD"}
                      </span>
                    </div>
                    <p className="text-sm text-[#4B5A78] mt-1">
                      {r.buyer_name || "Seller"} · {r.year || "—"} ·{" "}
                      {r.km_driven ? `${r.km_driven.toLocaleString("en-IN")} km` : "—"} · Wants{" "}
                      {formatINR(r.expected_price)}
                    </p>
                    {r.buyer_phone && (
                      <p className="text-xs text-[#8593B0] flex items-center gap-1 mt-1">
                        <Phone size={12} /> {r.buyer_phone}
                      </p>
                    )}
                  </div>
                  <Link
                    to={`/agent/upload/${r.id}`}
                    className="shrink-0 flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500"
                  >
                    <UploadCloud size={14} /> Upload Car
                  </Link>
                </div>
              ))}
            </div>
          )}

          <h2 className="text-sm font-semibold text-[#4B5A78] mb-3 flex items-center gap-1.5">
            <CheckCircle2 size={14} /> Submitted ({done.length})
          </h2>
          {done.length === 0 ? (
            <p className="text-sm text-[#8593B0]">Nothing submitted yet.</p>
          ) : (
            <div className="space-y-3">
              {done.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 border border-[#E3E8F5] rounded-xl p-4 bg-[#F7F9FC]">
                  <p className="font-medium text-[#0B2545] truncate">{r.vehicle_title}</p>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-zinc-200 text-zinc-600">
                    Submitted
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
