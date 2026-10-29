import { exportCSV as downloadCSV } from "../lib/csv";
import VehicleEditor from "../components/VehicleEditor";
import AdminDialog from "../components/AdminDialog";
import { Link, useSearchParams } from "react-router-dom";

import { useEffect, useMemo, useState } from "react";
import {
  Gavel, Tag, EyeOff, Eye, Ban, Loader2, AlertCircle,
  Search, ClipboardCheck, ChevronDown, ChevronUp,
  UserCheck2, RefreshCw, X, ImageOff, Clock,
  TrendingUp, Download, SortAsc, SortDesc,
  CheckSquare, Square, IndianRupee, Users, Shield,
  Pencil, Upload, ImagePlus, Save, RotateCcw,
  Trash2, Sticker, CheckCircle2
} from "lucide-react";

import { useAuth } from "../../auth/AuthContext";
import { supabase } from "../../lib/supabaseClient";
import {
  fetchCars,
  updateCar
} from "../lib/carsApi";

import {
  INSPECTION_CATEGORIES,
  INSPECTION_STATUS_OPTIONS,
  EMPTY_INSPECTION
} from "../lib/lookups";

// ============================================================
// WELLCARDEALS — ADVANCED INVENTORY
// ============================================================

const INPUT =
  "w-full px-3 py-2.5 rounded-xl bg-zinc-800 border border-white/10 text-sm text-white outline-none focus:border-blue-500";

const BUTTON =
  "inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition disabled:opacity-50";

const STATUS_STYLES = {
  draft: "bg-zinc-500/15 text-zinc-400",
  upcoming: "bg-blue-500/15 text-blue-400",
  live: "bg-emerald-500/15 text-emerald-400",
  closed: "bg-zinc-500/15 text-zinc-400",
  sold: "bg-violet-500/15 text-violet-400",
  delisted: "bg-red-500/15 text-red-400"
};

const INSPECTION_DOTS = {
  good: "bg-emerald-500",
  fair: "bg-amber-500",
  poor: "bg-red-500"
};

function money(value) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const number = Number(value);

  if (!Number.isFinite(number)) return "—";

  return "₹" + Math.round(number).toLocaleString("en-IN");
}

function localDate(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const pad = (n) => String(n).padStart(2, "0");

  return (
    date.getFullYear() +
    "-" +
    pad(date.getMonth() + 1) +
    "-" +
    pad(date.getDate()) +
    "T" +
    pad(date.getHours()) +
    ":" +
    pad(date.getMinutes())
  );
}

function eligibleC2C(car) {
  return (
    car.channel !== "dealer" &&
    car.access_type === "all" &&
    car.listing_type === "buy_now_only"
  );
}

function inspectionStatus(car) {
  const values = Object.values(car.inspection || {})
    .map((item) => item?.status)
    .filter(Boolean);

  if (!values.length) return null;
  if (values.includes("poor")) return "poor";
  if (values.includes("fair")) return "fair";

  return "good";
}

function carImages(car) {
  return Array.isArray(car.images)
    ? car.images.filter(
        (url) => typeof url === "string" && url.length > 0
      )
    : [];
}

function Modal({ title, children, onClose, wide = false }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        className={`relative w-full ${
          wide ? "max-w-5xl" : "max-w-lg"
        } max-h-[94vh] overflow-y-auto rounded-2xl border border-white/10 bg-zinc-900 shadow-2xl`}
      >
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-white/10 bg-zinc-900 px-5 py-4">
          <h2 className="font-bold text-white">{title}</h2>

          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// ============================================================
// AUCTION TIMER
// ============================================================

function AuctionTimer({ endTime }) {
  const [now, setNow] = useState(()=>Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!endTime) return null;

  const difference = new Date(endTime).getTime() - now;

  if (difference <= 0) {
    return (
      <span className="text-xs text-red-400">
        Auction Ended
      </span>
    );
  }

  const hours = Math.floor(difference / 3600000);
  const minutes = Math.floor((difference % 3600000) / 60000);
  const seconds = Math.floor((difference % 60000) / 1000);

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-1 text-[11px] text-zinc-300">
      <Clock size={11} />
      {hours}h {String(minutes).padStart(2, "0")}m{" "}
      {String(seconds).padStart(2, "0")}s
    </span>
  );
}

// ============================================================
// WCD STICKER IMAGE GENERATOR
// ============================================================


function EditCarModal({car,bidCount,onClose,onSaved}) {
 const [busy,setBusy]=useState(false);
 return <AdminDialog title="Edit vehicle" wide busy={busy} onClose={onClose}><VehicleEditor key={car.id} car={car} bidCount={bidCount} onSaved={onSaved} onCancel={onClose} onBusyChange={setBusy}/></AdminDialog>;
}

