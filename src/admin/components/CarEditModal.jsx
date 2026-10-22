
import { useEffect, useState } from "react";
import { X, Save, Upload, Image as ImageIcon } from "lucide-react";
import { updateCar, uploadCarFile } from "../lib/carsApi";

const INPUT =
  "w-full rounded-lg border border-white/10 bg-zinc-800 px-3 py-2 text-sm text-white";

function getImages(car) {
  return Array.isArray(car.images)
    ? car.images.filter((url) => typeof url === "string" && url)
    : [];
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(
        new Error(
          "Photo could not be loaded. Check image URL and Storage CORS settings."
        )
      );
    img.src = url;
  });
}

async function makeStickerImage(url, position, scale) {
  const image = await loadImage(url);

  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable.");

  ctx.drawImage(image, 0, 0);

  const width = canvas.width * scale;
  const height = width * 0.24;

  const x = position.x * canvas.width - width / 2;
  const y = position.y * canvas.height - height / 2;

  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#153e90";
  ctx.lineWidth = Math.max(2, width * 0.025);

  ctx.fillRect(x, y, width, height);
  ctx.strokeRect(x, y, width, height);

  ctx.fillStyle = "#153e90";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `bold ${Math.max(10, height * 0.49)}px Arial`;
  ctx.fillText(
    "WELLCARDEALS",
    x + width / 2,
    y + height / 2,
    width * 0.93
  );

  const blob = await new Promise((resolve, reject) => {
    try {
      canvas.toBlob(
        (result) =>
          result
            ? resolve(result)
            : reject(new Error("Image export failed.")),
        "image/jpeg",
        0.92
      );
    } catch (error) {
      reject(error);
    }
  });

  return new File([blob], `wcd-${Date.now()}.jpg`, {
    type: "image/jpeg",
  });
}

