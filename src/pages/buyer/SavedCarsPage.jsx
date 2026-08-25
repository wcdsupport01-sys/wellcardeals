import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Heart, Car, Trash2 } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { supabase } from "../../lib/supabaseClient";

const formatINR = (v) => (v == null ? "—" : "₹" + Math.round(Number(v)).toLocaleString("en-IN"));

export default function SavedCarsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState(null);

  async function load() {
    if (!user || !supabase) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("wishlist")
      .select(
        "id, created_at, cars(id, vehicle_title, thumbnail_url, images, mileage_km, base_price_buyer, current_bid_buyer, fuel_types(name), transmissions(name))"
      )
      .eq("buyer_id", user.id)
      .order("created_at", { ascending: false });
    setItems(data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function remove(wishlistId) {
    setRemovingId(wishlistId);
    await supabase.from("wishlist").delete().eq("id", wishlistId);
    setItems((prev) => prev.filter((i) => i.id !== wishlistId));
    setRemovingId(null);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy-900 mb-1">Saved Cars</h1>
      <p className="text-gray-500 mb-8">Cars you've saved to look at later.</p>

      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : items.length === 0 ? (
        <div className="card p-10 text-center">
          <span className="mx-auto mb-3 h-12 w-12 rounded-full bg-rose-50 text-rose-400 flex items-center justify-center">
            <Heart size={22} />
          </span>
          <p className="font-semibold text-navy-900 mb-1">No saved cars yet</p>
          <p className="text-sm text-gray-500 mb-5">Tap the heart icon on any car to save it here.</p>
          <Link to="/buy-car" className="btn-secondary text-sm inline-flex">
            Browse Cars
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map(({ id, cars: c }) => {
            if (!c) return null;
            const cover = c.thumbnail_url || (Array.isArray(c.images) && c.images[0]);
            const price = c.current_bid_buyer ?? c.base_price_buyer;
            return (
              <div key={id} className="card card-hover overflow-hidden">
                <Link to={`/cars/${c.id}`} className="block h-40 bg-surface-muted overflow-hidden">
                  {cover ? (
                    <img src={cover} alt={c.vehicle_title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                      <Car size={28} />
                    </div>
                  )}
                </Link>
                <div className="p-4">
                  <Link to={`/cars/${c.id}`}>
                    <p className="font-semibold text-navy-900 truncate hover:text-brand">{c.vehicle_title}</p>
                  </Link>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {formatINR(price)}
                    {c.mileage_km ? ` · ${Math.round(c.mileage_km).toLocaleString("en-IN")} km` : ""}
                    {c.fuel_types?.name ? ` · ${c.fuel_types.name}` : ""}
                  </p>
                  <button
                    onClick={() => remove(id)}
                    disabled={removingId === id}
                    className="mt-3 flex items-center gap-1.5 text-xs font-medium text-red-500 hover:text-red-600 disabled:opacity-50"
                  >
                    <Trash2 size={13} /> {removingId === id ? "Removing…" : "Remove"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
