
import { useEffect, useMemo, useState } from "react";
import {
  Gavel, Tag, EyeOff, Eye, Ban, Loader2, AlertCircle,
  Search, ClipboardCheck, ChevronDown, ChevronUp,
  UserCheck2, RefreshCw, X, ImageOff, Clock,
  TrendingUp, Download, SortAsc, SortDesc,
  CheckSquare, Square, IndianRupee, Users, Shield,
} from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { supabase } from "../../lib/supabaseClient";
import { fetchCars, updateCar } from "../lib/carsApi";
import {
  INSPECTION_CATEGORIES,
  INSPECTION_STATUS_OPTIONS,
  EMPTY_INSPECTION,
} from "../lib/lookups";

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

function formatINR(value) {
  if (value == null) return "—";
  return "₹" + Math.round(Number(value)).toLocaleString("en-IN");
}

function toLocalInputValue(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function overallInspectionStatus(car) {
  const statuses = Object.values(car.inspection || {})
    .map((value) => value?.status)
    .filter(Boolean);

  if (!statuses.length) return null;
  if (statuses.includes("poor")) return "poor";
  if (statuses.includes("fair")) return "fair";
  return "good";
}

// C2C is available ONLY for public Buy Now listings.
// Dealer-channel cars are never eligible.
function isC2CEligible(car) {
  return (
    car?.channel !== "dealer" &&
    car?.access_type === "all" &&
    car?.listing_type === "buy_now_only"
  );
}

function AuctionTimer({ endTime }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!endTime) return null;

  const diff = new Date(endTime).getTime() - now;
  if (diff <= 0) {
    return <span className="text-[10px] text-zinc-500">Ended</span>;
  }

  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  const urgent = hours < 24;

  return (
    <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
      urgent
        ? "bg-red-500/15 text-red-400"
        : "bg-zinc-500/10 text-zinc-400"
    }`}>
      <Clock size={10} />
      {hours > 0 ? `${hours}h ` : ""}
      {String(minutes).padStart(2, "0")}m{" "}
      {String(seconds).padStart(2, "0")}s
      {urgent && " ⚠️"}
    </span>
  );
}

function RelistModal({ car, onClose, onConfirm, saving }) {
  const [listingType, setListingType] = useState(
    car.listing_type || "auction"
  );
  const [auctionEnd, setAuctionEnd] = useState("");
  const [accessType, setAccessType] = useState(
    car.access_type || "all"
  );
  const [error, setError] = useState("");

  function handleConfirm() {
    if (listingType === "auction" && !auctionEnd) {
      setError("Please set an auction end date/time.");
      return;
    }

    setError("");
    onConfirm({ listingType, auctionEnd, accessType });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-full max-w-md bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <RefreshCw size={16} className="text-emerald-400" />
            <p className="text-white font-bold text-sm">Re-list Car</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <p className="text-zinc-400 text-xs">
            Re-listing:{" "}
            <span className="text-white font-medium">
              {car.vehicle_title}
            </span>
          </p>

          <div>
            <label className="text-xs text-zinc-400 mb-2 block">
              Listing Type
            </label>

            <div className="flex items-center gap-2 bg-white/5 rounded-lg p-1">
              <button
                onClick={() => setListingType("auction")}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium ${
                  listingType === "auction"
                    ? "bg-blue-600 text-white"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <Gavel size={13} /> Auction
              </button>

              <button
                onClick={() => setListingType("buy_now_only")}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium ${
                  listingType === "buy_now_only"
                    ? "bg-blue-600 text-white"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <Tag size={13} /> Buy Now
              </button>
            </div>
          </div>

          {listingType === "auction" && (
            <div>
              <label className="text-xs text-zinc-400 mb-1.5 block">
                New Auction End Date & Time
              </label>
              <input
                type="datetime-local"
                value={auctionEnd}
                onChange={(e) => setAuctionEnd(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white"
              />
            </div>
          )}

          <div>
            <label className="text-xs text-zinc-400 mb-1.5 block">
              Who can see this listing?
            </label>
            <select
              value={accessType}
              onChange={(e) => setAccessType(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-zinc-800 border border-white/10 text-sm text-white"
            >
              <option value="all">Everyone (Buyers + Dealers)</option>
              <option value="dealer_only">Dealers Only</option>
            </select>
          </div>

          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}

          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              onClick={onClose}
              disabled={saving}
              className="py-2.5 rounded-xl border border-white/10 text-zinc-300 text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={saving}
              className="py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold disabled:opacity-60"
            >
              {saving ? "Saving…" : "Re-list Now"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PriceModal({
  car,
  onClose,
  onSave,
  saving,
  bidCount,
}) {
  const [buyerPrice, setBuyerPrice] = useState(
    car.base_price_buyer || ""
  );
  const [dealerPrice, setDealerPrice] = useState(
    car.base_price_dealer || ""
  );
  const [buyNowPrice, setBuyNowPrice] = useState(
    car.buy_now_price || ""
  );
  const [startingBid, setStartingBid] = useState(
    car.starting_bid || ""
  );
  const [reservePrice, setReservePrice] = useState(
    car.reserve_price || ""
  );

  function handleSave() {
    const payload = {
      base_price_buyer: buyerPrice || null,
      base_price_dealer: dealerPrice || null,
      buy_now_price: buyNowPrice || null,
      starting_bid: startingBid || null,
      reserve_price: reservePrice || null,
    };

    if (!bidCount) {
      payload.current_bid_buyer = buyerPrice || null;
      payload.current_bid_dealer = dealerPrice || null;
    }

    onSave(payload);
  }

  const fields = [
    ["Buyer Base Price", buyerPrice, setBuyerPrice],
    ["Dealer Base Price", dealerPrice, setDealerPrice],
    ["Buy Now Price", buyNowPrice, setBuyNowPrice],
    ["Starting Bid", startingBid, setStartingBid],
    ["Reserve Price", reservePrice, setReservePrice],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-full max-w-md bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <IndianRupee size={16} className="text-amber-400" />
            <p className="text-white font-bold text-sm">Edit Prices</p>
          </div>
          <button onClick={onClose} className="text-zinc-400">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-3">
          <p className="text-zinc-400 text-xs">
            {car.vehicle_title}
          </p>

          {!bidCount ? (
            <p className="text-[11px] text-amber-300 bg-amber-500/10 rounded-lg px-3 py-2">
              No bids yet — live prices will update with base prices.
            </p>
          ) : (
            <p className="text-[11px] text-zinc-400 bg-white/5 rounded-lg px-3 py-2">
              This car has {bidCount} bids. Current live bids will not be changed.
            </p>
          )}

          {fields.map(([label, value, setter]) => (
            <div key={label}>
              <label className="text-xs text-zinc-400 mb-1 block">
                {label}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-xs">
                  ₹
                </span>
                <input
                  type="number"
                  value={value}
                  onChange={(e) => setter(e.target.value)}
                  className="w-full pl-7 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white"
                />
              </div>
            </div>
          ))}

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              onClick={onClose}
              className="py-2.5 rounded-xl border border-white/10 text-zinc-300 text-sm"
            >
              Cancel
            </button>
            <button
              disabled={saving}
              onClick={handleSave}
              className="py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-sm font-semibold disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save Prices"}
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
  const [bidCounts, setBidCounts] = useState({});
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
      const [
        carsData,
        { data: staffData },
        { data: bidsData },
      ] = await Promise.all([
        fetchCars(),
        supabase
          .from("profiles")
          .select("id, full_name, role")
          .in("role", ["admin", "manager"]),
        supabase.from("car_bids").select("car_id"),
      ]);

      setCars(carsData || []);
      setStaff(staffData || []);

      const counts = {};
      (bidsData || []).forEach(({ car_id }) => {
        counts[car_id] = (counts[car_id] || 0) + 1;
      });
      setBidCounts(counts);
    } catch (err) {
      setError(err.message || "Couldn't load inventory.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function patchCar(id, payload, successText) {
    if (!canEdit) return false;

    setSavingId(id);
    setNotice(null);

    try {
      const updated = await updateCar(id, payload);

      setCars((prev) =>
        prev.map((car) =>
          car.id === id ? { ...car, ...updated } : car
        )
      );

      setNotice({
        id,
        text: successText,
        isError: false,
      });

      return true;
    } catch (err) {
      setNotice({
        id,
        text: err.message || "Couldn't save that change.",
        isError: true,
      });
      return false;
    } finally {
      setSavingId(null);
    }
  }

  // C2C ON/OFF for eligible Buy Now cars only.
  async function toggleC2C(car) {
    if (!canEdit) return;

    if (!isC2CEligible(car)) {
      setNotice({
        id: car.id,
        text: "C2C is allowed only on public Buy Now listings, not dealer auctions.",
        isError: true,
      });
      return;
    }

    const nextValue = car.c2c_enabled !== true;

    await patchCar(
      car.id,
      { c2c_enabled: nextValue },
      nextValue
        ? "C2C enabled for this car."
        : "C2C disabled for this car."
    );
  }

  function setListingType(car, listing_type) {
    if (listing_type === "buy_now_only" && !car.buy_now_price) {
      setNotice({
        id: car.id,
        text: "Set a Buy Now price for this car first.",
        isError: true,
      });
      return;
    }

    const payload = { listing_type };

    if (listing_type !== "buy_now_only") {
      payload.c2c_enabled = false;
    }

    patchCar(car.id, payload, "Selling strategy updated.");
  }

  function setLiveUntil(car, value) {
    patchCar(
      car.id,
      {
        auction_end: value
          ? new Date(value).toISOString()
          : null,
      },
      "Live duration updated."
    );
  }

  function toggleVisibility(car) {
    const next =
      car.visibility === "hidden" ? "visible" : "hidden";

    patchCar(
      car.id,
      { visibility: next },
      next === "hidden"
        ? "Hidden from marketplace."
        : "Visible again."
    );
  }

  function setAccessType(car, accessType) {
    const payload = { access_type: accessType };

    if (accessType === "dealer_only") {
      payload.c2c_enabled = false;
    }

    patchCar(
      car.id,
      payload,
      accessType === "dealer_only"
        ? "Now dealer-only. C2C disabled."
        : "Now visible to everyone."
    );
  }

  function delist(car) {
    patchCar(
      car.id,
      { status: "delisted", c2c_enabled: false },
      "Permanently delisted."
    );
  }

  async function confirmRelist({
    listingType,
    auctionEnd,
    accessType,
  }) {
    if (!relistCar) return;

    const car = relistCar;

    const success = await patchCar(
      car.id,
      {
        status: "live",
        listing_type: listingType,
        access_type: accessType,
        visibility: "visible",
        c2c_enabled:
          listingType === "buy_now_only" &&
          accessType === "all" &&
          car.channel !== "dealer"
            ? car.c2c_enabled === true
            : false,
        auction_end:
          listingType === "auction" && auctionEnd
            ? new Date(auctionEnd).toISOString()
            : null,
      },
      "Car re-listed successfully!"
    );

    if (success) setRelistCar(null);
  }

  async function savePrices(payload) {
    if (!priceCar) return;

    const success = await patchCar(
      priceCar.id,
      payload,
      "Prices updated."
    );

    if (success) setPriceCar(null);
  }

  function staffName(id) {
    if (!id) return null;

    return (
      staff.find((person) => person.id === id)?.full_name ||
      "Unknown"
    );
  }

  function claimCar(car) {
    patchCar(
      car.id,
      { handled_by: currentUser?.id },
      "You're now handling this car."
    );
  }

  function reassignCar(car, newHandlerId) {
    if (!newHandlerId) return;

    patchCar(
      car.id,
      { handled_by: newHandlerId },
      `Reassigned to ${staffName(newHandlerId)}.`
    );
  }

  function toggleInspectionPanel(car) {
    if (expandedId === car.id) {
      setExpandedId(null);
      setDraft(null);
      return;
    }

    setExpandedId(car.id);
    setDraft({
      inspection: {
        ...EMPTY_INSPECTION,
        ...(car.inspection || {}),
      },
      inspection_notes: car.inspection_notes || "",
    });
  }

  function setDraftCategory(key, field, value) {
    setDraft((previous) => ({
      ...previous,
      inspection: {
        ...previous.inspection,
        [key]:
          field === "status" && !value
            ? null
            : {
                ...(previous.inspection[key] || {}),
                [field]: value,
              },
      },
    }));
  }

  async function saveInspection(carId) {
    if (!draft) return;

    const success = await patchCar(
      carId,
      {
        inspection: draft.inspection,
        inspection_notes: draft.inspection_notes,
      },
      "Inspection report updated."
    );

    if (success) {
      setExpandedId(null);
      setDraft(null);
    }
  }

  function toggleSort(field) {
    if (sortField === field) {
      setSortDir((direction) =>
        direction === "asc" ? "desc" : "asc"
      );
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }

  function toggleSelect(id) {
    setSelectedIds((previous) => {
      const next = new Set(previous);

      if (next.has(id)) next.delete(id);
      else next.add(id);

      return next;
    });
  }

  function selectAll() {
    if (
      filtered.length > 0 &&
      filtered.every((car) => selectedIds.has(car.id))
    ) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((car) => car.id)));
    }
  }

  async function applyBulkAction() {
    if (!bulkAction || selectedIds.size === 0 || !canEdit) {
      return;
    }

    setBulkSaving(true);

    const ids = [...selectedIds];

    const payloadMap = {
      hide: { visibility: "hidden" },
      unhide: { visibility: "visible" },
      delist: {
        status: "delisted",
        c2c_enabled: false,
      },
      dealer_only: {
        access_type: "dealer_only",
        c2c_enabled: false,
      },
      all_access: { access_type: "all" },
    };

    const payload = payloadMap[bulkAction];

    if (!payload) {
      setBulkSaving(false);
      return;
    }

    try {
      await Promise.all(
        ids.map((id) => updateCar(id, payload))
      );

      setCars((previous) =>
        previous.map((car) =>
          ids.includes(car.id)
            ? { ...car, ...payload }
            : car
        )
      );

      setSelectedIds(new Set());
      setBulkAction("");
    } catch (err) {
      setNotice({
        id: ids[0],
        text: err.message || "Bulk update failed.",
        isError: true,
      });
      await load();
    } finally {
      setBulkSaving(false);
    }
  }

  function exportCSV() {
    const headers = [
      "Title",
      "Status",
      "Listing Type",
      "Access Type",
      "C2C Enabled",
      "Buyer Price",
      "Dealer Price",
      "Buy Now",
      "Bids",
      "Auction End",
    ];

    const rows = filtered.map((car) => [
      car.vehicle_title || "",
      car.status || "",
      car.listing_type || "",
      car.access_type || "",
      car.c2c_enabled === true ? "Yes" : "No",
      car.base_price_buyer || "",
      car.base_price_dealer || "",
      car.buy_now_price || "",
      bidCounts[car.id] || 0,
      car.auction_end || "",
    ]);

    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map((value) =>
            `"${String(value ?? "").replace(/"/g, '""')}"`
          )
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = "inventory.csv";
    anchor.click();

    URL.revokeObjectURL(url);
  }

  const filtered = useMemo(() => {
    let list = cars;

    if (statusFilter !== "all") {
      list = list.filter(
        (car) => car.status === statusFilter
      );
    }

    if (search.trim()) {
      const query = search.trim().toLowerCase();

      list = list.filter((car) =>
        (car.vehicle_title || "")
          .toLowerCase()
          .includes(query)
      );
    }

    return [...list].sort((a, b) => {
      let av = a[sortField];
      let bv = b[sortField];

      if (sortField === "bids") {
        av = bidCounts[a.id] || 0;
        bv = bidCounts[b.id] || 0;
      }

      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;

      if (typeof av === "string") {
        return sortDir === "asc"
          ? av.localeCompare(bv)
          : bv.localeCompare(av);
      }

      return sortDir === "asc" ? av - bv : bv - av;
    });
  }, [
    cars,
    statusFilter,
    search,
    sortField,
    sortDir,
    bidCounts,
  ]);

  function canRelist(car) {
    return ["closed", "delisted", "draft"].includes(
      car.status
    );
  }

  function SortBtn({ field, label }) {
    const active = sortField === field;

    return (
      <button
        onClick={() => toggleSort(field)}
        className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition ${
          active
            ? "text-blue-400 bg-blue-500/10"
            : "text-zinc-500 hover:text-zinc-300"
        }`}
      >
        {label}
        {active ? (
          sortDir === "asc" ? (
            <SortAsc size={12} />
          ) : (
            <SortDesc size={12} />
          )
        ) : (
          <SortAsc size={12} className="opacity-30" />
        )}
      </button>
    );
  }

  return (
    <div>
      {relistCar && (
        <RelistModal
          car={relistCar}
          onClose={() => setRelistCar(null)}
          onConfirm={confirmRelist}
          saving={savingId === relistCar.id}
        />
      )}

      {priceCar && (
        <PriceModal
          car={priceCar}
          onClose={() => setPriceCar(null)}
          onSave={savePrices}
          saving={savingId === priceCar.id}
          bidCount={bidCounts[priceCar.id] || 0}
        />
      )}

      <div className="flex items-start justify-between gap-4 flex-wrap mb-1">
        <h1 className="text-2xl font-semibold text-white">
          Inventory
        </h1>

        <button
          onClick={exportCSV}
          className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-white border border-white/10 px-3 py-1.5 rounded-lg transition"
        >
          <Download size={13} />
          Export CSV
        </button>
      </div>

      <p className="text-sm text-zinc-400 mb-6">
        {canEdit
          ? "Manage car listings, prices, inspections, C2C deals and marketplace visibility."
          : "Read-only view of inventory."}
      </p>

      {/* Search and filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-3">
        <div className="relative flex-1 max-w-sm">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title…"
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-zinc-500 focus:outline-none"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-xl bg-zinc-900 border border-white/10 text-sm text-white"
        >
          <option value="all">All statuses</option>
          {Object.keys(STATUS_STYLES).map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      {/* Sorting */}
      <div className="flex items-center gap-1 mb-4 flex-wrap">
        <span className="text-xs text-zinc-600 mr-1">
          Sort:
        </span>
        <SortBtn field="created_at" label="Date" />
        <SortBtn field="base_price_buyer" label="Buyer Price" />
        <SortBtn field="base_price_dealer" label="Dealer Price" />
        <SortBtn field="status" label="Status" />
        <SortBtn field="bids" label="Bids" />
        <SortBtn field="auction_end" label="Ends" />
      </div>

      {/* Bulk actions */}
      {canEdit && filtered.length > 0 && (
        <div className="flex items-center gap-3 mb-4 p-3 bg-white/5 rounded-xl border border-white/10 flex-wrap">
          <button
            onClick={selectAll}
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white"
          >
            {filtered.every((car) =>
              selectedIds.has(car.id)
            ) ? (
              <CheckSquare
                size={14}
                className="text-blue-400"
              />
            ) : (
              <Square size={14} />
            )}
            Select All
          </button>

          {selectedIds.size > 0 && (
            <>
              <span className="text-xs text-zinc-500">
                {selectedIds.size} selected
              </span>

              <select
                value={bulkAction}
                onChange={(e) =>
                  setBulkAction(e.target.value)
                }
                className="px-2 py-1 rounded-lg bg-zinc-900 border border-white/10 text-xs text-white"
              >
                <option value="">Bulk action…</option>
                <option value="hide">Hide</option>
                <option value="unhide">Unhide</option>
                <option value="delist">Delist</option>
                <option value="dealer_only">
                  Set Dealer Only
                </option>
                <option value="all_access">
                  Set All Access
                </option>
              </select>

              <button
                onClick={applyBulkAction}
                disabled={!bulkAction || bulkSaving}
                className="flex items-center gap-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg"
              >
                {bulkSaving && (
                  <Loader2
                    size={12}
                    className="animate-spin"
                  />
                )}
                Apply
              </button>
            </>
          )}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-zinc-500">
          Loading…
        </p>
      ) : error ? (
        <p className="text-sm text-red-400 flex items-center gap-2">
          <AlertCircle size={14} />
          {error}
        </p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No cars match.
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((car) => {
            const cover =
              car.thumbnail_url ||
              (Array.isArray(car.images)
                ? car.images[0]
                : null);

            const bids = bidCounts[car.id] || 0;

            const isUrgent =
              car.auction_end &&
              car.status === "live" &&
              new Date(car.auction_end).getTime() -
                Date.now() <
                86400000;

            const c2cEligible = isC2CEligible(car);
            const c2cOn =
              c2cEligible && car.c2c_enabled === true;
            const saving = savingId === car.id;

            return (
              <div
                key={car.id}
                className={`border rounded-xl p-4 bg-white/[0.02] transition ${
                  selectedIds.has(car.id)
                    ? "border-blue-500/40 bg-blue-500/5"
                    : isUrgent
                    ? "border-red-500/30"
                    : "border-white/10"
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  {/* Car details */}
                  <div className="flex items-start gap-3 min-w-0">
                    {canEdit && (
                      <button
                        onClick={() =>
                          toggleSelect(car.id)
                        }
                        className="mt-1 shrink-0"
                      >
                        {selectedIds.has(car.id) ? (
                          <CheckSquare
                            size={16}
                            className="text-blue-400"
                          />
                        ) : (
                          <Square
                            size={16}
                            className="text-zinc-600"
                          />
                        )}
                      </button>
                    )}

                    <div className="h-16 w-20 rounded-lg overflow-hidden bg-white/5 border border-white/10 shrink-0 flex items-center justify-center">
                      {cover ? (
                        <img
                          src={cover}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <ImageOff
                          size={18}
                          className="text-zinc-600"
                        />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-white">
                          {car.vehicle_title || "Untitled"}
                        </p>

                        <span
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize ${
                            STATUS_STYLES[car.status] ||
                            "bg-zinc-500/15 text-zinc-400"
                          }`}
                        >
                          {car.status}
                        </span>

                        {car.visibility === "hidden" && (
                          <span className="text-[11px] text-amber-400 flex items-center gap-1">
                            <EyeOff size={11} />
                            Hidden
                          </span>
                        )}

                        {car.access_type ===
                          "dealer_only" && (
                          <span className="text-[11px] text-purple-400 flex items-center gap-1">
                            <Shield size={11} />
                            Dealer Only
                          </span>
                        )}

                        {car.inspected_at ? (
                          <span className="text-[11px] text-blue-400 flex items-center gap-1">
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                INSPECTION_STATUS_DOT[
                                  overallInspectionStatus(
                                    car
                                  )
                                ] || "bg-zinc-500"
                              }`}
                            />
                            {overallInspectionStatus(car) ||
                              "Inspected"}
                          </span>
                        ) : (
                          <span className="text-[11px] text-zinc-500">
                            Not inspected
                          </span>
                        )}

                        {car.status === "live" &&
                          car.auction_end && (
                            <AuctionTimer
                              endTime={car.auction_end}
                            />
                          )}
                      </div>

                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        <span className="text-xs text-zinc-500">
                          {car.listing_type ===
                          "buy_now_only"
                            ? "Buy Now"
                            : "Auction"}
                        </span>

                        {car.base_price_buyer && (
                          <span className="text-xs text-zinc-400">
                            Buyer:{" "}
                            <span className="text-white font-medium">
                              {formatINR(
                                car.base_price_buyer
                              )}
                            </span>
                          </span>
                        )}

                        {car.base_price_dealer && (
                          <span className="text-xs text-zinc-400">
                            Dealer:{" "}
                            <span className="text-white font-medium">
                              {formatINR(
                                car.base_price_dealer
                              )}
                            </span>
                          </span>
                        )}

                        {car.buy_now_price && (
                          <span className="text-xs text-zinc-400">
                            Buy Now:{" "}
                            <span className="text-white font-medium">
                              {formatINR(
                                car.buy_now_price
                              )}
                            </span>
                          </span>
                        )}

                        {bids > 0 && (
                          <span className="flex items-center gap-1 text-[11px] text-emerald-400">
                            <TrendingUp size={10} />
                            {bids} bid
                            {bids !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>

                      {/* C2C status */}
                      <div className="mt-2">
                        {c2cEligible ? (
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              c2cOn
                                ? "bg-emerald-500/15 text-emerald-400"
                                : "bg-zinc-500/15 text-zinc-400"
                            }`}
                          >
                            C2C {c2cOn ? "ON" : "OFF"}
                          </span>
                        ) : (
                          <span className="text-[11px] text-zinc-600">
                            C2C not available
                          </span>
                        )}
                      </div>

                      {/* Staff assignment */}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <UserCheck2
                          size={12}
                          className="text-zinc-500"
                        />

                        {car.handled_by ? (
                          <span className="text-xs text-zinc-400">
                            Handling:{" "}
                            <span className="text-zinc-200">
                              {staffName(car.handled_by)}
                            </span>
                            {car.handled_by ===
                              currentUser?.id && (
                              <span className="text-emerald-400">
                                {" "}
                                (you)
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-500">
                            Nobody handling this
                          </span>
                        )}

                        {canEdit &&
                          car.handled_by !==
                            currentUser?.id && (
                            <button
                              disabled={saving}
                              onClick={() =>
                                claimCar(car)
                              }
                              className="text-xs font-semibold text-blue-400 hover:underline disabled:opacity-50"
                            >
                              Claim
                            </button>
                          )}

                        {canEdit && staff.length > 1 && (
                          <select
                            disabled={saving}
                            value=""
                            onChange={(e) =>
                              reassignCar(
                                car,
                                e.target.value
                              )
                            }
                            className="text-xs bg-zinc-900 text-zinc-400 border border-white/10 rounded"
                          >
                            <option value="">
                              Reassign to…
                            </option>
                            {staff
                              .filter(
                                (person) =>
                                  person.id !==
                                  car.handled_by
                              )
                              .map((person) => (
                                <option
                                  key={person.id}
                                  value={person.id}
                                >
                                  {person.full_name} (
                                  {person.role})
                                </option>
                              ))}
                          </select>
                        )}
                      </div>

                      {notice?.id === car.id && (
                        <p
                          className={`text-xs mt-2 ${
                            notice.isError
                              ? "text-red-400"
                              : "text-emerald-400"
                          }`}
                        >
                          {notice.text}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0 lg:flex-col lg:items-end">
                    {/* Listing and access */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {car.status === "live" && (
                        <div className="flex items-center gap-1 bg-white/5 rounded-lg p-0.5">
                          <button
                            disabled={!canEdit || saving}
                            onClick={() =>
                              setListingType(
                                car,
                                "auction"
                              )
                            }
                            className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-medium disabled:opacity-50 ${
                              car.listing_type !==
                              "buy_now_only"
                                ? "bg-blue-600 text-white"
                                : "text-zinc-400 hover:text-white"
                            }`}
                          >
                            <Gavel size={11} />
                            Auction
                          </button>

                          <button
                            disabled={!canEdit || saving}
                            onClick={() =>
                              setListingType(
                                car,
                                "buy_now_only"
                              )
                            }
                            className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-medium disabled:opacity-50 ${
                              car.listing_type ===
                              "buy_now_only"
                                ? "bg-blue-600 text-white"
                                : "text-zinc-400 hover:text-white"
                            }`}
                          >
                            <Tag size={11} />
                            Buy Now
                          </button>
                        </div>
                      )}

                      {canEdit && (
                        <div className="flex items-center gap-1 bg-white/5 rounded-lg p-0.5">
                          <button
                            disabled={saving}
                            onClick={() =>
                              setAccessType(car, "all")
                            }
                            className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-medium ${
                              car.access_type !==
                              "dealer_only"
                                ? "bg-purple-600 text-white"
                                : "text-zinc-400"
                            }`}
                          >
                            <Users size={11} />
                            All
                          </button>

                          <button
                            disabled={saving}
                            onClick={() =>
                              setAccessType(
                                car,
                                "dealer_only"
                              )
                            }
                            className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-medium ${
                              car.access_type ===
                              "dealer_only"
                                ? "bg-purple-600 text-white"
                                : "text-zinc-400"
                            }`}
                          >
                            <Shield size={11} />
                            Dealer
                          </button>
                        </div>
                      )}
                    </div>

                    {/* NEW C2C ON/OFF CONTROL */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {c2cEligible ? (
                        <div className="flex items-center gap-2 border border-amber-500/25 bg-amber-500/5 rounded-lg px-3 py-2">
                          <span className="text-xs font-semibold text-amber-400">
                            C2C Deal
                          </span>

                          <button
                            type="button"
                            disabled={!canEdit || saving}
                            onClick={() =>
                              toggleC2C(car)
                            }
                            aria-pressed={c2cOn}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition disabled:opacity-50 ${
                              c2cOn
                                ? "bg-emerald-600"
                                : "bg-zinc-600"
                            }`}
                            title={
                              c2cOn
                                ? "Turn C2C OFF"
                                : "Turn C2C ON"
                            }
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                                c2cOn
                                  ? "translate-x-6"
                                  : "translate-x-1"
                              }`}
                            />
                          </button>

                          <span
                            className={`text-xs font-bold ${
                              c2cOn
                                ? "text-emerald-400"
                                : "text-zinc-400"
                            }`}
                          >
                            {saving
                              ? "Saving…"
                              : c2cOn
                              ? "ON"
                              : "OFF"}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 border border-white/10 rounded-lg px-3 py-2 opacity-60">
                          <span className="text-xs text-zinc-500">
                            C2C Unavailable
                          </span>
                          <Shield
                            size={13}
                            className="text-zinc-500"
                          />
                        </div>
                      )}
                    </div>

                    {/* Date and price */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {["live", "upcoming"].includes(
                        car.status
                      ) && (
                        <label className="flex flex-col text-xs text-zinc-500 gap-0.5">
                          Live until
                          <input
                            type="datetime-local"
                            disabled={!canEdit || saving}
                            defaultValue={toLocalInputValue(
                              car.auction_end
                            )}
                            onBlur={(e) => {
                              if (
                                e.target.value !==
                                toLocalInputValue(
                                  car.auction_end
                                )
                              ) {
                                setLiveUntil(
                                  car,
                                  e.target.value
                                );
                              }
                            }}
                            className="px-2 py-1.5 rounded-md bg-white/5 border border-white/10 text-xs text-white disabled:opacity-60"
                          />
                        </label>
                      )}

                      {canEdit && (
                        <button
                          onClick={() =>
                            setPriceCar(car)
                          }
                          disabled={saving}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border border-amber-400/30 text-amber-400 hover:bg-amber-500/10 disabled:opacity-50"
                        >
                          <IndianRupee size={13} />
                          Prices
                        </button>
                      )}
                    </div>

                    {/* Other actions */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {canEdit && canRelist(car) && (
                        <button
                          disabled={saving}
                          onClick={() =>
                            setRelistCar(car)
                          }
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold border border-emerald-400/30 text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-50"
                        >
                          <RefreshCw size={13} />
                          Re-list
                        </button>
                      )}

                      <button
                        disabled={!canEdit || saving}
                        onClick={() =>
                          toggleVisibility(car)
                        }
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border border-white/10 text-zinc-300 hover:bg-white/5 disabled:opacity-50"
                      >
                        {car.visibility === "hidden" ? (
                          <Eye size={13} />
                        ) : (
                          <EyeOff size={13} />
                        )}
                        {car.visibility === "hidden"
                          ? "Unhide"
                          : "Hide"}
                      </button>

                      {canEdit &&
                        !["delisted", "draft"].includes(
                          car.status
                        ) && (
                          <button
                            disabled={saving}
                            onClick={() =>
                              delist(car)
                            }
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-red-600 hover:bg-red-500 text-white disabled:opacity-50"
                          >
                            <Ban size={13} />
                            Delist
                          </button>
                        )}

                      <button
                        disabled={saving}
                        onClick={() =>
                          toggleInspectionPanel(car)
                        }
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border border-white/10 text-zinc-300 hover:bg-white/5 disabled:opacity-50"
                      >
                        <ClipboardCheck size={13} />
                        {canEdit ? "Inspect" : "View"}
                        {expandedId === car.id ? (
                          <ChevronUp size={13} />
                        ) : (
                          <ChevronDown size={13} />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Inspection panel */}
                {expandedId === car.id && draft && (
                  <div className="mt-4 pt-4 border-t border-white/10 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {INSPECTION_CATEGORIES.map(
                      ({ key, label }) => (
                        <div key={key}>
                          <p className="text-xs text-zinc-400 mb-1">
                            {label}
                          </p>

                          <select
                            disabled={!canEdit}
                            value={
                              draft.inspection[key]
                                ?.status || ""
                            }
                            onChange={(e) =>
                              setDraftCategory(
                                key,
                                "status",
                                e.target.value
                              )
                            }
                            className="w-full px-2.5 py-1.5 rounded-md bg-zinc-900 border border-white/10 text-xs text-white disabled:opacity-60"
                          >
                            {INSPECTION_STATUS_OPTIONS.map(
                              (option) => (
                                <option
                                  key={option.value}
                                  value={option.value}
                                >
                                  {option.label}
                                </option>
                              )
                            )}
                          </select>

                          {draft.inspection[key]
                            ?.status && (
                            <input
                              disabled={!canEdit}
                              value={
                                draft.inspection[key]
                                  ?.note || ""
                              }
                              onChange={(e) =>
                                setDraftCategory(
                                  key,
                                  "note",
                                  e.target.value
                                )
                              }
                              placeholder="Note (optional)"
                              className="w-full mt-1.5 px-2.5 py-1.5 rounded-md bg-white/5 border border-white/10 text-xs text-white disabled:opacity-60"
                            />
                          )}
                        </div>
                      )
                    )}

                    <div className="sm:col-span-2 lg:col-span-3">
                      <p className="text-xs text-zinc-400 mb-1">
                        Overall notes
                      </p>

                      <textarea
                        disabled={!canEdit}
                        rows={2}
                        value={draft.inspection_notes}
                        onChange={(e) =>
                          setDraft((previous) => ({
                            ...previous,
                            inspection_notes:
                              e.target.value,
                          }))
                        }
                        className="w-full px-2.5 py-1.5 rounded-md bg-white/5 border border-white/10 text-xs text-white disabled:opacity-60"
                      />
                    </div>

                    {canEdit && (
                      <div className="sm:col-span-2 lg:col-span-3 flex justify-end">
                        <button
                          onClick={() =>
                            saveInspection(car.id)
                          }
                          disabled={saving}
                          className="flex items-center gap-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white px-3.5 py-2 rounded-lg"
                        >
                          {saving && (
                            <Loader2
                              size={13}
                              className="animate-spin"
                            />
                          )}
                          Save Inspection Report
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
