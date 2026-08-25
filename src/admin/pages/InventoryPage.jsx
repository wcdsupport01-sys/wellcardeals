import { useEffect, useMemo, useState } from "react";
import {
  Gavel, Tag, EyeOff, Eye, Ban, RotateCcw, Loader2, AlertCircle, Search,
  ClipboardCheck, ChevronDown, ChevronUp, UserCheck2, RefreshCw, X,
  ImageOff, Clock, TrendingUp, Download, SortAsc, SortDesc, CheckSquare,
  Square, IndianRupee, Users, Shield,
} from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { supabase } from "../../lib/supabaseClient";
import { fetchCars, updateCar } from "../lib/carsApi";
import { INSPECTION_CATEGORIES, INSPECTION_STATUS_OPTIONS, EMPTY_INSPECTION } from "../lib/lookups";

const INSPECTION_STATUS_DOT = {
  good: "bg-emerald-500",
  fair: "bg-amber-500",
  poor: "bg-red-500",
};

const STATUS_STYLES = {
  draft: "bg-zinc-500/15 text-zinc-400",
  upcoming: "bg-blue-500/15 text-blue-400",
  live: "bg-emerald-500/15 text-emerald-400",
  closed: "bg-zinc-500/15 text-zinc-400",
  sold: "bg-violet-500/15 text-violet-400",
  delisted: "bg-red-500/15 text-red-400",
};

