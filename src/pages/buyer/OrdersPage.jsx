import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Package, CheckCircle2, Clock, XCircle } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { supabase } from "../../lib/supabaseClient";

const formatINR = (v) => (v == null ? "—" : "₹" + Math.round(Number(v)).toLocaleString("en-IN"));

const STATUS_STYLES = {
  pending: { icon: Clock, cls: "bg-amber-50 text-amber-600", label: "Pending" },
  contacted: { icon: Clock, cls: "bg-brand-50 text-brand", label: "Contacted" },
  completed: { icon: CheckCircle2, cls: "bg-emerald-50 text-emerald-600", label: "Completed" },
  cancelled: { icon: XCircle, cls: "bg-red-50 text-red-500", label: "Cancelled" },
};

export default function OrdersPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!user || !supabase) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const { data } = await supabase
        .from("car_purchase_requests")
        .select("*, cars(vehicle_title, thumbnail_url)")
        .eq("buyer_id", user.id)
        .order("created_at", { ascending: false });
      if (active) {
        setRequests(data || []);
        setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [user]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy-900 mb-1">My Orders</h1>
      <p className="text-gray-500 mb-8">Your Buy Now requests on car listings.</p>

      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : requests.length === 0 ? (
        <div className="card p-10 text-center">
          <span className="mx-auto mb-3 h-12 w-12 rounded-full bg-brand-50 text-brand flex items-center justify-center">
            <Package size={22} />
          </span>
          <p className="font-semibold text-navy-900 mb-1">No orders yet</p>
          <p className="text-sm text-gray-500 mb-5">Buy Now requests you make on a car's page will show up here.</p>
          <Link to="/buy-car" className="btn-secondary text-sm inline-flex">
            Browse Cars
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => {
            const s = STATUS_STYLES[r.status] || STATUS_STYLES.pending;
            const Icon = s.icon;
            return (
              <div key={r.id} className="card p-5 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="font-semibold text-navy-900">{r.cars?.vehicle_title || "Car listing"}</p>
                  <p className="text-sm text-gray-500 mt-0.5">Offer: {formatINR(r.offer_price)}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Requested {new Date(r.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full shrink-0 ${s.cls}`}>
                  <Icon size={13} /> {s.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
