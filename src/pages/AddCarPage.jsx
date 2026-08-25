import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, AlertCircle, Trash2, Plus } from "lucide-react";
import FormSection, { Field, inputClass } from "../components/FormSection";
import LookupSelect from "../components/LookupSelect";
import FeaturePicker from "../components/FeaturePicker";
import FileDropzone from "../components/FileDropzone";
import { useLookups } from "../hooks/useLookups";
import { useModels } from "../hooks/useModels";
import {
  addLookupValue,
  addModel,
  addFeature,
  uploadCarFile,
  uploadManyCarFiles,
  createCar,
} from "../lib/carsApi";
import {
  FEATURE_CATEGORIES,
  OWNERSHIP_OPTIONS,
  DRIVE_TYPE_OPTIONS,
  RC_STATUS_OPTIONS,
  FINANCE_STATUS_OPTIONS,
  CHANNEL_OPTIONS,
  LISTING_TYPE_OPTIONS,
  STATUS_OPTIONS,
} from "../lib/lookups";

const emptyForm = {
  vehicle_title: "",
  brand_id: null,
  model_id: null,
  variant: "",
  year: "",
  registration_year: "",
  mileage_km: "",
  fuel_type_id: null,
  transmission_id: null,
  body_type_id: null,
  color_id: null,
  category_id: null,
  ownership: "1st",
  vin_number: "",
  engine_number: "",
  engine_capacity: "",
  horsepower: "",
  torque: "",
  drive_type: "FWD",
  seating_capacity: "",
  doors: "",
  location: "",
  registration_state: "",
  insurance_validity: "",
  rc_status: "Clear",
  puc_status: "",
  service_history: "",
  accidental_history: "",
  number_of_keys: "",
  finance_status: "No Loan",
  description: "",
  seller_notes: "",
  safety_features: [],
  comfort_features: [],
  exterior_features: [],
  interior_features: [],
  infotainment_features: [],
  reserve_price: "",
  starting_bid: "",
  buy_now_price: "",
  minimum_increment: 5000,
  auction_start: "",
  auction_end: "",
  status: "draft",
  visibility: "hidden",
  channel: "buyer",
  listing_type: "auction",
  is_featured: false,
  is_verified: false,
};

const DRAFT_KEY = "admin_add_car_draft_v1";
const SPEC_ROWS_DRAFT_KEY = "admin_add_car_spec_rows_draft_v1";

