
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
  updateCar,
  uploadCarFile
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
  const [now, setNow] = useState(Date.now());

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


const WCD_LOGO_URL = "/wcd-plate-logo.png";

function loadCanvasImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";

    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error(`Image load failed: ${url}`));

    image.src = url;
  });
}

async function createWCDStickerFile(
  imageUrl,
  position,
  stickerWidth
) {
  const [photo, logo] = await Promise.all([
    loadCanvasImage(imageUrl),
    loadCanvasImage(WCD_LOGO_URL)
  ]);

  const canvas = document.createElement("canvas");
  canvas.width = photo.naturalWidth;
  canvas.height = photo.naturalHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable.");

  ctx.drawImage(photo, 0, 0);

  // White branded plate, ratio 2.5:1
  const width = canvas.width * stickerWidth;
  const height = width / 2.5;

  const centerX = position.x * canvas.width;
  const centerY = position.y * canvas.height;

  const x = Math.max(
    0,
    Math.min(canvas.width - width, centerX - width / 2)
  );

  const y = Math.max(
    0,
    Math.min(canvas.height - height, centerY - height / 2)
  );

  ctx.save();

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x, y, width, height);

  ctx.strokeStyle = "#16449a";
  ctx.lineWidth = Math.max(2, width * 0.012);
  ctx.strokeRect(x, y, width, height);

  // Original logo, without distortion
  const padding = width * 0.025;
  const availableWidth = width - padding * 2;
  const availableHeight = height - padding * 2;

  const scale = Math.min(
    availableWidth / logo.naturalWidth,
    availableHeight / logo.naturalHeight
  );

  const logoWidth = logo.naturalWidth * scale;
  const logoHeight = logo.naturalHeight * scale;

  ctx.drawImage(
    logo,
    x + (width - logoWidth) / 2,
    y + (height - logoHeight) / 2,
    logoWidth,
    logoHeight
  );

  ctx.restore();

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) =>
        result
          ? resolve(result)
          : reject(new Error("Sticker export failed.")),
      "image/jpeg",
      0.95
    );
  });

  return new File(
    [blob],
    `wcd-sticker-${Date.now()}.jpg`,
    { type: "image/jpeg" }
  );
}

// ============================================================
// ADVANCED EDIT CAR + WCD PHOTO STICKER
// ============================================================

