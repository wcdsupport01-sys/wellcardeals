import { useEffect, useMemo, useState } from "react";
import { Handshake, Phone, Mail, RefreshCw, Search } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { updateCar } from "../lib/carsApi";

const STATUS_OPTIONS = [
  { value: "none", label: "Pending (not yet contacted)" },
  { value: "contacted", label: "Contacted" },
  { value: "negotiating", label: "Negotiating" },
  { value: "deal_done", label: "Deal done" },
  { value: "rejected", label: "Rejected / closed" },
];

const STATUS_STYLES = {
  none: "border-amber-400/30 bg-amber-500/[0.06] text-amber-400",
  contacted: "border-sky-400/30 bg-sky-500/[0.06] text-sky-400",
  negotiating: "border-purple-400/30 bg-purple-500/[0.06] text-purple-400",
  deal_done: "border-emerald-400/30 bg-emerald-500/[0.06] text-emerald-400",
  rejected: "border-zinc-500/30 bg-zinc-500/[0.06] text-zinc-400",
};

export default function NegotiatePage() {
  const [cars, setCars] = useState([]);
  const [sellers, setSellers] = useState({}); // profile id -> profile
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null); // carId currently saving
  const [drafts, setDrafts] = useState({}); // carId -> { notes, price }
  const [query, setQuery] = useState("");

  async function load() {
    setLoading(true);
    // cars_negotiation_queue = auction ended, status != 'sold', zero bids,
    // and not already deal_done/rejected (see negotiation_migration.sql).
    const { data, error } = await supabase
      .from("cars_negotiation_queue")
      .select("*")
      .order("auction_end", { ascending: false });

    if (error) {
      console.error("Error loading negotiation queue:", error.message);
      setCars([]);
      setLoading(false);
      return;
    }

    setCars(data || []);

    const sellerIds = [...new Set((data || []).map((c) => c.created_by).filter(Boolean))];
    if (sellerIds.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone")
        .in("id", sellerIds);
      const map = {};
      (profiles || []).forEach((p) => (map[p.id] = p));
      setSellers(map);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function draftFor(car) {
    return drafts[car.id] ?? { notes: car.negotiation_notes || "", price: car.negotiated_price ?? "" };
  }

  function setDraft(carId, patch) {
    setDrafts((prev) => ({ ...prev, [carId]: { ...draftFor({ id: carId }), ...prev[carId], ...patch } }));
  }

  async function saveStatus(car, status) {
    setSaving(car.id);
    try {
      await updateCar(car.id, { negotiation_status: status, negotiation_updated_at: new Date().toISOString() });
      if (status === "deal_done" || status === "rejected") {
        // Leaves the queue view once closed out.
        setCars((prev) => prev.filter((c) => c.id !== car.id));
      } else {
        setCars((prev) => prev.map((c) => (c.id === car.id ? { ...c, negotiation_status: status } : c)));
      }
    } catch (err) {
      alert(`Couldn't update status: ${err.message}`);
    } finally {
      setSaving(null);
    }
  }

  async function saveNotesAndPrice(car) {
    const draft = draftFor(car);
    setSaving(car.id);
    try {
      await updateCar(car.id, {
        negotiation_notes: draft.notes || null,
        negotiated_price: draft.price === "" ? null : Number(draft.price),
        negotiation_updated_at: new Date().toISOString(),
      });
      setCars((prev) =>
        prev.map((c) =>
          c.id === car.id ? { ...c, negotiation_notes: draft.notes, negotiated_price: draft.price } : c
        )
      );
    } catch (err) {
      alert(`Couldn't save: ${err.message}`);
    } finally {
      setSaving(null);
    }
  }

  const filteredCars = useMemo(() => {
    if (!query.trim()) return cars;
    const q = query.trim().toLowerCase();
    return cars.filter((c) => (c.vehicle_title || "").toLowerCase().includes(q));
  }, [cars, query]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Handshake className="text-amber-400" size={22} />
            Negotiate
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Auction ended, no bid found — reach out to the seller and work a deal directly.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by car name…"
              className="pl-8 pr-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-amber-400/50 w-48"
            />
          </div>
          <button
            onClick={load}
            className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white px-3 py-1.5 rounded-lg border border-white/10"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-zinc-400 text-sm">Loading...</div>
      ) : filteredCars.length === 0 ? (
        <div className="text-zinc-500 text-sm border border-white/10 rounded-xl p-6 text-center">
          {cars.length === 0
            ? "Nothing here right now — every ended auction has a bid or is already closed out."
            : "No cars match your search."}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredCars.map((car) => {
            const seller = sellers[car.created_by];
            const draft = draftFor(car);
            return (
              <div key={car.id} className="border border-white/10 rounded-xl p-5 bg-white/[0.02] space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{car.vehicle_title}</div>
                    <div className="text-xs text-zinc-500 mt-0.5">
                      Channel: {car.channel} · Auction ended: {new Date(car.auction_end).toLocaleString()}
                    </div>
                    <div className="text-xs text-zinc-500">
                      Reserve: ₹{car.reserve_price ?? "—"} · Starting bid: ₹{car.starting_bid ?? "—"}
                    </div>
                  </div>
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full border ${
                      STATUS_STYLES[car.negotiation_status] || STATUS_STYLES.none
                    }`}
                  >
                    {STATUS_OPTIONS.find((s) => s.value === car.negotiation_status)?.label || "Pending"}
                  </span>
                </div>

                {seller && (
                  <div className="flex flex-wrap gap-4 text-sm text-zinc-300">
                    <span>{seller.full_name || "Seller"}</span>
                    {seller.phone && (
                      <a href={`tel:${seller.phone}`} className="flex items-center gap-1 text-amber-400 hover:underline">
                        <Phone size={14} /> {seller.phone}
                      </a>
                    )}
                    {seller.email && (
                      <a href={`mailto:${seller.email}`} className="flex items-center gap-1 text-amber-400 hover:underline">
                        <Mail size={14} /> {seller.email}
                      </a>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {STATUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      disabled={saving === car.id}
                      onClick={() => saveStatus(car, opt.value)}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition disabled:opacity-50 ${
                        car.negotiation_status === opt.value
                          ? "border-amber-400/50 bg-amber-500/10 text-amber-400"
                          : "border-white/10 text-zinc-400 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <div className="grid sm:grid-cols-[1fr_auto] gap-3">
                  <textarea
                    rows={2}
                    placeholder="Negotiation notes (call summary, counter-offer, follow-up date...)"
                    value={draft.notes}
                    onChange={(e) => setDraft(car.id, { notes: e.target.value })}
                    className="w-full rounded-lg bg-zinc-900 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-zinc-600"
                  />
                  <div className="flex flex-col gap-2">
                    <input
                      type="number"
                      placeholder="Negotiated price"
                      value={draft.price}
                      onChange={(e) => setDraft(car.id, { price: e.target.value })}
                      className="rounded-lg bg-zinc-900 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-zinc-600 w-40"
                    />
                    <button
                      disabled={saving === car.id}
                      onClick={() => saveNotesAndPrice(car)}
                      className="text-xs px-3 py-2 rounded-lg bg-amber-500 text-zinc-950 font-medium hover:bg-amber-400 disabled:opacity-50"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}