export default function AddCarPage() {
  const { lookups, features, loading, error: lookupError, reload } = useLookups();

  // Restore any in-progress draft on first render (covers accidental
  // navigation away, tab close, or refresh before "Save Car" was hit).
  const [form, setForm] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(DRAFT_KEY));
      return saved ? { ...emptyForm, ...saved } : emptyForm;
    } catch {
      return emptyForm;
    }
  });
  const [draftRestored] = useState(() => {
    try {
      return Boolean(localStorage.getItem(DRAFT_KEY));
    } catch {
      return false;
    }
  });
  const { models, reload: reloadModels } = useModels(form.brand_id);

  const [specRows, setSpecRows] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(SPEC_ROWS_DRAFT_KEY));
      return Array.isArray(saved) && saved.length ? saved : [{ key: "", value: "" }];
    } catch {
      return [{ key: "", value: "" }];
    }
  });
  // Note: photos/videos/documents are File objects and can't be persisted
  // to localStorage — those will need to be re-attached if the page is
  // accidentally left. Everything else survives.
  const [thumbnail, setThumbnail] = useState([]);
  const [images, setImages] = useState([]);
  const [images360, setImages360] = useState([]);
  const [videos, setVideos] = useState([]);
  const [documents, setDocuments] = useState([]);

  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState(null); // { ok: true/false, message }

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  // Autosave text/select fields + spec rows on every change.
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
    } catch {
      // localStorage full/unavailable — fail silently, non-critical.
    }
  }, [form]);
  useEffect(() => {
    try {
      localStorage.setItem(SPEC_ROWS_DRAFT_KEY, JSON.stringify(specRows));
    } catch {
      // non-critical
    }
  }, [specRows]);

  function updateSpecRow(idx, key, value) {
    setSpecRows((rows) => rows.map((r, i) => (i === idx ? { ...r, [key]: value } : r)));
  }
  function addSpecRow() {
    setSpecRows((rows) => [...rows, { key: "", value: "" }]);
  }
  function removeSpecRow(idx) {
    setSpecRows((rows) => rows.filter((_, i) => i !== idx));
  }

  async function handleAddBrand(name) {
    const created = await addLookupValue("brands", { name });
    await reload();
    return created;
  }
  async function handleAddModel(name) {
    if (!form.brand_id) throw new Error("Pick a brand first");
    const created = await addModel(form.brand_id, name);
    await reloadModels();
    return created;
  }
  async function handleAddFeature(category, name) {
    await addFeature(category, name);
    await reload();
  }

  function validate() {
    if (!form.vehicle_title.trim()) return "Vehicle title is required.";
    if (!form.brand_id) return "Pick a brand.";
    if (form.listing_type === "buy_now_only" && !form.buy_now_price) {
      return "Buy Now Price is required for a Buy Now Only listing.";
    }
    if (form.auction_start && form.auction_end && form.auction_start >= form.auction_end) {
      return "Auction end must be after auction start.";
    }
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setResult(null);
    const validationError = validate();
    if (validationError) {
      setResult({ ok: false, message: validationError });
      return;
    }

    setSaving(true);
    try {
      setProgress("Uploading thumbnail...");
      const thumbnailUrl = thumbnail[0] ? await uploadCarFile(thumbnail[0], "thumbnails") : null;

      setProgress("Uploading gallery images...");
      const imageUrls = await uploadManyCarFiles(images, "images");

      setProgress("Uploading 360 images...");
      const images360Urls = await uploadManyCarFiles(images360, "images-360");

      setProgress("Uploading videos...");
      const videoUrls = await uploadManyCarFiles(videos, "videos");

      setProgress("Uploading documents...");
      const documentUrls = await Promise.all(
        documents.map(async (doc) => ({ name: doc.name, url: await uploadCarFile(doc, "documents") }))
      );

      const specifications = Object.fromEntries(
        specRows.filter((r) => r.key.trim()).map((r) => [r.key.trim(), r.value])
      );

      setProgress("Saving car to database...");
      const payload = {
        ...form,
        year: form.year ? Number(form.year) : null,
        registration_year: form.registration_year ? Number(form.registration_year) : null,
        mileage_km: form.mileage_km ? Number(form.mileage_km) : null,
        horsepower: form.horsepower ? Number(form.horsepower) : null,
        seating_capacity: form.seating_capacity ? Number(form.seating_capacity) : null,
        doors: form.doors ? Number(form.doors) : null,
        number_of_keys: form.number_of_keys ? Number(form.number_of_keys) : null,
        reserve_price: form.reserve_price ? Number(form.reserve_price) : null,
        starting_bid: form.starting_bid ? Number(form.starting_bid) : null,
        buy_now_price: form.buy_now_price ? Number(form.buy_now_price) : null,
        minimum_increment: Number(form.minimum_increment) || 5000,
        insurance_validity: form.insurance_validity || null,
        auction_start: form.auction_start || null,
        auction_end: form.auction_end || null,
        specifications,
        thumbnail_url: thumbnailUrl,
        images: imageUrls,
        images_360: images360Urls,
        videos: videoUrls,
        documents: documentUrls,
      };

      await createCar(payload);

      setResult({ ok: true, message: "Car saved successfully." });
      setForm(emptyForm);
      setSpecRows([{ key: "", value: "" }]);
      setThumbnail([]);
      setImages([]);
      setImages360([]);
      setVideos([]);
      setDocuments([]);
      try {
        localStorage.removeItem(DRAFT_KEY);
        localStorage.removeItem(SPEC_ROWS_DRAFT_KEY);
      } catch {
        // non-critical
      }
    } catch (err) {
      setResult({ ok: false, message: err.message || "Something went wrong while saving." });
    } finally {
      setSaving(false);
      setProgress("");
    }
  }

  if (loading) return <p className="text-zinc-400">Loading form data...</p>;
  if (lookupError)
    return (
      <p className="text-red-400">
        Couldn't load dropdown data: {lookupError}. Make sure car_management_schema.sql has been run in
        Supabase.
      </p>
    );

  return (
    <form onSubmit={handleSubmit} className="pb-24">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Add Car</h1>
        <p className="text-zinc-400">Every field here is saved straight to the `cars` table in Supabase.</p>
      </div>

      {draftRestored && !result && (
        <div className="mb-6 flex items-center gap-2 rounded-xl px-4 py-3 text-sm bg-amber-500/10 text-amber-400 border border-amber-500/30">
          <AlertCircle size={18} /> Restored your unsaved draft from last time. Photos/videos/documents need to be re-attached.
        </div>
      )}

      {result && (
        <div
          className={`mb-6 flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${
            result.ok ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30" : "bg-red-500/10 text-red-400 border border-red-500/30"
          }`}
        >
          {result.ok ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          {result.message}
        </div>
      )}

      <div className="space-y-5">
        <FormSection title="Vehicle Identity">
          <Field label="Vehicle Title" full>
            <input className={inputClass} value={form.vehicle_title} onChange={(e) => set("vehicle_title", e.target.value)} placeholder="e.g. 2021 Honda City ZX CVT" />
          </Field>
          <Field label="Brand">
            <LookupSelect options={lookups.brands || []} value={form.brand_id} onChange={(v) => { set("brand_id", v); set("model_id", null); }} onAddNew={handleAddBrand} />
          </Field>
          <Field label="Model">
            <LookupSelect options={models} value={form.model_id} onChange={(v) => set("model_id", v)} onAddNew={handleAddModel} placeholder={form.brand_id ? "Select model..." : "Pick a brand first"} />
          </Field>
          <Field label="Variant">
            <input className={inputClass} value={form.variant} onChange={(e) => set("variant", e.target.value)} />
          </Field>
          <Field label="Year">
            <input type="number" className={inputClass} value={form.year} onChange={(e) => set("year", e.target.value)} />
          </Field>
          <Field label="Registration Year">
            <input type="number" className={inputClass} value={form.registration_year} onChange={(e) => set("registration_year", e.target.value)} />
          </Field>
          <Field label="Mileage (km)">
            <input type="number" className={inputClass} value={form.mileage_km} onChange={(e) => set("mileage_km", e.target.value)} />
          </Field>
          <Field label="Fuel Type">
            <LookupSelect options={lookups.fuel_types || []} value={form.fuel_type_id} onChange={(v) => set("fuel_type_id", v)} onAddNew={(name) => addLookupValue("fuel_types", { name }).then((r) => reload().then(() => r))} />
          </Field>
          <Field label="Transmission">
            <LookupSelect options={lookups.transmissions || []} value={form.transmission_id} onChange={(v) => set("transmission_id", v)} onAddNew={(name) => addLookupValue("transmissions", { name }).then((r) => reload().then(() => r))} />
          </Field>
          <Field label="Body Type">
            <LookupSelect options={lookups.body_types || []} value={form.body_type_id} onChange={(v) => set("body_type_id", v)} onAddNew={(name) => addLookupValue("body_types", { name }).then((r) => reload().then(() => r))} />
          </Field>
          <Field label="Color">
            <LookupSelect options={lookups.colors || []} value={form.color_id} onChange={(v) => set("color_id", v)} onAddNew={(name) => addLookupValue("colors", { name }).then((r) => reload().then(() => r))} />
          </Field>
          <Field label="Vehicle Category">
            <LookupSelect options={lookups.vehicle_categories || []} value={form.category_id} onChange={(v) => set("category_id", v)} onAddNew={(name) => addLookupValue("vehicle_categories", { name }).then((r) => reload().then(() => r))} />
          </Field>
          <Field label="Ownership">
            <select className={inputClass} value={form.ownership} onChange={(e) => set("ownership", e.target.value)}>
              {OWNERSHIP_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </Field>
        </FormSection>

        <FormSection title="Technical Specifications">
          <Field label="VIN / Chassis Number"><input className={inputClass} value={form.vin_number} onChange={(e) => set("vin_number", e.target.value)} /></Field>
          <Field label="Engine Number"><input className={inputClass} value={form.engine_number} onChange={(e) => set("engine_number", e.target.value)} /></Field>
          <Field label="Engine Capacity"><input className={inputClass} placeholder="e.g. 1498 cc" value={form.engine_capacity} onChange={(e) => set("engine_capacity", e.target.value)} /></Field>
          <Field label="Horsepower"><input type="number" className={inputClass} value={form.horsepower} onChange={(e) => set("horsepower", e.target.value)} /></Field>
          <Field label="Torque"><input className={inputClass} placeholder="e.g. 200 Nm" value={form.torque} onChange={(e) => set("torque", e.target.value)} /></Field>
          <Field label="Drive Type">
            <select className={inputClass} value={form.drive_type} onChange={(e) => set("drive_type", e.target.value)}>
              {DRIVE_TYPE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </Field>
          <Field label="Seating Capacity"><input type="number" className={inputClass} value={form.seating_capacity} onChange={(e) => set("seating_capacity", e.target.value)} /></Field>
          <Field label="Doors"><input type="number" className={inputClass} value={form.doors} onChange={(e) => set("doors", e.target.value)} /></Field>
        </FormSection>

        <FormSection title="Location & Compliance">
          <Field label="Location"><input className={inputClass} value={form.location} onChange={(e) => set("location", e.target.value)} /></Field>
          <Field label="Registration State">
            <LookupSelect options={lookups.states || []} value={null} onChange={() => {}} onAddNew={(name) => addLookupValue("states", { name }).then((r) => reload().then(() => r))} placeholder="Manage states below, type freely ->" />
          </Field>
          <Field label="Registration State (free text)" full>
            <input className={inputClass} value={form.registration_state} onChange={(e) => set("registration_state", e.target.value)} placeholder="e.g. Delhi" />
          </Field>
          <Field label="Insurance Validity"><input type="date" className={inputClass} value={form.insurance_validity} onChange={(e) => set("insurance_validity", e.target.value)} /></Field>
          <Field label="RC Status">
            <select className={inputClass} value={form.rc_status} onChange={(e) => set("rc_status", e.target.value)}>
              {RC_STATUS_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </Field>
          <Field label="PUC Status"><input className={inputClass} value={form.puc_status} onChange={(e) => set("puc_status", e.target.value)} /></Field>
          <Field label="Service History"><input className={inputClass} value={form.service_history} onChange={(e) => set("service_history", e.target.value)} /></Field>
          <Field label="Accidental History"><input className={inputClass} value={form.accidental_history} onChange={(e) => set("accidental_history", e.target.value)} /></Field>
          <Field label="Number of Keys"><input type="number" className={inputClass} value={form.number_of_keys} onChange={(e) => set("number_of_keys", e.target.value)} /></Field>
          <Field label="Finance Status">
            <select className={inputClass} value={form.finance_status} onChange={(e) => set("finance_status", e.target.value)}>
              {FINANCE_STATUS_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </Field>
        </FormSection>

        <FormSection title="Description & Notes">
          <Field label="Description" full>
            <textarea rows={4} className={inputClass} value={form.description} onChange={(e) => set("description", e.target.value)} />
          </Field>
          <Field label="Seller Notes" full>
            <textarea rows={3} className={inputClass} value={form.seller_notes} onChange={(e) => set("seller_notes", e.target.value)} />
          </Field>
        </FormSection>

        <FormSection title="Features" subtitle="Tap to select. Type a new one and hit Add if it's missing.">
          {FEATURE_CATEGORIES.map(({ key, category, label }) => (
            <Field key={key} label={label} full>
              <FeaturePicker
                category={category}
                allFeatures={features}
                selected={form[key]}
                onChange={(vals) => set(key, vals)}
                onAddNew={handleAddFeature}
              />
            </Field>
          ))}
        </FormSection>

        <FormSection title="Specifications" subtitle="Free-form key/value pairs, e.g. Ground Clearance -> 185mm">
          <div className="md:col-span-2 flex flex-col gap-2">
            {specRows.map((row, i) => (
              <div key={i} className="flex gap-2">
                <input className={inputClass} placeholder="Key" value={row.key} onChange={(e) => updateSpecRow(i, "key", e.target.value)} />
                <input className={inputClass} placeholder="Value" value={row.value} onChange={(e) => updateSpecRow(i, "value", e.target.value)} />
                <button type="button" onClick={() => removeSpecRow(i)} className="shrink-0 rounded-xl border border-white/10 px-3 text-zinc-400 hover:text-red-400 hover:bg-white/5">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            <button type="button" onClick={addSpecRow} className="self-start flex items-center gap-1.5 text-sm text-amber-400 hover:underline mt-1">
              <Plus size={14} /> Add row
            </button>
          </div>
        </FormSection>

        <FormSection title="Pricing & Auction">
          <Field label="Listing Type" hint="Buy Now Only cars skip bidding entirely — buyers can only purchase at the fixed price.">
            <select className={inputClass} value={form.listing_type} onChange={(e) => set("listing_type", e.target.value)}>
              {LISTING_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <Field label="Buy Now Price" hint={form.listing_type === "buy_now_only" ? "Required for Buy Now Only listings." : "Optional — lets buyers skip bidding on an auction car too."}>
            <input type="number" className={inputClass} value={form.buy_now_price} onChange={(e) => set("buy_now_price", e.target.value)} />
          </Field>

          {form.listing_type === "auction" && (
            <>
              <Field label="Reserve Price"><input type="number" className={inputClass} value={form.reserve_price} onChange={(e) => set("reserve_price", e.target.value)} /></Field>
              <Field label="Starting Bid"><input type="number" className={inputClass} value={form.starting_bid} onChange={(e) => set("starting_bid", e.target.value)} /></Field>
              <Field label="Minimum Increment"><input type="number" className={inputClass} value={form.minimum_increment} onChange={(e) => set("minimum_increment", e.target.value)} /></Field>
              <Field label="Auction Start"><input type="datetime-local" className={inputClass} value={form.auction_start} onChange={(e) => set("auction_start", e.target.value)} /></Field>
              <Field label="Auction End"><input type="datetime-local" className={inputClass} value={form.auction_end} onChange={(e) => set("auction_end", e.target.value)} /></Field>
            </>
          )}
        </FormSection>

        <FormSection title="Visibility & Channel">
          <Field label="Channel" hint="Buyer and Dealer auctions are always shown separately.">
            <select className={inputClass} value={form.channel} onChange={(e) => set("channel", e.target.value)}>
              {CHANNEL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select className={inputClass} value={form.status} onChange={(e) => set("status", e.target.value)}>
              {STATUS_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </Field>
          <Field label="Visibility">
            <select className={inputClass} value={form.visibility} onChange={(e) => set("visibility", e.target.value)}>
              <option value="visible">Visible (public can see once status isn't draft)</option>
              <option value="hidden">Hidden</option>
            </select>
          </Field>
          <div className="flex items-center gap-6 md:col-span-2">
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input type="checkbox" checked={form.is_featured} onChange={(e) => set("is_featured", e.target.checked)} className="accent-amber-500 w-4 h-4" />
              Featured
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input type="checkbox" checked={form.is_verified} onChange={(e) => set("is_verified", e.target.checked)} className="accent-amber-500 w-4 h-4" />
              Verified
            </label>
          </div>
        </FormSection>

        <FormSection title="Media">
          <Field label="Thumbnail" full>
            <FileDropzone accept="image/*" multiple={false} files={thumbnail} onChange={setThumbnail} label="Upload thumbnail" />
          </Field>
          <Field label="Gallery Images" full>
            <FileDropzone accept="image/*" files={images} onChange={setImages} label="Upload images" />
          </Field>
          <Field label="360° Images" full>
            <FileDropzone accept="image/*" files={images360} onChange={setImages360} label="Upload 360° set" />
          </Field>
          <Field label="Videos" full>
            <FileDropzone accept="video/*" files={videos} onChange={setVideos} label="Upload videos" />
          </Field>
          <Field label="Documents" full>
            <FileDropzone accept=".pdf,.doc,.docx,image/*" files={documents} onChange={setDocuments} label="Upload documents" />
          </Field>
        </FormSection>
      </div>

      <div className="sticky bottom-0 mt-8 -mx-4 md:-mx-8 px-4 md:px-8 py-4 bg-zinc-950/90 backdrop-blur border-t border-white/10 flex items-center gap-4">
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-black font-semibold px-6 py-3 flex items-center gap-2"
        >
          {saving && <Loader2 size={18} className="animate-spin" />}
          {saving ? progress || "Saving..." : "Save Car"}
        </button>
        {saving && <span className="text-sm text-zinc-400">{progress}</span>}
      </div>
    </form>
  );
}