function toLocalInputValue(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function overallInspectionStatus(car) {
  const statuses = Object.values(car.inspection || {}).map((v) => v?.status).filter(Boolean);
  if (statuses.length === 0) return null;
  if (statuses.includes("poor")) return "poor";
  if (statuses.includes("fair")) return "fair";
  return "good";
}

function formatINR(v) {
  if (v == null) return "—";
  return "₹" + Math.round(Number(v)).toLocaleString("en-IN");
}

// Auction timer warning — red if < 24h left
function AuctionTimer({ endTime }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!endTime) return null;
  const diff = new Date(endTime).getTime() - now;
  if (diff <= 0) return <span className="text-[10px] text-zinc-500">Ended</span>;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  const urgent = h < 24;
  return (
    <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${urgent ? "bg-red-500/15 text-red-400" : "bg-zinc-500/10 text-zinc-400"}`}>
      <Clock size={10} />
      {h > 0 ? `${h}h ` : ""}{String(m).padStart(2, "0")}m {String(s).padStart(2, "0")}s
      {urgent && " ⚠️"}
    </span>
  );
}

// ─── Re-list Modal ─────────────────────────────────────────────────────────
function RelistModal({ car, onClose, onConfirm, saving }) {
  const [listingType, setListingType] = useState(car.listing_type || "auction");
  const [auctionEnd, setAuctionEnd] = useState("");
  const [accessType, setAccessType] = useState(car.access_type || "all");
  const [error, setError] = useState("");

  function handleConfirm() {
    if (listingType === "auction" && !auctionEnd) { setError("Please set an auction end date/time."); return; }
    setError("");
    onConfirm({ listingType, auctionEnd, accessType });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <RefreshCw size={16} className="text-emerald-400" />
            <p className="text-white font-bold text-sm">Re-list Car</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white transition"><X size={18} /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <p className="text-zinc-400 text-xs">Re-listing: <span className="text-white font-medium">{car.vehicle_title}</span></p>
          <div>
            <label className="text-xs text-zinc-400 mb-2 block">Listing Type</label>
            <div className="flex items-center gap-2 bg-white/5 rounded-lg p-1">
              <button onClick={() => setListingType("auction")} className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition ${listingType === "auction" ? "bg-blue-600 text-white" : "text-zinc-400 hover:text-white"}`}>
                <Gavel size={13} /> Auction
              </button>
              <button onClick={() => setListingType("buy_now_only")} className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition ${listingType === "buy_now_only" ? "bg-blue-600 text-white" : "text-zinc-400 hover:text-white"}`}>
                <Tag size={13} /> Buy Now
              </button>
            </div>
          </div>
          {listingType === "auction" && (
            <div>
              <label className="text-xs text-zinc-400 mb-1.5 block">New Auction End Date & Time</label>
              <input type="datetime-local" value={auctionEnd} onChange={(e) => setAuctionEnd(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-blue-500/50" />
            </div>
          )}
          <div>
            <label className="text-xs text-zinc-400 mb-1.5 block">Who can see this listing?</label>
            <select value={accessType} onChange={(e) => setAccessType(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-blue-500/50">
              <option value="all" className="bg-zinc-900">Everyone (Buyers + Dealers)</option>
              <option value="dealer_only" className="bg-zinc-900">Dealers Only</option>
            </select>
          </div>
          {error && <p className="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-lg flex items-center gap-1.5"><AlertCircle size={13} /> {error}</p>}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button onClick={onClose} disabled={saving} className="py-2.5 rounded-xl border border-white/10 text-zinc-300 text-sm font-medium hover:bg-white/5 transition disabled:opacity-50">Cancel</button>
            <button onClick={handleConfirm} disabled={saving} className="py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition disabled:opacity-60 flex items-center justify-center gap-2">
              {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : <><RefreshCw size={14} /> Re-list Now</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Price Edit Modal ──────────────────────────────────────────────────────
function PriceModal({ car, onClose, onSave, saving }) {
  const [buyerPrice, setBuyerPrice] = useState(car.base_price_buyer || "");
  const [dealerPrice, setDealerPrice] = useState(car.base_price_dealer || "");
  const [buyNowPrice, setBuyNowPrice] = useState(car.buy_now_price || "");
  const [startingBid, setStartingBid] = useState(car.starting_bid || "");
  const [reservePrice, setReservePrice] = useState(car.reserve_price || "");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <IndianRupee size={16} className="text-amber-400" />
            <p className="text-white font-bold text-sm">Edit Prices</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white transition"><X size={18} /></button>
        </div>
        <div className="px-6 py-5 space-y-3">
          <p className="text-zinc-400 text-xs mb-2">{car.vehicle_title}</p>
          {[
            ["Buyer Base Price", buyerPrice, setBuyerPrice],
            ["Dealer Base Price", dealerPrice, setDealerPrice],
            ["Buy Now Price", buyNowPrice, setBuyNowPrice],
            ["Starting Bid", startingBid, setStartingBid],
            ["Reserve Price", reservePrice, setReservePrice],
          ].map(([label, val, setter]) => (
            <div key={label}>
              <label className="text-xs text-zinc-400 mb-1 block">{label}</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-xs">₹</span>
                <input type="number" value={val} onChange={(e) => setter(e.target.value)}
                  className="w-full pl-7 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-blue-500/50" />
              </div>
            </div>
          ))}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button onClick={onClose} className="py-2.5 rounded-xl border border-white/10 text-zinc-300 text-sm font-medium hover:bg-white/5 transition">Cancel</button>
            <button disabled={saving} onClick={() => onSave({ base_price_buyer: buyerPrice || null, base_price_dealer: dealerPrice || null, buy_now_price: buyNowPrice || null, starting_bid: startingBid || null, reserve_price: reservePrice || null })}
              className="py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-sm font-semibold transition disabled:opacity-60 flex items-center justify-center gap-2">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <IndianRupee size={14} />} Save Prices
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function InventoryPage() {
  const { role, user: currentUser } = useAuth();
  const canEdit = role === "admin" || role === "manager";

  const [cars, setCars] = useState([]);
  const [staff, setStaff] = useState([]);
  const [bidCounts, setBidCounts] = useState({}); // { car_id: count }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [notice, setNotice] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortField, setSortField] = useState("created_at");
  const [sortDir, setSortDir] = useState("desc");
  const [expandedId, setExpandedId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [relistCar, setRelistCar] = useState(null);
  const [priceCar, setPriceCar] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkAction, setBulkAction] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [carsData, { data: staffData }, { data: bidsData }] = await Promise.all([
        fetchCars(),
        supabase.from("profiles").select("id, full_name, role").in("role", ["admin", "manager"]),
        supabase.from("car_bids").select("car_id"),
      ]);
      setCars(carsData || []);
      setStaff(staffData || []);
      // Count bids per car
      const counts = {};
      (bidsData || []).forEach(({ car_id }) => { counts[car_id] = (counts[car_id] || 0) + 1; });
      setBidCounts(counts);
    } catch (err) {
      setError(err.message || "Couldn't load inventory.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function patchCar(id, payload, successText) {
    if (!canEdit) return;
    setSavingId(id);
    setNotice(null);
    try {
      const updated = await updateCar(id, payload);
      setCars((prev) => prev.map((c) => (c.id === id ? { ...c, ...updated } : c)));
      setNotice({ id, text: successText, isError: false });
    } catch (err) {
      setNotice({ id, text: err.message || "Couldn't save that change.", isError: true });
    } finally {
      setSavingId(null);
    }
  }

  function setListingType(car, listing_type) {
    if (listing_type === "buy_now_only" && !car.buy_now_price) {
      setNotice({ id: car.id, text: "Set a Buy Now price for this car first.", isError: true });
      return;
    }
    patchCar(car.id, { listing_type }, "Selling strategy updated.");
  }

  function setLiveUntil(car, value) {
    patchCar(car.id, { auction_end: value ? new Date(value).toISOString() : null }, "Live duration updated.");
  }

  function toggleVisibility(car) {
    const next = car.visibility === "hidden" ? "visible" : "hidden";
    patchCar(car.id, { visibility: next }, next === "hidden" ? "Hidden from marketplace." : "Visible again.");
  }

  function setAccessType(car, accessType) {
    patchCar(car.id, { access_type: accessType }, accessType === "dealer_only" ? "Now dealer-only." : "Now visible to everyone.");
  }

  function delist(car) {
    patchCar(car.id, { status: "delisted" }, "Permanently delisted.");
  }

  async function confirmRelist({ listingType, auctionEnd, accessType }) {
    const car = relistCar;
    await patchCar(car.id, {
      status: "live", listing_type: listingType, access_type: accessType,
      visibility: "visible",
      auction_end: listingType === "auction" && auctionEnd ? new Date(auctionEnd).toISOString() : null,
    }, "Car re-listed successfully!");
    setRelistCar(null);
  }

  async function savePrices(payload) {
    await patchCar(priceCar.id, payload, "Prices updated.");
    setPriceCar(null);
  }

  function staffName(id) {
    if (!id) return null;
    return staff.find((s) => s.id === id)?.full_name || "Unknown";
  }

  function claimCar(car) { patchCar(car.id, { handled_by: currentUser?.id }, "You're now handling this car."); }
  function reassignCar(car, newHandlerId) {
    if (!newHandlerId) return;
    patchCar(car.id, { handled_by: newHandlerId }, `Reassigned to ${staffName(newHandlerId)}.`);
  }

  function toggleInspectionPanel(car) {
    if (expandedId === car.id) { setExpandedId(null); setDraft(null); return; }
    setExpandedId(car.id);
    setDraft({ inspection: { ...EMPTY_INSPECTION, ...(car.inspection || {}) }, inspection_notes: car.inspection_notes || "" });
  }

  function setDraftCategory(key, field, value) {
    setDraft((d) => ({
      ...d,
      inspection: {
        ...d.inspection,
        [key]: field === "status" && !value ? null : { ...(d.inspection[key] || {}), [field]: value },
      },
    }));
  }

  async function saveInspection(carId) {
    await patchCar(carId, { inspection: draft.inspection, inspection_notes: draft.inspection_notes }, "Inspection report updated.");
    setExpandedId(null);
    setDraft(null);
  }

  // Sorting
  function toggleSort(field) {
    if (sortField === field) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
  }

  // Bulk actions
  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectAll() {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map((c) => c.id)));
  }

  async function applyBulkAction() {
    if (!bulkAction || selectedIds.size === 0) return;
    setBulkSaving(true);
    const ids = [...selectedIds];
    const payloadMap = {
      hide: { visibility: "hidden" },
      unhide: { visibility: "visible" },
      delist: { status: "delisted" },
      dealer_only: { access_type: "dealer_only" },
      all_access: { access_type: "all" },
    };
    const payload = payloadMap[bulkAction];
    if (!payload) { setBulkSaving(false); return; }
    try {
      await Promise.all(ids.map((id) => updateCar(id, payload)));
      setCars((prev) => prev.map((c) => ids.includes(c.id) ? { ...c, ...payload } : c));
      setSelectedIds(new Set());
      setBulkAction("");
    } catch (err) {
      console.error(err);
    } finally {
      setBulkSaving(false);
    }
  }

  // CSV Export
  function exportCSV() {
    const headers = ["Title", "Status", "Listing Type", "Access Type", "Buyer Price", "Dealer Price", "Buy Now", "Bids", "Auction End"];
    const rows = filtered.map((c) => [
      c.vehicle_title || "",
      c.status || "",
      c.listing_type || "",
      c.access_type || "",
      c.base_price_buyer || "",
      c.base_price_dealer || "",
      c.buy_now_price || "",
      bidCounts[c.id] || 0,
      c.auction_end || "",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "inventory.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  const filtered = useMemo(() => {
    let list = cars;
    if (statusFilter !== "all") list = list.filter((c) => c.status === statusFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((c) => (c.vehicle_title || "").toLowerCase().includes(q));
    }
    list = [...list].sort((a, b) => {
      let av = a[sortField], bv = b[sortField];
      if (sortField === "bids") { av = bidCounts[a.id] || 0; bv = bidCounts[b.id] || 0; }
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === "asc" ? av - bv : bv - av;
    });
    return list;
  }, [cars, statusFilter, search, sortField, sortDir, bidCounts]);

  function canRelist(car) { return ["closed", "delisted", "draft"].includes(car.status); }

  function SortBtn({ field, label }) {
    const active = sortField === field;
    return (
      <button onClick={() => toggleSort(field)} className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition ${active ? "text-blue-400 bg-blue-500/10" : "text-zinc-500 hover:text-zinc-300"}`}>
        {label}
        {active ? (sortDir === "asc" ? <SortAsc size={12} /> : <SortDesc size={12} />) : <SortAsc size={12} className="opacity-30" />}
      </button>
    );
  }

  return (
    <div>
      {relistCar && <RelistModal car={relistCar} onClose={() => setRelistCar(null)} onConfirm={confirmRelist} saving={savingId === relistCar.id} />}
      {priceCar && <PriceModal car={priceCar} onClose={() => setPriceCar(null)} onSave={savePrices} saving={savingId === priceCar.id} />}

      <div className="flex items-start justify-between gap-4 flex-wrap mb-1">
        <h1 className="text-2xl font-semibold text-white">Inventory</h1>
        <button onClick={exportCSV} className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-white border border-white/10 px-3 py-1.5 rounded-lg transition">
          <Download size={13} /> Export CSV
        </button>
      </div>
      <p className="text-sm text-zinc-400 mb-6">
        {canEdit ? "Set each car's selling strategy, live countdown, and marketplace visibility." : "Read-only view of inventory."}
      </p>

      {/* Search + Filter + Sort */}
      <div className="flex flex-col sm:flex-row gap-3 mb-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by title…"
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-blue-500/50" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-blue-500/50">
          <option value="all">All statuses</option>
          {Object.keys(STATUS_STYLES).map((s) => <option key={s} value={s} className="bg-zinc-900">{s}</option>)}
        </select>
      </div>

      {/* Sort bar */}
      <div className="flex items-center gap-1 mb-4 flex-wrap">
        <span className="text-xs text-zinc-600 mr-1">Sort:</span>
        <SortBtn field="created_at" label="Date" />
        <SortBtn field="base_price_buyer" label="Buyer Price" />
        <SortBtn field="base_price_dealer" label="Dealer Price" />
        <SortBtn field="status" label="Status" />
        <SortBtn field="bids" label="Bids" />
        <SortBtn field="auction_end" label="Ends" />
      </div>

      {/* Bulk actions bar */}
      {canEdit && filtered.length > 0 && (
        <div className="flex items-center gap-3 mb-4 p-3 bg-white/5 rounded-xl border border-white/10">
          <button onClick={selectAll} className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition">
            {selectedIds.size === filtered.length && filtered.length > 0 ? <CheckSquare size={14} className="text-blue-400" /> : <Square size={14} />}
            {selectedIds.size === filtered.length && filtered.length > 0 ? "Deselect All" : "Select All"}
          </button>
          {selectedIds.size > 0 && (
            <>
              <span className="text-xs text-zinc-500">{selectedIds.size} selected</span>
              <select value={bulkAction} onChange={(e) => setBulkAction(e.target.value)}
                className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-white focus:outline-none">
                <option value="" className="bg-zinc-900">Bulk action…</option>
                <option value="hide" className="bg-zinc-900">Hide</option>
                <option value="unhide" className="bg-zinc-900">Unhide</option>
                <option value="delist" className="bg-zinc-900">Delist</option>
                <option value="dealer_only" className="bg-zinc-900">Set Dealer Only</option>
                <option value="all_access" className="bg-zinc-900">Set All Access</option>
              </select>
              <button onClick={applyBulkAction} disabled={!bulkAction || bulkSaving}
                className="flex items-center gap-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition">
                {bulkSaving ? <Loader2 size={12} className="animate-spin" /> : null} Apply
              </button>
            </>
          )}
        </div>
      )}

      {loading ? <p className="text-sm text-zinc-500">Loading…</p>
        : error ? <p className="text-sm text-red-400 flex items-center gap-2"><AlertCircle size={14} /> {error}</p>
        : filtered.length === 0 ? <p className="text-sm text-zinc-500">No cars match.</p>
        : (
          <div className="space-y-3">
            {filtered.map((car) => {
              const cover = car.thumbnail_url || (Array.isArray(car.images) && car.images[0]);
              const bids = bidCounts[car.id] || 0;
              const isUrgent = car.auction_end && car.status === "live" && (new Date(car.auction_end) - Date.now()) < 86400000;

              return (
                <div key={car.id} className={`border rounded-xl p-4 bg-white/[0.02] transition ${selectedIds.has(car.id) ? "border-blue-500/40 bg-blue-500/5" : isUrgent ? "border-red-500/30" : "border-white/10"}`}>
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">

                    {/* Left: Checkbox + Thumbnail + Info */}
                    <div className="flex items-start gap-3 min-w-0">
                      {/* Checkbox */}
                      {canEdit && (
                        <button onClick={() => toggleSelect(car.id)} className="mt-1 shrink-0">
                          {selectedIds.has(car.id)
                            ? <CheckSquare size={16} className="text-blue-400" />
                            : <Square size={16} className="text-zinc-600 hover:text-zinc-400" />}
                        </button>
                      )}

                      {/* Thumbnail */}
                      <div className="h-16 w-20 rounded-lg overflow-hidden bg-white/5 border border-white/10 shrink-0 flex items-center justify-center">
                        {cover
                          ? <img src={cover} alt="" className="h-full w-full object-cover" />
                          : <ImageOff size={18} className="text-zinc-600" />}
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-white truncate">{car.vehicle_title || "Untitled"}</p>
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_STYLES[car.status] || "bg-zinc-500/15 text-zinc-400"}`}>{car.status}</span>
                          {car.visibility === "hidden" && (
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 flex items-center gap-1"><EyeOff size={11} /> Hidden</span>
                          )}
                          {car.access_type === "dealer_only" && (
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-400 flex items-center gap-1"><Shield size={11} /> Dealer Only</span>
                          )}
                          {car.inspected_at ? (
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 flex items-center gap-1.5 capitalize">
                              <span className={`w-1.5 h-1.5 rounded-full ${INSPECTION_STATUS_DOT[overallInspectionStatus(car)] || "bg-zinc-500"}`} />
                              {overallInspectionStatus(car) || "Inspected"}
                            </span>
                          ) : (
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-zinc-600/20 text-zinc-500">Not inspected</span>
                          )}
                          {/* Auction timer */}
                          {car.status === "live" && car.auction_end && <AuctionTimer endTime={car.auction_end} />}
                        </div>

                        {/* Price row */}
                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                          <span className="text-xs text-zinc-500">
                            {car.listing_type === "buy_now_only" ? "Buy Now" : "Auction"}
                          </span>
                          {car.base_price_buyer && <span className="text-xs text-zinc-400">Buyer: <span className="text-white font-medium">{formatINR(car.base_price_buyer)}</span></span>}
                          {car.base_price_dealer && <span className="text-xs text-zinc-400">Dealer: <span className="text-white font-medium">{formatINR(car.base_price_dealer)}</span></span>}
                          {car.buy_now_price && <span className="text-xs text-zinc-400">Buy Now: <span className="text-white font-medium">{formatINR(car.buy_now_price)}</span></span>}
                          {/* Bid count */}
                          {bids > 0 && (
                            <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">
                              <TrendingUp size={10} /> {bids} bid{bids !== 1 ? "s" : ""}
                            </span>
                          )}
                        </div>

                        {/* Handled by */}
                        <div className="flex items-center gap-2 mt-1.5">
                          <UserCheck2 size={12} className="text-zinc-500 shrink-0" />
                          {car.handled_by ? (
                            <span className="text-xs text-zinc-400">
                              Handling: <span className="text-zinc-200 font-medium">{staffName(car.handled_by)}</span>
                              {car.handled_by === currentUser?.id && <span className="text-emerald-400"> (you)</span>}
                            </span>
                          ) : <span className="text-xs text-zinc-500">Nobody handling this</span>}
                          {canEdit && car.handled_by !== currentUser?.id && (
                            <button disabled={savingId === car.id} onClick={() => claimCar(car)} className="text-xs font-semibold text-blue-400 hover:underline disabled:opacity-50">Claim</button>
                          )}
                          {canEdit && staff.length > 1 && (
                            <select disabled={savingId === car.id} value="" onChange={(e) => reassignCar(car, e.target.value)}
                              className="text-xs bg-transparent text-zinc-500 hover:text-zinc-300 focus:outline-none disabled:opacity-50">
                              <option value="" className="bg-zinc-900">Reassign to…</option>
                              {staff.filter((s) => s.id !== car.handled_by).map((s) => (
                                <option key={s.id} value={s.id} className="bg-zinc-900">{s.full_name} ({s.role})</option>
                              ))}
                            </select>
                          )}
                        </div>

                        {notice?.id === car.id && (
                          <p className={`text-xs mt-1 ${notice.isError ? "text-red-400" : "text-emerald-400"}`}>{notice.text}</p>
                        )}
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0 lg:flex-col lg:items-end">
                      {/* Row 1: Strategy + Access */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Listing type toggle — live cars */}
                        {car.status === "live" && (
                          <div className="flex items-center gap-1 bg-white/5 rounded-lg p-0.5">
                            <button disabled={!canEdit || savingId === car.id} onClick={() => setListingType(car, "auction")}
                              className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-medium transition disabled:cursor-default ${car.listing_type !== "buy_now_only" ? "bg-blue-600 text-white" : "text-zinc-400 hover:text-white"}`}>
                              <Gavel size={11} /> Auction
                            </button>
                            <button disabled={!canEdit || savingId === car.id} onClick={() => setListingType(car, "buy_now_only")}
                              className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-medium transition disabled:cursor-default ${car.listing_type === "buy_now_only" ? "bg-blue-600 text-white" : "text-zinc-400 hover:text-white"}`}>
                              <Tag size={11} /> Buy Now
                            </button>
                          </div>
                        )}

                        {/* Access type toggle */}
                        {canEdit && (
                          <div className="flex items-center gap-1 bg-white/5 rounded-lg p-0.5">
                            <button disabled={savingId === car.id} onClick={() => setAccessType(car, "all")}
                              className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-medium transition ${car.access_type !== "dealer_only" ? "bg-purple-600 text-white" : "text-zinc-400 hover:text-white"}`}>
                              <Users size={11} /> All
                            </button>
                            <button disabled={savingId === car.id} onClick={() => setAccessType(car, "dealer_only")}
                              className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-medium transition ${car.access_type === "dealer_only" ? "bg-purple-600 text-white" : "text-zinc-400 hover:text-white"}`}>
                              <Shield size={11} /> Dealer
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Row 2: Live until + Price edit */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {["live", "upcoming"].includes(car.status) && (
                          <label className="flex flex-col text-xs text-zinc-500 gap-0.5">
                            Live until
                            <input type="datetime-local" disabled={!canEdit || savingId === car.id}
                              defaultValue={toLocalInputValue(car.auction_end)}
                              onBlur={(e) => { if (e.target.value !== toLocalInputValue(car.auction_end)) setLiveUntil(car, e.target.value); }}
                              className="px-2 py-1.5 rounded-md bg-white/5 border border-white/10 text-xs text-white disabled:opacity-60 focus:outline-none focus:border-blue-500/50" />
                          </label>
                        )}
                        {/* Edit Prices */}
                        {canEdit && (
                          <button onClick={() => setPriceCar(car)} disabled={savingId === car.id}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border border-amber-400/30 text-amber-400 hover:bg-amber-500/10 disabled:opacity-50 transition">
                            <IndianRupee size={13} /> Prices
                          </button>
                        )}
                      </div>

                      {/* Row 3: Re-list / Hide / Delist / Inspect */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {canEdit && canRelist(car) && (
                          <button disabled={savingId === car.id} onClick={() => setRelistCar(car)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold border border-emerald-400/30 text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-50 transition">
                            {savingId === car.id ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Re-list
                          </button>
                        )}
                        <button disabled={!canEdit || savingId === car.id} onClick={() => toggleVisibility(car)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border border-white/10 text-zinc-300 hover:bg-white/5 disabled:opacity-50 disabled:cursor-default">
                          {car.visibility === "hidden" ? <Eye size={13} /> : <EyeOff size={13} />}
                          {car.visibility === "hidden" ? "Unhide" : "Hide"}
                        </button>
                        {canEdit && !["delisted", "draft"].includes(car.status) && (
                          <button disabled={savingId === car.id} onClick={() => delist(car)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-red-600 hover:bg-red-500 text-white disabled:opacity-50 transition">
                            {savingId === car.id ? <Loader2 size={13} className="animate-spin" /> : <Ban size={13} />} Delist
                          </button>
                        )}
                        <button disabled={savingId === car.id} onClick={() => toggleInspectionPanel(car)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border border-white/10 text-zinc-300 hover:bg-white/5 disabled:opacity-50">
                          <ClipboardCheck size={13} />
                          {canEdit ? "Inspect" : "View"}
                          {expandedId === car.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Inspection Panel */}
                  {expandedId === car.id && draft && (
                    <div className="mt-4 pt-4 border-t border-white/10 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {INSPECTION_CATEGORIES.map(({ key, label }) => (
                        <div key={key}>
                          <p className="text-xs text-zinc-400 mb-1">{label}</p>
                          <select disabled={!canEdit} value={draft.inspection[key]?.status || ""} onChange={(e) => setDraftCategory(key, "status", e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-md bg-white/5 border border-white/10 text-xs text-white disabled:opacity-60 focus:outline-none focus:border-blue-500/50">
                            {INSPECTION_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value} className="bg-zinc-900">{o.label}</option>)}
                          </select>
                          {draft.inspection[key]?.status && (
                            <input disabled={!canEdit} value={draft.inspection[key]?.note || ""} onChange={(e) => setDraftCategory(key, "note", e.target.value)} placeholder="Note (optional)"
                              className="w-full mt-1.5 px-2.5 py-1.5 rounded-md bg-white/5 border border-white/10 text-xs text-white disabled:opacity-60 focus:outline-none focus:border-blue-500/50" />
                          )}
                        </div>
                      ))}
                      <div className="sm:col-span-2 lg:col-span-3">
                        <p className="text-xs text-zinc-400 mb-1">Overall notes</p>
                        <textarea disabled={!canEdit} rows={2} value={draft.inspection_notes} onChange={(e) => setDraft((d) => ({ ...d, inspection_notes: e.target.value }))}
                          className="w-full px-2.5 py-1.5 rounded-md bg-white/5 border border-white/10 text-xs text-white disabled:opacity-60 focus:outline-none focus:border-blue-500/50" />
                      </div>
                      {canEdit && (
                        <div className="sm:col-span-2 lg:col-span-3 flex justify-end">
                          <button onClick={() => saveInspection(car.id)} disabled={savingId === car.id}
                            className="flex items-center gap-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white px-3.5 py-2 rounded-lg transition">
                            {savingId === car.id && <Loader2 size={13} className="animate-spin" />} Save Inspection Report
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
    </div>
  );
}