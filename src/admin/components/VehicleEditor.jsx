import { useEffect, useRef, useState } from "react";
import { Loader2, CheckCircle2, AlertCircle, Trash2, Plus } from "lucide-react";
import FormSection, { Field, inputClass } from "./FormSection";
import LookupSelect from "./LookupSelect";
import FeaturePicker from "./FeaturePicker";
import FileDropzone from "./FileDropzone";
import { useLookups } from "../hooks/useLookups";
import { useModels } from "../hooks/useModels";
import {
  addLookupValue,
  addModel,
  addFeature,
  uploadCarFile,
  uploadManyCarFiles,
  createCar,
  updateCar,
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
  INSPECTION_CATEGORIES,
  INSPECTION_STATUS_OPTIONS,
} from "../lib/lookups";

import { EMPTY_VEHICLE, initialVehicle, validateVehicle, vehiclePayload, VEHICLE_SECTIONS } from "../lib/vehicleForm";
import PhotoStudio from "./PhotoStudio";
const emptyForm = EMPTY_VEHICLE;

const DRAFT_KEY = "admin_add_car_draft_v1";
const SPEC_ROWS_DRAFT_KEY = "admin_add_car_spec_rows_draft_v1";

export default function VehicleEditor({ car = null, bidCount = 0, onSaved, onCancel, onBusyChange }) {
  const [activeSection, setActiveSection] = useState(0);
  const formElement=useRef(null);
  const showFormStart=()=>{const dialog=formElement.current?.closest("dialog");if(dialog)dialog.scrollTo({top:0});else window.scrollTo({top:0,behavior:"smooth"});};
  const [mediaBusy,setMediaBusy]=useState(false);
  const [existingMedia, setExistingMedia] = useState(() => ({ thumbnail_url:car?.thumbnail_url || null, images:Array.isArray(car?.images)?car.images:[], images_360:Array.isArray(car?.images_360)?car.images_360:[], videos:Array.isArray(car?.videos)?car.videos:[], documents:Array.isArray(car?.documents)?car.documents:[] }));
  const saveLock = useRef(false);
  const { lookups, features, loading, error: lookupError, reload } = useLookups();

  // Restore any in-progress draft on first render (covers accidental
  // navigation away, tab close, or refresh before "Save Car" was hit).
  const [form, setForm] = useState(() => {
    if (car) return initialVehicle(car);
    try {
      const saved = JSON.parse(localStorage.getItem(DRAFT_KEY));
      return saved ? { ...emptyForm, ...saved } : initialVehicle(null);
    } catch {
      return emptyForm;
    }
  });
  const [draftRestored] = useState(() => {
    try {
      return !car && Boolean(localStorage.getItem(DRAFT_KEY));
    } catch {
      return false;
    }
  });
  const { models, reload: reloadModels } = useModels(form.brand_id);

  const [specRows, setSpecRows] = useState(() => {
    if (car) return Object.entries(car.specifications || {}).map(([key,value])=>({key,value}));
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

  const pendingPayload = useRef(null);
  const [savePending,setSavePending]=useState(false);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState(null); // { ok: true/false, message }

  function set(field, value) {
    setResult(null);
    setForm((f) => {
      if (field === "listing_type" || field === "channel" || field === "access_type") {
        const dealer = field === "listing_type" ? value === "auction" : field === "channel" ? value === "dealer" : value === "dealer_only";
        return { ...f, listing_type:dealer?"auction":"buy_now_only", channel:dealer?"dealer":"buyer", access_type:dealer?"dealer_only":"all", c2c_enabled:dealer?false:f.c2c_enabled };
      }
      return { ...f, [field]:value };
    });
  }

  function setInspectionCategory(key, field, value) {
    setForm((f) => ({
      ...f,
      inspection: {
        ...f.inspection,
        [key]: field === "status" && !value ? null : { ...(f.inspection[key] || {}), [field]: value },
      },
    }));
  }

  // Autosave text/select fields + spec rows on every change.
  useEffect(() => {
    if (car) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
    } catch {
      // localStorage full/unavailable — fail silently, non-critical.
    }
  }, [form, car]);
  useEffect(() => {
    if (car) return;
    try {
      localStorage.setItem(SPEC_ROWS_DRAFT_KEY, JSON.stringify(specRows));
    } catch {
      // non-critical
    }
  }, [specRows, car]);

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

  async function handleSubmit(e) {
    e.preventDefault();
    if (saveLock.current || mediaBusy) return;
    setResult(null);
    const validationError = pendingPayload.current ? null : validateVehicle(form, {car,bidCount,specRows});
    if (validationError) {
      setActiveSection(validationError.section);
      requestAnimationFrame(showFormStart);
      setResult({ ok: false, message: validationError.message });
      return;
    }

    saveLock.current = true;
    onBusyChange?.(true);
    setSaving(true);
    try {
      if (!pendingPayload.current) {
        setProgress("Uploading thumbnail...");
        const thumbnailUrl = thumbnail[0] ? await uploadCarFile(thumbnail[0], "thumbnails") : existingMedia.thumbnail_url;

        setProgress("Uploading gallery images...");
        const imageUrls = [...existingMedia.images, ...await uploadManyCarFiles(images, "images")];

        setProgress("Uploading 360 images...");
        const images360Urls = [...existingMedia.images_360, ...await uploadManyCarFiles(images360, "images-360")];

        setProgress("Uploading videos...");
        const videoUrls = [...existingMedia.videos, ...await uploadManyCarFiles(videos, "videos")];

        setProgress("Uploading documents...");
        const documentUrls = [...existingMedia.documents, ...await Promise.all(
          documents.map(async (doc) => ({ name: doc.name, url: await uploadCarFile(doc, "documents") }))
        )];

        setProgress("Saving vehicle details...");
        const payload = vehiclePayload(form, {car,specRows,media:{ thumbnail_url:thumbnailUrl, images:imageUrls, images_360:images360Urls, videos:videoUrls, documents:documentUrls }});
        if (!Object.keys(payload).length) { setResult({ok:true,message:"No changes to save."}); return; }

        pendingPayload.current = payload;
        setSavePending(true);
      }
      const receipt = car ? await updateCar(car.id,pendingPayload.current) : await createCar(pendingPayload.current);
      if (!receipt?.id || (car && receipt.id !== car.id)) throw new Error("Save receipt could not be verified. Retry to check the original save.");
      if (pendingPayload.current.images && JSON.stringify(receipt.images) !== JSON.stringify(pendingPayload.current.images)) throw new Error("Photo save could not be verified. Retry to check the original save.");
      pendingPayload.current = null;
      setSavePending(false);

      onSaved?.(receipt);
      window.dispatchEvent(new Event("wcd-admin-refresh"));
      if (car) return;
      setResult({ ok: true, message: "Vehicle saved successfully." });
      setExistingMedia({thumbnail_url:null,images:[],images_360:[],videos:[],documents:[]});
      setActiveSection(0);
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
      if (err.code === "42501" || err.code === "P0002" || /^(22|23)/.test(err.code || "")) { pendingPayload.current = null; setSavePending(false); }
      setResult({ ok: false, message: pendingPayload.current ? "Save could not be confirmed. Retry checks your previous submission before accepting changes." : err.message || "Something went wrong while saving." });
    } finally {
      saveLock.current = false;
      onBusyChange?.(false);
      setSaving(false);
      setProgress("");
    }
  }

  if (loading) return <p className="text-zinc-400">Loading form data...</p>;
  if (lookupError)
    return (
      <p className="text-red-400">
        Couldn't load dropdown data: {lookupError}. <button type="button" onClick={reload} className="underline">Retry loading dropdowns</button>
      </p>
    );

  return (
    <form ref={formElement} onSubmit={handleSubmit} className="vehicle-editor-form" noValidate>
      <div className="mb-6">
        <p className="aw-eyebrow">INVENTORY / COMPLETE VEHICLE FORM</p><h1 className="text-2xl font-bold">{car ? "Edit vehicle" : "Add a vehicle"}</h1>
        <p className="text-zinc-400">Identity, specifications, inspection, pricing and media in one place.</p>
        {car && <p className="aw-record-id">{car.vehicle_title} · {car.id}</p>}
      </div>

      {draftRestored && !result && (
        <div className="mb-6 flex items-center gap-2 rounded-xl px-4 py-3 text-sm bg-amber-500/10 text-amber-400 border border-amber-500/30">
          <AlertCircle size={18} /> Restored your unsaved draft from last time. Photos/videos/documents need to be re-attached.
        </div>
      )}

      {(bidCount > 0 || car?.status === "sold") && <div className="aw-notice">{car?.status === "sold" ? "Sold vehicle details are retained as a sale record." : "Auction terms are locked because bids exist. You can edit vehicle details, inspection and media."}</div>}
      {result && (
        <div role={result.ok ? "status" : "alert"}
          className={`mb-6 flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${
            result.ok ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30" : "bg-red-500/10 text-red-400 border border-red-500/30"
          }`}
        >
          {result.ok ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          {result.message}
        </div>
      )}

      <div className="vehicle-form-layout"><nav className="vehicle-form-nav" aria-label="Vehicle form sections">{VEHICLE_SECTIONS.map((name,index)=><button type="button" key={name} aria-label={name} aria-current={activeSection===index?"step":undefined} onClick={()=>{setActiveSection(index);showFormStart();}}><span>{String(index+1).padStart(2,"0")}</span>{name}</button>)}<p>All changes are saved together. Existing bids and sale records stay protected.</p></nav><fieldset disabled={saving || mediaBusy || savePending || car?.status === "sold"} className="vehicle-form-body">
        <div hidden={activeSection !== 0}><FormSection collapsible={false} title="Vehicle Identity">
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
        </FormSection></div>

        <div hidden={activeSection !== 1}><FormSection collapsible={false} title="Technical Specifications">
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
        </FormSection></div>

        <div hidden={activeSection !== 2}><FormSection collapsible={false} title="Location & Compliance">
          <Field label="Location"><input className={inputClass} value={form.location} onChange={(e) => set("location", e.target.value)} /></Field>
          <Field label="Registration State">
            <LookupSelect options={(lookups.states || []).map(r=>({...r,id:r.name}))} value={form.registration_state} onChange={v=>set("registration_state",v)} onAddNew={(name) => addLookupValue("states", { name }).then((r) => reload().then(() => ({...r,id:r.name})))} placeholder="Select registration state" />
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
        </FormSection></div>

        <div hidden={activeSection !== 3}><FormSection collapsible={false} title="Description & Notes">
          <Field label="Description" full>
            <textarea rows={4} className={inputClass} value={form.description} onChange={(e) => set("description", e.target.value)} />
          </Field>
          <Field label="Seller Notes" full>
            <textarea rows={3} className={inputClass} value={form.seller_notes} onChange={(e) => set("seller_notes", e.target.value)} />
          </Field>
        </FormSection></div>

        <div hidden={activeSection !== 4}><FormSection collapsible={false}
          title="Inspection Report"
          subtitle="Optional — leave a category as 'Not checked' if it genuinely wasn't inspected. This is what customers see on the car's page, so only mark what's actually been looked at."
        >
          {INSPECTION_CATEGORIES.map(({ key, label }) => (
            <Field key={key} label={label}>
              <div className="flex gap-2">
                <select
                  className={inputClass}
                  value={form.inspection[key]?.status || ""}
                  onChange={(e) => setInspectionCategory(key, "status", e.target.value)}
                >
                  {INSPECTION_STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              {form.inspection[key]?.status && (
                <input
                  className={`${inputClass} mt-2`}
                  aria-label={`${label} inspection note`}
                  placeholder="Note (optional) — e.g. minor scratch on rear bumper"
                  value={form.inspection[key]?.note || ""}
                  onChange={(e) => setInspectionCategory(key, "note", e.target.value)}
                />
              )}
            </Field>
          ))}
          <Field label="Overall Inspection Notes" full>
            <textarea
              rows={3}
              className={inputClass}
              value={form.inspection_notes}
              onChange={(e) => set("inspection_notes", e.target.value)}
              placeholder="Anything a buyer should know that doesn't fit a single category."
            />
          </Field>
        </FormSection></div>

        <div hidden={activeSection !== 5}><FormSection collapsible={false} title="Features" subtitle="Tap to select. Type a new one and hit Add if it's missing.">
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
        </FormSection></div>

        <div hidden={activeSection !== 6}><FormSection collapsible={false} title="Specifications" subtitle="Free-form key/value pairs, e.g. Ground Clearance -> 185mm">
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
        </FormSection></div>

        <div hidden={activeSection !== 7}><FormSection collapsible={false} title="Pricing & Auction">
          <Field label="Listing Type" hint="Buy Now Only cars skip bidding entirely — buyers can only purchase at the fixed price.">
            <select disabled={bidCount > 0} className={inputClass} value={form.listing_type} onChange={(e) => set("listing_type", e.target.value)}>
              {LISTING_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <Field label="Buyer Base Price"><input type="number" min="0" disabled={bidCount > 0} className={inputClass} value={form.base_price_buyer} onChange={e=>set("base_price_buyer",e.target.value)} /></Field>
          <Field label="Dealer Base Price"><input type="number" min="0" disabled={bidCount > 0} className={inputClass} value={form.base_price_dealer} onChange={e=>set("base_price_dealer",e.target.value)} /></Field>
          <Field label="Buy Now Price" hint={form.listing_type === "buy_now_only" ? "Required for Buy Now Only listings." : "Used for direct purchases. Dealer bidding uses the auction fields below."}>
            <input type="number" className={inputClass} value={form.buy_now_price} onChange={(e) => set("buy_now_price", e.target.value)} />
          </Field>

          {form.listing_type === "auction" && (
            <>
              <Field label="Reserve Price"><input type="number" disabled={bidCount > 0} className={inputClass} value={form.reserve_price} onChange={(e) => set("reserve_price", e.target.value)} /></Field>
              <Field label="Starting Bid"><input type="number" disabled={bidCount > 0} className={inputClass} value={form.starting_bid} onChange={(e) => set("starting_bid", e.target.value)} /></Field>
              <Field label="Minimum Increment"><input type="number" disabled={bidCount > 0} className={inputClass} value={form.minimum_increment} onChange={(e) => set("minimum_increment", e.target.value)} /></Field>
              <Field label="Auction Start"><input type="datetime-local" disabled={bidCount > 0} className={inputClass} value={form.auction_start} onChange={(e) => set("auction_start", e.target.value)} /></Field>
              <Field label="Auction End"><input type="datetime-local" disabled={bidCount > 0} className={inputClass} value={form.auction_end} onChange={(e) => set("auction_end", e.target.value)} /></Field>
            </>
          )}
        </FormSection></div>

        <div hidden={activeSection !== 8}><FormSection collapsible={false} title="Visibility & Channel">
          <Field label="Channel" hint="Direct sale listings and dealer auctions are managed separately.">
            <select className={inputClass} disabled={bidCount > 0} value={form.channel} onChange={(e) => set("channel", e.target.value)}>
              {CHANNEL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <Field label="Access"><select disabled={bidCount > 0} className={inputClass} value={form.access_type} onChange={e=>set("access_type",e.target.value)}><option value="all">Everyone · Direct sale</option><option value="dealer_only">Approved dealers · Auction</option></select></Field>
          <Field label="Status">
            <select className={inputClass} value={form.status} onChange={(e) => set("status", e.target.value)}>
              {STATUS_OPTIONS.filter(o=>o!=="sold").map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </Field>
          <Field label="Visibility">
            <select className={inputClass} value={form.visibility} onChange={(e) => set("visibility", e.target.value)}>
              <option value="visible">Visible (public can see once status isn't draft)</option>
              <option value="hidden">Hidden</option>
            </select>
          </Field>
          <div className="flex items-center gap-6 md:col-span-2">
            <label className="flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" disabled={form.listing_type!=="buy_now_only" || form.access_type!=="all"} checked={form.c2c_enabled} onChange={e=>set("c2c_enabled",e.target.checked)} />C2C deal</label>
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input type="checkbox" checked={form.is_featured} onChange={(e) => set("is_featured", e.target.checked)} className="accent-amber-500 w-4 h-4" />
              Featured
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input type="checkbox" checked={form.is_verified} onChange={(e) => set("is_verified", e.target.checked)} className="accent-amber-500 w-4 h-4" />
              Verified
            </label>
          </div>
        </FormSection></div>

        <div hidden={activeSection !== 9}><FormSection collapsible={false} title="Media">
          <div className="md:col-span-2 aw-existing-media">{Object.entries(existingMedia).map(([key,items])=>{const list=key==="thumbnail_url"?(items?[items]:[]):items;return <section key={key}><h4>{key.replaceAll("_"," ")}</h4><div className="aw-media-grid">{list.map((item,index)=>{const url=typeof item==="string"?item:item?.url;if(!url)return null;return <div key={url || index}>{["thumbnail_url","images","images_360"].includes(key)?<img src={url} alt={typeof item==="object"?item.name:"Vehicle photo"}/>:<a href={url} target="_blank" rel="noreferrer">{item?.name || (key==="videos"?"Video":"Document")}</a>}<button type="button" aria-label={"Remove existing "+key+" "+(index+1)} onClick={()=>setExistingMedia(previous=>({...previous,[key]:key==="thumbnail_url"?null:previous[key].filter((_,i)=>i!==index)}))}>Remove</button></div>;})}</div></section>;})}</div>
          <div className="md:col-span-2"><PhotoStudio onBusyChange={busy=>{setMediaBusy(busy);onBusyChange?.(busy);}} images={existingMedia.images} onChange={next=>setExistingMedia(previous=>({...previous,images:next,thumbnail_url:previous.thumbnail_url===previous.images[0]?next[0]||null:previous.thumbnail_url}))}/></div>
          <Field label="Thumbnail" full>
            <FileDropzone accept="image/jpeg,image/png,image/webp" multiple={false} files={thumbnail} onChange={setThumbnail} label="Upload thumbnail" />
          </Field>
          <Field label="Gallery Images" full>
            <FileDropzone accept="image/jpeg,image/png,image/webp" files={images} onChange={setImages} label="Upload images" />
          </Field>
          <Field label="360° Images" full>
            <FileDropzone accept="image/jpeg,image/png,image/webp" files={images360} onChange={setImages360} label="Upload 360° set" />
          </Field>
          <Field label="Videos" full>
            <FileDropzone accept="video/mp4,video/webm" files={videos} onChange={setVideos} label="Upload videos" />
          </Field>
          <Field label="Documents" full>
            <FileDropzone accept="application/pdf,image/jpeg,image/png,image/webp" files={documents} onChange={setDocuments} label="Upload documents" />
          </Field>
        </FormSection></div>
      </fieldset></div>

      <div className="vehicle-form-footer sticky bottom-0 mt-8 -mx-4 md:-mx-8 px-4 md:px-8 py-4 bg-zinc-950/90 backdrop-blur border-t border-white/10 flex items-center gap-4">
        {onCancel && <button type="button" disabled={saving || mediaBusy} onClick={onCancel} className="aw-button">Close</button>}
        <button
          type="submit"
          disabled={saving || mediaBusy || car?.status === "sold"}
          className="rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-black font-semibold px-6 py-3 flex items-center gap-2"
        >
          {saving && <Loader2 size={18} className="animate-spin" />}
          {saving ? progress || "Saving..." : savePending ? "Retry previous save" : car ? "Save Changes" : "Save Car"}
        </button>
        {saving && <span className="text-sm text-zinc-400">{progress}</span>}
      </div>
    </form>
  );
}