export default function CarEditModal({
  car,
  onClose,
  onSaved,
}) {
  const [form, setForm] = useState({
    vehicle_title: car.vehicle_title || "",
    variant: car.variant || "",
    mileage_km: car.mileage_km ?? "",
    location: car.location || "",
  });

  const [images, setImages] = useState(() => getImages(car));
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [position, setPosition] = useState({ x: 0.5, y: 0.7 });
  const [scale, setScale] = useState(0.24);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const selectedUrl = images[selectedIndex] || null;

  useEffect(() => {
    setError("");
    setMessage("");
  }, [selectedIndex]);

  function change(field, value) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  function choosePosition(event) {
    const rect = event.currentTarget.getBoundingClientRect();

    setPosition({
      x: Math.max(
        scale / 2,
        Math.min(1 - scale / 2, (event.clientX - rect.left) / rect.width)
      ),
      y: Math.max(
        0.04,
        Math.min(0.96, (event.clientY - rect.top) / rect.height)
      ),
    });
  }

  async function uploadPhotos(event) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    setBusy(true);
    setError("");

    try {
      const uploaded = [];

      for (const file of files) {
        if (!file.type.startsWith("image/")) {
          throw new Error("Please select image files only.");
        }

        const url = await uploadCarFile(
          file,
          `cars/${car.id}/photos`
        );

        uploaded.push(url);
      }

      setImages((previous) => [...previous, ...uploaded]);
      setMessage("Photos uploaded. Click Save Changes to publish.");
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
      const file = await makeStickerImage(
        selectedUrl,
        position,
        scale
      );

      const url = await uploadCarFile(
        file,
        `cars/${car.id}/wcd-stickers`
      );

      setImages((previous) =>
        previous.map((item, index) =>
          index === selectedIndex ? url : item
        )
      );

      setMessage(
        "WCD sticker applied to selected photo. Save Changes to publish."
      );
    } catch (err) {
      setError(err.message || "Sticker could not be applied.");
    } finally {
      setBusy(false);
    }
  }

  function removePhoto(index) {
    setImages((previous) =>
      previous.filter((_, i) => i !== index)
    );
    setSelectedIndex(0);
  }

  async function save() {
    if (!form.vehicle_title.trim()) {
      setError("Car title is required.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const mileage =
        form.mileage_km === ""
          ? null
          : Number(form.mileage_km);

      if (
        mileage !== null &&
        (!Number.isFinite(mileage) || mileage < 0)
      ) {
        throw new Error("Enter a valid mileage.");
      }

      const payload = {
        vehicle_title: form.vehicle_title.trim(),
        variant: form.variant.trim(),
        mileage_km: mileage,
        location: form.location.trim(),
        images,
        thumbnail_url: images[0] || null,
      };

      const updated = await updateCar(car.id, payload);

      onSaved?.(updated || { ...car, ...payload });
    } catch (err) {
      setError(err.message || "Could not save car.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-3">
      <div className="max-h-[94vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-white/10 bg-zinc-900 text-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-zinc-900 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold">Edit Car</h2>
            <p className="text-xs text-zinc-400">
              Edit published listing and WCD photo branding
            </p>
          </div>

          <button onClick={onClose} disabled={busy}>
            <X size={22} />
          </button>
        </div>

        <div className="space-y-6 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1 text-xs text-zinc-400">
              Car Title
              <input
                className={INPUT}
                value={form.vehicle_title}
                onChange={(e) =>
                  change("vehicle_title", e.target.value)
                }
              />
            </label>

            <label className="space-y-1 text-xs text-zinc-400">
              Variant
              <input
                className={INPUT}
                value={form.variant}
                onChange={(e) =>
                  change("variant", e.target.value)
                }
              />
            </label>

            <label className="space-y-1 text-xs text-zinc-400">
              Mileage (KM)
              <input
                type="number"
                min="0"
                className={INPUT}
                value={form.mileage_km}
                onChange={(e) =>
                  change("mileage_km", e.target.value)
                }
              />
            </label>

            <label className="space-y-1 text-xs text-zinc-400">
              Location
              <input
                className={INPUT}
                value={form.location}
                onChange={(e) =>
                  change("location", e.target.value)
                }
              />
            </label>
          </div>

          <section className="space-y-3 border-t border-white/10 pt-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-semibold">Car Photos</h3>

              <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold">
                <Upload size={14} />
                Add Photos
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  disabled={busy}
                  onChange={uploadPhotos}
                />
              </label>
            </div>

            {selectedUrl ? (
              <div
                className="relative mx-auto w-fit max-w-full cursor-crosshair overflow-hidden rounded-xl border border-white/10"
                onClick={choosePosition}
                title="Click the number plate to position WCD sticker"
              >
                <img
                  src={selectedUrl}
                  alt="Selected car"
                  className="block max-h-[420px] max-w-full"
                />

                <div
                  className="pointer-events-none absolute flex items-center justify-center border-2 border-blue-800 bg-white text-center font-bold text-blue-900 shadow-lg"
                  style={{
                    left: `${position.x * 100}%`,
                    top: `${position.y * 100}%`,
                    width: `${scale * 100}%`,
                    aspectRatio: "4.17 / 1",
                    transform: "translate(-50%, -50%)",
                    fontSize: "clamp(6px, 1.2vw, 15px)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                  }}
                >
                  WELLCARDEALS
                </div>
              </div>
            ) : (
              <div className="flex h-48 items-center justify-center rounded-xl bg-white/5 text-zinc-500">
                <ImageIcon size={28} />
              </div>
            )}

            <p className="text-xs text-zinc-400">
              Photo mein number plate par click karo. Sticker us
              position par lagega. Ye preview hai; Apply WCD
              Sticker se branded image generate hogi.
            </p>

            <label className="block space-y-2 text-xs text-zinc-400">
              Sticker Width: {Math.round(scale * 100)}%
              <input
                type="range"
                min="0.08"
                max="0.6"
                step="0.01"
                value={scale}
                onChange={(e) =>
                  setScale(Number(e.target.value))
                }
                className="w-full"
              />
            </label>

            <button
              disabled={busy || !selectedUrl}
              onClick={applySticker}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              Apply WCD Sticker
            </button>

            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
              {images.map((url, index) => (
                <div key={`${url}-${index}`} className="space-y-1">
                  <button
                    onClick={() => setSelectedIndex(index)}
                    className={`w-full overflow-hidden rounded-lg border-2 ${
                      selectedIndex === index
                        ? "border-blue-500"
                        : "border-white/10"
                    }`}
                  >
                    <img
                      src={url}
                      alt={`Car photo ${index + 1}`}
                      className="h-20 w-full object-cover"
                    />
                  </button>

                  <button
                    disabled={busy}
                    onClick={() => removePhoto(index)}
                    className="w-full text-xs text-red-400"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </section>

          {error && (
            <p className="rounded-lg bg-red-500/10 p-3 text-sm text-red-400">
              {error}
            </p>
          )}

          {message && (
            <p className="rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-400">
              {message}
            </p>
          )}

          <div className="flex justify-end gap-3 border-t border-white/10 pt-4">
            <button
              disabled={busy}
              onClick={onClose}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm"
            >
              Cancel
            </button>

            <button
              disabled={busy}
              onClick={save}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold disabled:opacity-50"
            >
              <Save size={15} />
              {busy ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