function PriceModal({ car, bidCount, saving, onClose, onSave }) {
  const [prices, setPrices] = useState({
    base_price_buyer: car.base_price_buyer ?? "",
    base_price_dealer: car.base_price_dealer ?? "",
    buy_now_price: car.buy_now_price ?? "",
    starting_bid: car.starting_bid ?? "",
    reserve_price: car.reserve_price ?? ""
  });

  const [error, setError] = useState("");

  function save() {
    const payload = {};

    for (const [key, value] of Object.entries(prices)) {
      if (value === "") {
        payload[key] = null;
      } else {
        const number = Number(value);

        if (!Number.isFinite(number) || number < 0) {
          setError("Enter valid prices.");
          return;
        }

        payload[key] = number;
      }
    }

    onSave(payload);
  }

  return (
    <Modal title="Edit Prices" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-xs text-zinc-400">
          {car.vehicle_title}
        </p>

        {bidCount > 0 && (
          <p className="rounded-lg bg-amber-500/10 p-3 text-xs text-amber-400">
            {bidCount} existing bids. Current bid values
            will not be overwritten.
          </p>
        )}

        {[
          ["base_price_buyer", "Buyer Base Price"],
          ["base_price_dealer", "Dealer Base Price"],
          ["buy_now_price", "Buy Now Price"],
          ["starting_bid", "Starting Bid"],
          ["reserve_price", "Reserve Price"]
        ].map(([field, label]) => (
          <label
            key={field}
            className="block space-y-1 text-xs text-zinc-400"
          >
            {label}

            <input
              type="number"
              min="0"
              className={INPUT}
              value={prices[field]}
              onChange={(event) =>
                setPrices((previous) => ({
                  ...previous,
                  [field]: event.target.value
                }))
              }
            />
          </label>
        ))}

        {error && (
          <p className="text-xs text-red-400">{error}</p>
        )}

        <button
          type="button"
          disabled={saving}
          onClick={save}
          className={`${BUTTON} w-full bg-amber-500 text-black`}
        >
          {saving ? "Saving..." : "Save Prices"}
        </button>
      </div>
    </Modal>
  );
}

// ============================================================
// RELIST MODAL
// ============================================================

function RelistModal({ car, saving, onClose, onConfirm }) {
  const [listingType, setListingType] = useState(
    car.listing_type || "auction"
  );

  const [accessType, setAccessType] = useState(
    car.access_type || "all"
  );

  const [auctionEnd, setAuctionEnd] = useState("");
  const [error, setError] = useState("");

  function confirm() {
    if (listingType === "auction" && !auctionEnd) {
      setError("Auction end date required.");
      return;
    }

    if (
      listingType === "buy_now_only" &&
      !car.buy_now_price
    ) {
      setError("Set Buy Now price first.");
      return;
    }

    onConfirm({
      listingType,
      accessType,
      auctionEnd
    });
  }

  return (
    <Modal title="Re-list Car" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-xs text-zinc-400">
          {car.vehicle_title}
        </p>

        <label className="block space-y-1 text-xs text-zinc-400">
          Listing Type
          <select
            className={INPUT}
            value={listingType}
            onChange={(event) =>
              setListingType(event.target.value)
            }
          >
            <option value="auction">Auction</option>
            <option value="buy_now_only">Buy Now</option>
          </select>
        </label>

        <label className="block space-y-1 text-xs text-zinc-400">
          Access
          <select
            className={INPUT}
            value={accessType}
            onChange={(event) =>
              setAccessType(event.target.value)
            }
          >
            <option value="all">Everyone</option>
            <option value="dealer_only">Dealers Only</option>
          </select>
        </label>

        {listingType === "auction" && (
          <label className="block space-y-1 text-xs text-zinc-400">
            Auction End
            <input
              type="datetime-local"
              className={INPUT}
              value={auctionEnd}
              onChange={(event) =>
                setAuctionEnd(event.target.value)
              }
            />
          </label>
        )}

        {error && (
          <p className="text-xs text-red-400">{error}</p>
        )}

        <button
          type="button"
          disabled={saving}
          onClick={confirm}
          className={`${BUTTON} w-full bg-emerald-600 text-white`}
        >
          {saving ? "Saving..." : "Re-list Now"}
        </button>
      </div>
    </Modal>
  );
}

// ============================================================
// MAIN INVENTORY PAGE
// ============================================================