function EditCarModal({ car, onClose, onSaved }) {
  const originalImages = carImages(car);

  const [form, setForm] = useState({
    vehicle_title: car.vehicle_title || "",
    variant: car.variant || "",
    mileage_km: car.mileage_km ?? "",
    location: car.location || "",
    base_price_buyer: car.base_price_buyer ?? "",
    base_price_dealer: car.base_price_dealer ?? "",
    buy_now_price: car.buy_now_price ?? "",
    starting_bid: car.starting_bid ?? "",
    reserve_price: car.reserve_price ?? "",
    listing_type: car.listing_type || "auction",
    access_type: car.access_type || "all",
    visibility: car.visibility || "visible",
    auction_end: localDate(car.auction_end),
    c2c_enabled: car.c2c_enabled === true
  });

  const [images, setImages] = useState(originalImages);
  const [selectedImage, setSelectedImage] = useState(0);

  const [position, setPosition] = useState({
    x: 0.5,
    y: 0.72
  });

  const [stickerWidth, setStickerWidth] = useState(0.24);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const selectedUrl = images[selectedImage] || null;

  const canUseC2C =
    car.channel !== "dealer" &&
    form.listing_type === "buy_now_only" &&
    form.access_type === "all";

  function change(name, value) {
    setForm((previous) => ({
      ...previous,
      [name]: value
    }));
  }

  function placeSticker(event) {
    const image = event.currentTarget;
    const rect = image.getBoundingClientRect();

    // Image is rendered without object-fit cropping.
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;

    setPosition({
      x: Math.max(
        stickerWidth / 2,
        Math.min(1 - stickerWidth / 2, x)
      ),
      y: Math.max(0.05, Math.min(0.95, y))
    });
  }

  async function addPhotos(event) {
    const files = Array.from(event.target.files || []);

    if (!files.length) return;

    setBusy(true);
    setError("");
    setMessage("");

    try {
      const urls = [];

      for (const file of files) {
        if (!file.type.startsWith("image/")) {
          throw new Error("Only image files are allowed.");
        }

        if (file.size > 15 * 1024 * 1024) {
          throw new Error("Each photo must be under 15 MB.");
        }

        const url = await uploadCarFile(
          file,
          `cars/${car.id}/photos`
        );

        urls.push(url);
      }

      setImages((previous) => [...previous, ...urls]);

      setMessage(
        "Photos uploaded. Save Changes dabane par listing update hogi."
      );
    } catch (err) {
      setError(err.message || "Photo upload failed.");
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  }

  async function applySticker() {
    if (!selectedUrl) return;

    setBusy(true);
    setError("");
    setMessage("");

    try {
      const file = await createWCDStickerFile(
        selectedUrl,
        position,
        stickerWidth
      );

      const url = await uploadCarFile(
        file,
        `cars/${car.id}/wcd-stickers`
      );

      setImages((previous) =>
        previous.map((item, index) =>
          index === selectedImage ? url : item
        )
      );

      setMessage(
        "WCD sticker applied. Save Changes dabakar publish karo."
      );
    } catch (err) {
      setError(err.message || "Sticker failed.");
    } finally {
      setBusy(false);
    }
  }

  function removeImage(index) {
    setImages((previous) =>
      previous.filter((_, i) => i !== index)
    );

    setSelectedImage(0);
  }

  function restorePhotos() {
    setImages(originalImages);
    setSelectedImage(0);
    setMessage("Original listing photos restored in editor.");
  }

  function numberOrNull(value) {
    if (value === "" || value === null) return null;

    const number = Number(value);

    if (!Number.isFinite(number) || number < 0) {
      throw new Error("Enter valid non-negative numbers.");
    }

    return number;
  }

  
async function save() {
  setError("");
  setMessage("");

  try {
    if (!form.vehicle_title.trim()) {
      throw new Error("Car title required.");
    }

    if (!images.length) {
      throw new Error("At least one photo required.");
    }

    const payload = {};

    const textFields = [
      "vehicle_title",
      "variant",
      "location"
    ];

    for (const key of textFields) {
      const next = String(form[key] ?? "").trim();
      const old = String(car[key] ?? "").trim();

      if (next !== old) {
        payload[key] = next;
      }
    }

    const numericFields = [
      "mileage_km",
      "base_price_buyer",
      "base_price_dealer",
      "buy_now_price",
      "starting_bid",
      "reserve_price"
    ];

    for (const key of numericFields) {
      const next = numberOrNull(form[key]);
      const old = car[key] == null
        ? null
        : Number(car[key]);

      if (next !== old) {
        payload[key] = next;
      }
    }

    for (const key of [
      "listing_type",
      "access_type",
      "visibility"
    ]) {
      if (form[key] !== car[key]) {
        payload[key] = form[key];
      }
    }

    const nextC2C =
      canUseC2C && form.c2c_enabled === true;

    if (nextC2C !== (car.c2c_enabled === true)) {
      payload.c2c_enabled = nextC2C;
    }

    const oldAuctionEnd = car.auction_end
      ? new Date(car.auction_end).toISOString()
      : null;

    const nextAuctionEnd =
      form.listing_type === "auction" && form.auction_end
        ? new Date(form.auction_end).toISOString()
        : null;

    if (nextAuctionEnd !== oldAuctionEnd) {
      payload.auction_end = nextAuctionEnd;
    }

    const oldImages = carImages(car);

    if (
      JSON.stringify(images) !==
      JSON.stringify(oldImages)
    ) {
      payload.images = [...images];
      payload.thumbnail_url = images[0];
    }

    if (Object.keys(payload).length === 0) {
      setMessage("No changes to save.");
      return;
    }

    const auctionSensitiveFields = [
      "listing_type",
      "access_type",
      "starting_bid",
      "reserve_price",
      "auction_end"
    ];

    if (
      car.status === "live" &&
      car.listing_type === "auction" &&
      auctionSensitiveFields.some(
        (key) => Object.hasOwn(payload, key)
      )
    ) {
      throw new Error(
        "Live auction settings cannot be changed from this editor."
      );
    }

    setBusy(true);

    const updated = await updateCar(car.id, payload);

    if (!updated || updated.id !== car.id) {
      throw new Error(
        "Could not verify saved car. Refresh Inventory."
      );
    }

    if (payload.images) {
      if (
        JSON.stringify(updated.images) !==
          JSON.stringify(payload.images) ||
        updated.thumbnail_url !== payload.thumbnail_url
      ) {
        throw new Error(
          "Photo update could not be verified."
        );
      }
    }

    onSaved(updated);
  } catch (err) {
    setError(err.message || "Save failed.");
  } finally {
    setBusy(false);
  }
}


  return (
    <Modal
      title={`Edit Car — ${car.vehicle_title || "Untitled"}`}
      onClose={busy ? undefined : onClose}
      wide
    >
      <div className="space-y-6">
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 text-xs text-blue-300">
          Edit published cars, manage photos and apply WCD branding.
          Existing bids are not modified.
        </div>

        <section>
          <h3 className="mb-3 font-semibold text-white">
            Vehicle Information
          </h3>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ["vehicle_title", "Car Title", "text"],
              ["variant", "Variant", "text"],
              ["mileage_km", "Mileage (KM)", "number"],
              ["location", "Location", "text"]
            ].map(([name, label, type]) => (
              <label
                key={name}
                className="space-y-1 text-xs text-zinc-400"
              >
                <span>{label}</span>

                <input
                  type={type}
                  min={type === "number" ? 0 : undefined}
                  className={INPUT}
                  value={form[name]}
                  onChange={(event) =>
                    change(name, event.target.value)
                  }
                />
              </label>
            ))}
          </div>
        </section>

        <section className="border-t border-white/10 pt-5">
          <h3 className="mb-3 font-semibold text-white">
            Prices
          </h3>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["base_price_buyer", "Buyer Base Price"],
              ["base_price_dealer", "Dealer Base Price"],
              ["buy_now_price", "Buy Now Price"],
              ["starting_bid", "Starting Bid"],
              ["reserve_price", "Reserve Price"]
            ].map(([name, label]) => (
              <label
                key={name}
                className="space-y-1 text-xs text-zinc-400"
              >
                <span>{label}</span>

                <input
                  type="number"
                  min="0"
                  className={INPUT}
                  value={form[name]}
                  onChange={(event) =>
                    change(name, event.target.value)
                  }
                />
              </label>
            ))}
          </div>
        </section>

        <section className="border-t border-white/10 pt-5">
          <h3 className="mb-3 font-semibold text-white">
            Listing Settings
          </h3>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-xs text-zinc-400">
              Listing Type
              <select
                className={INPUT}
                value={form.listing_type}
                onChange={(event) =>
                  change("listing_type", event.target.value)
                }
              >
                <option value="auction">Auction</option>
                <option value="buy_now_only">Buy Now</option>
              </select>
            </label>

            <label className="space-y-1 text-xs text-zinc-400">
              Access
              <select
                className={INPUT}
                value={form.access_type}
                onChange={(event) =>
                  change("access_type", event.target.value)
                }
              >
                <option value="all">Everyone</option>
                <option value="dealer_only">Dealers Only</option>
              </select>
            </label>

            <label className="space-y-1 text-xs text-zinc-400">
              Visibility
              <select
                className={INPUT}
                value={form.visibility}
                onChange={(event) =>
                  change("visibility", event.target.value)
                }
              >
                <option value="visible">Visible</option>
                <option value="hidden">Hidden</option>
              </select>
            </label>

            {form.listing_type === "auction" && (
              <label className="space-y-1 text-xs text-zinc-400">
                Auction End
                <input
                  type="datetime-local"
                  className={INPUT}
                  value={form.auction_end}
                  onChange={(event) =>
                    change("auction_end", event.target.value)
                  }
                />
              </label>
            )}
          </div>

          <label className="mt-4 flex items-center gap-3 text-sm text-zinc-300">
            <input
              type="checkbox"
              disabled={!canUseC2C}
              checked={
                canUseC2C && form.c2c_enabled === true
              }
              onChange={(event) =>
                change("c2c_enabled", event.target.checked)
              }
            />

            Enable C2C Deal
          </label>

          {!canUseC2C && (
            <p className="mt-1 text-xs text-zinc-500">
              C2C is available only for public Buy Now cars,
              not dealer-channel listings.
            </p>
          )}
        </section>

        <section className="border-t border-white/10 pt-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-white">
                WCD Photo Studio
              </h3>

              <p className="mt-1 text-xs text-zinc-400">
                Select photo, click number plate, apply sticker.
              </p>
            </div>

            <label
              className={`${BUTTON} cursor-pointer bg-blue-600 text-white`}
            >
              <Upload size={14} />
              Add Photos

              <input
                type="file"
                accept="image/*"
                multiple
                disabled={busy}
                className="hidden"
                onChange={addPhotos}
              />
            </label>
          </div>

         
{selectedUrl ? (
  <div className="flex justify-center rounded-xl border border-white/10 bg-black/40 p-2">
    <div className="relative inline-block max-w-full">
      <img
        src={selectedUrl}
        alt="Selected car"
        onClick={placeSticker}
        className="block max-h-[440px] max-w-full cursor-crosshair rounded-lg"
      />

      <div
        className="pointer-events-none absolute flex items-center justify-center overflow-hidden border-2 border-blue-800 bg-white shadow-xl"
        style={{
          left: `${position.x * 100}%`,
          top: `${position.y * 100}%`,
          width: `${stickerWidth * 100}%`,
          aspectRatio: "2.5 / 1",
          transform: "translate(-50%, -50%)"
        }}
      >
        <img
          src={WCD_LOGO_URL}
          alt="WellCarDeals Logo Sticker"
          className="h-full w-full object-contain"
        />
      </div>
    </div>
  </div>
) : (
  <div className="flex h-48 items-center justify-center rounded-xl bg-white/5 text-zinc-500">
    <ImageOff size={28} />
  </div>
)}

          <div className="mt-4 space-y-3">
            <p className="text-xs text-zinc-400">
              Number plate par click karo. White-blue WCD
              sticker us position par apply hoga.
            </p>

            <label className="block space-y-2 text-xs text-zinc-400">
              Sticker Size: {Math.round(stickerWidth * 100)}%

              <input
                type="range"
                min="0.08"
                max="0.6"
                step="0.01"
                className="w-full"
                value={stickerWidth}
                onChange={(event) =>
                  setStickerWidth(Number(event.target.value))
                }
              />
            </label>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy || !selectedUrl}
                onClick={applySticker}
                className={`${BUTTON} bg-indigo-600 text-white`}
              >
                <Sticker size={14} />
                Apply WCD Sticker
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={restorePhotos}
                className={`${BUTTON} border border-white/10 text-zinc-300`}
              >
                <RotateCcw size={14} />
                Restore Original Listing Photos
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-6">
            {images.map((url, index) => (
              <div key={`${url}-${index}`} className="space-y-1">
                <button
                  type="button"
                  onClick={() => setSelectedImage(index)}
                  className={`w-full overflow-hidden rounded-lg border-2 ${
                    selectedImage === index
                      ? "border-blue-500"
                      : "border-white/10"
                  }`}
                >
                  <img
                    src={url}
                    alt={`Photo ${index + 1}`}
                    className="h-20 w-full object-cover"
                  />
                </button>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => removeImage(index)}
                  className="flex w-full items-center justify-center gap-1 text-xs text-red-400"
                >
                  <Trash2 size={11} />
                  Remove
                </button>
              </div>
            ))}
          </div>
        </section>

        {error && (
          <div className="rounded-xl bg-red-500/10 p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {message && (
          <div className="rounded-xl bg-emerald-500/10 p-3 text-sm text-emerald-400">
            {message}
          </div>
        )}

        <div className="sticky bottom-0 flex justify-end gap-3 border-t border-white/10 bg-zinc-900 py-4">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className={`${BUTTON} border border-white/10 text-zinc-300`}
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={save}
            className={`${BUTTON} bg-emerald-600 px-5 text-white`}
          >
            {busy ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Save size={15} />
            )}

            {busy ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ============================================================
// PRICE EDITOR
// ============================================================

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

  const [search, setSearch] = useState("");
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

    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map(
            (value) =>
              `"${String(value ?? "").replace(/"/g, '""')}"`
          )
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;"
    });

    const url = URL.createObjectURL(blob);

    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "wellcardeals-inventory.csv";
    anchor.click();

    URL.revokeObjectURL(url);
  }

  // ----------------------------------------------------------
  // UI
  // ----------------------------------------------------------

  return (
    <div className="space-y-5">
      {editCar && (
        <EditCarModal
          car={editCar}
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

        <div className="flex gap-2">
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
        <div className="space-y-4">
          {filtered.map((car) => {
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
                    {canEdit && (
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

                    {canEdit && (
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
        </div>
      )}
    </div>
  );
}