export default function InventoryPage() {
  const { role, user: currentUser } = useAuth();

  const canEdit =
    role === "admin" || role === "manager";

  const [cars, setCars] = useState([]);
  const [staff, setStaff] = useState([]);
  const [bidCounts, setBidCounts] = useState({});

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [savingId, setSavingId] = useState(null);
  const [notice, setNotice] = useState(null);

  const [params]=useSearchParams();
  const [search, setSearch] = useState(params.get("q")||"");
  const [view,setView]=useState("table");
  const [channelFilter,setChannelFilter]=useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [sortField, setSortField] = useState("created_at");
  const [sortDir, setSortDir] = useState("desc");

  const [editCar, setEditCar] = useState(null);
  const [priceCar, setPriceCar] = useState(null);
  const [relistCar, setRelistCar] = useState(null);

  const [expandedId, setExpandedId] = useState(null);
  const [inspectionDraft, setInspectionDraft] = useState(null);

  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkAction, setBulkAction] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);

  // ----------------------------------------------------------
  // LOAD
  // ----------------------------------------------------------

  async function load() {
    setLoading(true);
    setError("");

    try {
      const [
        carsData,
        { data: staffData, error: staffError },
        { data: bidsData, error: bidsError }
      ] = await Promise.all([
        fetchCars(),

        supabase
          .from("profiles")
          .select("id, full_name, role")
          .in("role", ["admin", "manager"]),

        supabase.rpc("backend_staff_bid_counts")
      ]);

      if (staffError || bidsError) throw staffError || bidsError;
      setCars(carsData || []);
      setStaff(staffData || []);

      setBidCounts(bidsData || {});
    } catch (err) {
      setError(err.message || "Inventory load failed.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // ----------------------------------------------------------
  // UPDATE
  // ----------------------------------------------------------

  async function patchCar(id, payload, successText) {
    if (!canEdit) return false;

    setSavingId(id);
    setNotice(null);

    try {
      const updated = await updateCar(id, payload);

      setCars((previous) =>
        previous.map((car) =>
          car.id === id
            ? { ...car, ...updated }
            : car
        )
      );

      setNotice({
        id,
        text: successText,
        isError: false
      });

      return true;
    } catch (err) {
      setNotice({
        id,
        text: err.message || "Update failed.",
        isError: true
      });

      return false;
    } finally {
      setSavingId(null);
    }
  }

  function onEditSaved(updated) {
    const id = editCar.id;

    setCars((previous) =>
      previous.map((car) =>
        car.id === id
          ? { ...car, ...updated }
          : car
      )
    );

    setEditCar(null);

    setNotice({
      id,
      text: "Car updated successfully!",
      isError: false
    });
  }

  async function toggleC2C(car) {
    if (!eligibleC2C(car)) {
      setNotice({
        id: car.id,
        text: "C2C only for public Buy Now listings.",
        isError: true
      });
      return;
    }

    const next = car.c2c_enabled !== true;

    await patchCar(
      car.id,
      { c2c_enabled: next },
      next ? "C2C enabled." : "C2C disabled."
    );
  }

  async function changeListing(car, listingType) {
    if (
      listingType === "buy_now_only" &&
      !car.buy_now_price
    ) {
      setNotice({
        id: car.id,
        text: "Set Buy Now price first.",
        isError: true
      });
      return;
    }

    await patchCar(
      car.id,
      {
        listing_type: listingType,
        ...(listingType !== "buy_now_only"
          ? { c2c_enabled: false }
          : {})
      },
      "Listing type updated."
    );
  }

  async function changeAccess(car, accessType) {
    await patchCar(
      car.id,
      {
        access_type: accessType,
        ...(accessType === "dealer_only"
          ? { c2c_enabled: false }
          : {})
      },
      "Access updated."
    );
  }

  async function toggleVisibility(car) {
    const next =
      car.visibility === "hidden"
        ? "visible"
        : "hidden";

    await patchCar(
      car.id,
      { visibility: next },
      next === "hidden"
        ? "Car hidden."
        : "Car visible."
    );
  }

  async function delist(car) {
    if (
      !window.confirm(
        `Delist ${car.vehicle_title}?`
      )
    ) {
      return;
    }

    await patchCar(
      car.id,
      {
        status: "delisted",
        c2c_enabled: false
      },
      "Car delisted."
    );
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

  async function confirmRelist(values) {
    if (!relistCar) return;

    const car = relistCar;

    const success = await patchCar(
      car.id,
      {
        status: "live",
        visibility: "visible",
        listing_type: values.listingType,
        access_type: values.accessType,

        c2c_enabled:
          values.listingType === "buy_now_only" &&
          values.accessType === "all" &&
          car.channel !== "dealer"
            ? car.c2c_enabled === true
            : false,

        auction_end:
          values.listingType === "auction"
            ? new Date(values.auctionEnd).toISOString()
            : null
      },
      "Car re-listed."
    );

    if (success) setRelistCar(null);
  }

  function staffName(id) {
    if (!id) return null;

    return (
      staff.find((person) => person.id === id)
        ?.full_name || "Unknown"
    );
  }

  async function claimCar(car) {
    await patchCar(
      car.id,
      { handled_by: currentUser?.id },
      "You are now handling this car."
    );
  }

  async function reassignCar(car, id) {
    if (!id) return;

    await patchCar(
      car.id,
      { handled_by: id },
      `Assigned to ${staffName(id)}.`
    );
  }

  // ----------------------------------------------------------
  // INSPECTION
  // ----------------------------------------------------------

  function toggleInspection(car) {
    if (expandedId === car.id) {
      setExpandedId(null);
      setInspectionDraft(null);
      return;
    }

    setExpandedId(car.id);

    setInspectionDraft({
      inspection: {
        ...EMPTY_INSPECTION,
        ...(car.inspection || {})
      },
      inspection_notes: car.inspection_notes || ""
    });
  }

  function changeInspection(key, field, value) {
    setInspectionDraft((previous) => ({
      ...previous,

      inspection: {
        ...previous.inspection,

        [key]:
          field === "status" && !value
            ? null
            : {
                ...(previous.inspection[key] || {}),
                [field]: value
              }
      }
    }));
  }

  async function saveInspection(carId) {
    if (!inspectionDraft) return;

    const success = await patchCar(
      carId,
      {
        inspection: inspectionDraft.inspection,
        inspection_notes:
          inspectionDraft.inspection_notes
      },
      "Inspection updated."
    );

    if (success) {
      setExpandedId(null);
      setInspectionDraft(null);
    }
  }

  // ----------------------------------------------------------
  // SORT / FILTER
  // ----------------------------------------------------------

  const filtered = useMemo(() => {
    let list = [...cars];

    if (statusFilter !== "all") {
      list = list.filter(
        (car) => car.status === statusFilter
      );
    }

    if (search.trim()) {
      const query = search.trim().toLowerCase();

      list = list.filter((car) =>
        [
          car.vehicle_title,
          car.variant,
          car.location,
          car.registration_number,
          car.registration_no,
          car.car_number
        ]
          .filter(Boolean)
          .some((value) =>
            String(value).toLowerCase().includes(query)
          )
      );
    }

    return list.sort((a, b) => {
      let av =
        sortField === "bids"
          ? bidCounts[a.id] || 0
          : a[sortField];

      let bv =
        sortField === "bids"
          ? bidCounts[b.id] || 0
          : b[sortField];

      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;

      if (typeof av === "string") {
        return sortDir === "asc"
          ? av.localeCompare(bv)
          : bv.localeCompare(av);
      }

      return sortDir === "asc"
        ? av - bv
        : bv - av;
    });
  }, [
    cars,
    search,
    statusFilter,
    sortField,
    sortDir,
    bidCounts
  ]);

  function toggleSort(field) {
    if (sortField === field) {
      setSortDir((previous) =>
        previous === "asc" ? "desc" : "asc"
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
    const allSelected =
      filtered.length > 0 &&
      filtered.every((car) =>
        selectedIds.has(car.id)
      );

    setSelectedIds(
      allSelected
        ? new Set()
        : new Set(filtered.map((car) => car.id))
    );
  }

  // ----------------------------------------------------------
  // BULK ACTIONS
  // ----------------------------------------------------------

  async function applyBulkAction() {
    if (
      !canEdit ||
      !bulkAction ||
      selectedIds.size === 0
    ) {
      return;
    }

    const payloadMap = {
      hide: { visibility: "hidden" },
      unhide: { visibility: "visible" },

      delist: {
        status: "delisted",
        c2c_enabled: false
      },

      dealer_only: {
        access_type: "dealer_only",
        c2c_enabled: false
      },

      all_access: {
        access_type: "all"
      }
    };

    const payload = payloadMap[bulkAction];

    if (!payload) return;

    setBulkSaving(true);

    const ids = [...selectedIds];

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
        isError: true
      });

      await load();
    } finally {
      setBulkSaving(false);
    }
  }

  // ----------------------------------------------------------
  // CSV EXPORT
  // ----------------------------------------------------------

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
      "Auction End"
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
      car.auction_end || ""
    ]);

    downloadCSV("inventory",headers,rows);
  }

  // ----------------------------------------------------------
  // UI
  // ----------------------------------------------------------

  return (
    <div className="space-y-5">
      {editCar && (
        <EditCarModal
          car={editCar}
          bidCount={bidCounts[editCar.id] || 0}
          onClose={() => setEditCar(null)}
          onSaved={onEditSaved}
        />
      )}

      {priceCar && (
        <PriceModal
          car={priceCar}
          bidCount={bidCounts[priceCar.id] || 0}
          saving={savingId === priceCar.id}
          onClose={() => setPriceCar(null)}
          onSave={savePrices}
        />
      )}

      {relistCar && (
        <RelistModal
          car={relistCar}
          saving={savingId === relistCar.id}
          onClose={() => setRelistCar(null)}
          onConfirm={confirmRelist}
        />
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Inventory
          </h1>

          <p className="mt-1 text-sm text-zinc-400">
            {canEdit
              ? "Manage cars, edit published listings, apply WCD stickers, prices and inspections."
              : "Read-only inventory view."}
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          {canEdit && <Link to="/admin/add-car" className="aw-button aw-primary">Add vehicle</Link>}
          <button
            type="button"
            onClick={load}
            className={`${BUTTON} border border-white/10 text-zinc-300`}
          >
            <RefreshCw size={14} />
            Refresh
          </button>

          <button
            type="button"
            onClick={exportCSV}
            className={`${BUTTON} border border-white/10 text-zinc-300`}
          >
            <Download size={14} />
            Export CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Total Cars", cars.length],
          [
            "Live Cars",
            cars.filter((car) => car.status === "live").length
          ],
          [
            "Hidden",
            cars.filter(
              (car) => car.visibility === "hidden"
            ).length
          ],
          [
            "C2C Active",
            cars.filter(
              (car) =>
                eligibleC2C(car) &&
                car.c2c_enabled === true
            ).length
          ]
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
          >
            <p className="text-xs text-zinc-400">
              {label}
            </p>

            <p className="mt-1 text-2xl font-bold text-white">
              {value}
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search
            size={16}
            className="absolute left-3 top-3 text-zinc-500"
          />

          <input
            className={`${INPUT} pl-10`}
            placeholder="Search car, location, number..."
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
          />
        </div>

        <select
          className={`${INPUT} w-auto min-w-[150px]`}
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(event.target.value)
          }
        >
          <option value="all">All Statuses</option>

          {Object.keys(STATUS_STYLES).map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-zinc-500">
          Sort:
        </span>

        {[
          ["created_at", "Date"],
          ["base_price_buyer", "Buyer Price"],
          ["base_price_dealer", "Dealer Price"],
          ["status", "Status"],
          ["bids", "Bids"],
          ["auction_end", "Ends"]
        ].map(([field, label]) => (
          <button
            key={field}
            type="button"
            onClick={() => toggleSort(field)}
            className={`${BUTTON} ${
              sortField === field
                ? "bg-blue-500/10 text-blue-400"
                : "text-zinc-500 hover:text-white"
            }`}
          >
            {label}

            {sortField === field &&
              (sortDir === "asc" ? (
                <SortAsc size={12} />
              ) : (
                <SortDesc size={12} />
              ))}
          </button>
        ))}
      </div>

      <div className="aw-inventory-view"><select aria-label="Sales channel" value={channelFilter} onChange={e=>setChannelFilter(e.target.value)}><option value="all">All channels</option><option value="direct">Direct sale</option><option value="auction">Dealer auction</option></select><div className="aw-segmented"><button type="button" aria-pressed={view==="table"} onClick={()=>setView("table")}>Table</button><button type="button" aria-pressed={view==="cards"} onClick={()=>setView("cards")}>Cards & actions</button></div></div>
      {canEdit && filtered.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
          <button
            type="button"
            onClick={selectAll}
            className={`${BUTTON} text-zinc-300`}
          >
            {filtered.every((car) =>
              selectedIds.has(car.id)
            ) ? (
              <CheckSquare size={15} />
            ) : (
              <Square size={15} />
            )}

            Select All
          </button>

          {selectedIds.size > 0 && (
            <>
              <span className="text-xs text-zinc-400">
                {selectedIds.size} selected
              </span>

              <select
                className={`${INPUT} w-auto`}
                value={bulkAction}
                onChange={(event) =>
                  setBulkAction(event.target.value)
                }
              >
                <option value="">Bulk Action</option>
                <option value="hide">Hide</option>
                <option value="unhide">Unhide</option>
                <option value="delist">Delist</option>
                <option value="dealer_only">
                  Dealer Only
                </option>
                <option value="all_access">
                  All Access
                </option>
              </select>

              <button
                type="button"
                disabled={!bulkAction || bulkSaving}
                onClick={applyBulkAction}
                className={`${BUTTON} bg-blue-600 text-white`}
              >
                {bulkSaving ? "Applying..." : "Apply"}
              </button>
            </>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-10 text-zinc-400">
          <Loader2 className="animate-spin" size={18} />
          Loading inventory...
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 text-red-400">
          <AlertCircle size={16} />
          {error}
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-10 text-center text-zinc-500">
          No cars found.
        </p>
      ) : (
        <><div className="aw-table-scroll" hidden={view!=="table"}><table className="aw-data-table"><thead><tr><th>Vehicle</th><th>Channel</th><th>Price</th><th>Status</th><th>Inspection</th><th>Actions</th></tr></thead><tbody>{filtered.filter(c=>channelFilter==="all" || (channelFilter==="direct"?c.listing_type==="buy_now_only":c.listing_type==="auction")).map(car=><tr key={car.id}><td><div className="aw-vehicle-cell">{(car.thumbnail_url||carImages(car)[0])&&<img src={car.thumbnail_url||carImages(car)[0]} alt=""/>}<div><strong>{car.vehicle_title||"Untitled"}</strong><small>{car.year||"Year not set"} · {car.location||"Location not set"}</small></div></div></td><td><span className="aw-tag">{car.listing_type==="buy_now_only"?"Direct sale":"Dealer auction"}</span></td><td className="aw-money">{money(car.listing_type==="buy_now_only"?car.buy_now_price:car.base_price_dealer??car.starting_bid)}</td><td><span className={"aw-status aw-status-"+car.status}>{car.status}{car.visibility==="hidden"?" · Hidden":""}</span></td><td>{inspectionStatus(car)||"Not checked"}</td><td><div className="aw-row-actions">{canEdit&&car.status!=="sold"&&<button type="button" className="aw-button" onClick={()=>setEditCar(car)}><Pencil size={14}/>Edit</button>}<button type="button" className="aw-text-button" onClick={()=>{setView("cards");setSearch(car.vehicle_title||car.id);}}>Manage details</button></div></td></tr>)}</tbody></table></div><div className="space-y-4" hidden={view!=="cards"}>
          {filtered.filter(c=>channelFilter==="all" || (channelFilter==="direct"?c.listing_type==="buy_now_only":c.listing_type==="auction")).map((car) => {
            const images = carImages(car);

            const cover =
              car.thumbnail_url || images[0] || null;

            const saving = savingId === car.id;
            const bids = bidCounts[car.id] || 0;

            const c2cEligible = eligibleC2C(car);

            const c2cOn =
              c2cEligible &&
              car.c2c_enabled === true;

            const canRelist = [
              "closed",
              "delisted",
              "draft"
            ].includes(car.status);

            const overall = inspectionStatus(car);

            return (
              <div
                key={car.id}
                className={`rounded-2xl border p-4 ${
                  selectedIds.has(car.id)
                    ? "border-blue-500/40 bg-blue-500/5"
                    : "border-white/10 bg-white/[0.025]"
                }`}
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:justify-between">
                  <div className="flex min-w-0 gap-3">
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() =>
                          toggleSelect(car.id)
                        }
                        className="self-start pt-1 text-zinc-400"
                      >
                        {selectedIds.has(car.id) ? (
                          <CheckSquare
                            size={17}
                            className="text-blue-400"
                          />
                        ) : (
                          <Square size={17} />
                        )}
                      </button>
                    )}

                    <div className="flex h-20 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/5">
                      {cover ? (
                        <img
                          src={cover}
                          alt={car.vehicle_title || "Car"}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <ImageOff
                          size={20}
                          className="text-zinc-600"
                        />
                      )}
                    </div>

                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-white">
                          {car.vehicle_title || "Untitled"}
                        </h3>

                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${
                            STATUS_STYLES[car.status] ||
                            STATUS_STYLES.draft
                          }`}
                        >
                          {car.status}
                        </span>

                        {car.visibility === "hidden" && (
                          <span className="text-xs text-amber-400">
                            Hidden
                          </span>
                        )}

                        {car.access_type === "dealer_only" && (
                          <span className="flex items-center gap-1 text-xs text-purple-400">
                            <Shield size={11} />
                            Dealer Only
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400">
                        <span>
                          {car.listing_type === "buy_now_only"
                            ? "Buy Now"
                            : "Auction"}
                        </span>

                        <span>
                          Buyer:{" "}
                          <b className="text-white">
                            {money(car.base_price_buyer)}
                          </b>
                        </span>

                        <span>
                          Dealer:{" "}
                          <b className="text-white">
                            {money(car.base_price_dealer)}
                          </b>
                        </span>

                        <span>
                          Buy Now:{" "}
                          <b className="text-white">
                            {money(car.buy_now_price)}
                          </b>
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <span
                          className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                            c2cOn
                              ? "bg-emerald-500/15 text-emerald-400"
                              : "bg-white/5 text-zinc-500"
                          }`}
                        >
                          {c2cEligible
                            ? `C2C ${c2cOn ? "ON" : "OFF"}`
                            : "C2C Unavailable"}
                        </span>

                        {bids > 0 && (
                          <span className="flex items-center gap-1 text-xs text-emerald-400">
                            <TrendingUp size={12} />
                            {bids} bids
                          </span>
                        )}

                        {car.inspected_at ? (
                          <span className="flex items-center gap-1 text-xs text-zinc-400">
                            <span
                              className={`h-2 w-2 rounded-full ${
                                INSPECTION_DOTS[overall] ||
                                "bg-zinc-500"
                              }`}
                            />
                            {overall || "Inspected"}
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-500">
                            Not inspected
                          </span>
                        )}
                      </div>

                      {car.status === "live" &&
                        car.auction_end && (
                          <AuctionTimer
                            endTime={car.auction_end}
                          />
                        )}

                      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                        <UserCheck2 size={13} />

                        <span>
                          Handling:{" "}
                          <b className="text-zinc-200">
                            {car.handled_by
                              ? staffName(car.handled_by)
                              : "Unassigned"}
                          </b>
                        </span>

                        {canEdit &&
                          car.handled_by !==
                            currentUser?.id && (
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() =>
                                claimCar(car)
                              }
                              className="text-blue-400 hover:underline"
                            >
                              Claim
                            </button>
                          )}

                        {canEdit && staff.length > 1 && (
                          <select
                            disabled={saving}
                            value=""
                            onChange={(event) =>
                              reassignCar(
                                car,
                                event.target.value
                              )
                            }
                            className="rounded-md border border-white/10 bg-zinc-900 px-2 py-1 text-xs text-white"
                          >
                            <option value="">
                              Reassign to...
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
                          className={`text-xs ${
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

                  <div className="flex flex-wrap content-start gap-2 xl:max-w-[470px] xl:justify-end">
                    {canEdit && car.status !== "sold" && (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => setEditCar(car)}
                        className={`${BUTTON} bg-blue-600 text-white`}
                      >
                        <Pencil size={14} />
                        Edit Car
                      </button>
                    )}

                    {canEdit && car.status !== "sold" && (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => setEditCar(car)}
                        className={`${BUTTON} border border-indigo-500/30 text-indigo-400`}
                      >
                        <Sticker size={14} />
                        WCD Sticker
                      </button>
                    )}

                    {canEdit && (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => setPriceCar(car)}
                        className={`${BUTTON} border border-amber-500/30 text-amber-400`}
                      >
                        <IndianRupee size={14} />
                        Prices
                      </button>
                    )}

                    {canEdit && car.status === "live" && (
                      <div className="flex rounded-lg bg-white/5 p-1">
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() =>
                            changeListing(car, "auction")
                          }
                          className={`${BUTTON} ${
                            car.listing_type === "auction"
                              ? "bg-blue-600 text-white"
                              : "text-zinc-400"
                          }`}
                        >
                          <Gavel size={12} />
                          Auction
                        </button>

                        <button
                          type="button"
                          disabled={saving}
                          onClick={() =>
                            changeListing(
                              car,
                              "buy_now_only"
                            )
                          }
                          className={`${BUTTON} ${
                            car.listing_type === "buy_now_only"
                              ? "bg-blue-600 text-white"
                              : "text-zinc-400"
                          }`}
                        >
                          <Tag size={12} />
                          Buy Now
                        </button>
                      </div>
                    )}

                    {canEdit && (
                      <div className="flex rounded-lg bg-white/5 p-1">
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() =>
                            changeAccess(car, "all")
                          }
                          className={`${BUTTON} ${
                            car.access_type === "all"
                              ? "bg-purple-600 text-white"
                              : "text-zinc-400"
                          }`}
                        >
                          <Users size={12} />
                          All
                        </button>

                        <button
                          type="button"
                          disabled={saving}
                          onClick={() =>
                            changeAccess(
                              car,
                              "dealer_only"
                            )
                          }
                          className={`${BUTTON} ${
                            car.access_type === "dealer_only"
                              ? "bg-purple-600 text-white"
                              : "text-zinc-400"
                          }`}
                        >
                          <Shield size={12} />
                          Dealer
                        </button>
                      </div>
                    )}

                    {c2cEligible && (
                      <button
                        type="button"
                        disabled={!canEdit || saving}
                        onClick={() => toggleC2C(car)}
                        className={`${BUTTON} border ${
                          c2cOn
                            ? "border-emerald-500/30 text-emerald-400"
                            : "border-white/10 text-zinc-400"
                        }`}
                      >
                        C2C {c2cOn ? "ON" : "OFF"}
                      </button>
                    )}

                    {canEdit && canRelist && (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => setRelistCar(car)}
                        className={`${BUTTON} border border-emerald-500/30 text-emerald-400`}
                      >
                        <RefreshCw size={13} />
                        Re-list
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={!canEdit || saving}
                      onClick={() => toggleVisibility(car)}
                      className={`${BUTTON} border border-white/10 text-zinc-300`}
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
                          type="button"
                          disabled={saving}
                          onClick={() => delist(car)}
                          className={`${BUTTON} bg-red-600 text-white`}
                        >
                          <Ban size={13} />
                          Delist
                        </button>
                      )}

                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => toggleInspection(car)}
                      className={`${BUTTON} border border-white/10 text-zinc-300`}
                    >
                      <ClipboardCheck size={13} />
                      {canEdit ? "Inspect" : "View"}

                      {expandedId === car.id ? (
                        <ChevronUp size={13} />
                      ) : (
                        <ChevronDown size={13} />
                      )}
                    </button>

                    {canEdit &&
                      ["live", "upcoming"].includes(
                        car.status
                      ) &&
                      car.listing_type === "auction" && (
                        <label className="flex flex-col gap-1 text-xs text-zinc-500">
                          Live Until
                          <input
                            key={`${car.id}-${car.auction_end}`}
                            type="datetime-local"
                            defaultValue={localDate(
                              car.auction_end
                            )}
                            disabled={saving}
                            onBlur={(event) => {
                              if (
                                event.target.value !==
                                localDate(car.auction_end)
                              ) {
                                patchCar(
                                  car.id,
                                  {
                                    auction_end:
                                      event.target.value
                                        ? new Date(
                                            event.target.value
                                          ).toISOString()
                                        : null
                                  },
                                  "Auction end updated."
                                );
                              }
                            }}
                            className="rounded-lg border border-white/10 bg-zinc-800 px-2 py-1.5 text-xs text-white"
                          />
                        </label>
                      )}
                  </div>
                </div>

                {expandedId === car.id &&
                  inspectionDraft && (
                    <div className="mt-5 border-t border-white/10 pt-5">
                      <h4 className="mb-4 font-semibold text-white">
                        Inspection Report
                      </h4>

                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {INSPECTION_CATEGORIES.map(
                          ({ key, label }) => (
                            <div
                              key={key}
                              className="space-y-2"
                            >
                              <p className="text-xs text-zinc-400">
                                {label}
                              </p>

                              <select
                                disabled={!canEdit}
                                className={INPUT}
                                value={
                                  inspectionDraft.inspection[
                                    key
                                  ]?.status || ""
                                }
                                onChange={(event) =>
                                  changeInspection(
                                    key,
                                    "status",
                                    event.target.value
                                  )
                                }
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

                              {inspectionDraft.inspection[
                                key
                              ]?.status && (
                                <input
                                  disabled={!canEdit}
                                  className={INPUT}
                                  placeholder="Note"
                                  value={
                                    inspectionDraft.inspection[
                                      key
                                    ]?.note || ""
                                  }
                                  onChange={(event) =>
                                    changeInspection(
                                      key,
                                      "note",
                                      event.target.value
                                    )
                                  }
                                />
                              )}
                            </div>
                          )
                        )}
                      </div>

                      <label className="mt-4 block space-y-2 text-xs text-zinc-400">
                        Overall Notes

                        <textarea
                          rows={3}
                          disabled={!canEdit}
                          className={INPUT}
                          value={
                            inspectionDraft.inspection_notes
                          }
                          onChange={(event) =>
                            setInspectionDraft(
                              (previous) => ({
                                ...previous,
                                inspection_notes:
                                  event.target.value
                              })
                            )
                          }
                        />
                      </label>

                      {canEdit && (
                        <div className="mt-4 flex justify-end">
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() =>
                              saveInspection(car.id)
                            }
                            className={`${BUTTON} bg-blue-600 text-white`}
                          >
                            <Save size={14} />
                            Save Inspection
                          </button>
                        </div>
                      )}
                    </div>
                  )}
              </div>
            );
          })}
        </div></>
      )}
    </div>
  );
}
