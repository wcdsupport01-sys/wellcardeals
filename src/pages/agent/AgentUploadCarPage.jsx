import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Loader2, CheckCircle2, AlertCircle, ArrowLeft, Car, Tag, Camera, ShieldCheck, Settings, MapPin, FileText, Sparkles, Trash2, Plus } from "lucide-react";
import { useLookups } from "../../admin/hooks/useLookups";
import { useModels } from "../../admin/hooks/useModels";
import { uploadCarFile, uploadManyCarFiles } from "../../admin/lib/carsApi";
import FileDropzone from "../../admin/components/FileDropzone";
import { supabase } from "../../lib/supabaseClient";
import { submitAgentCar } from "../../agent/lib/agentApi";
import {
  FEATURE_CATEGORIES,
  OWNERSHIP_OPTIONS,
  DRIVE_TYPE_OPTIONS,
  RC_STATUS_OPTIONS,
  FINANCE_STATUS_OPTIONS,
} from "../../admin/lib/lookups";

const lightInput =
  "w-full rounded-xl bg-[#F5F8FD] border border-[#E1E8F5] px-4 py-2.5 text-[#0B1F4D] placeholder:text-[#93A0BD] text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB]/60 transition";

function Field({ label, full, children, hint }) {
  return (
    <label className={`flex flex-col gap-1.5 ${full ? "md:col-span-2" : ""}`}>
      <span className="text-sm font-medium text-[#4B5A78]">{label}</span>
      {children}
      {hint && <span className="text-xs text-[#93A0BD]">{hint}</span>}
    </label>
  );
}

function Section({ title, icon: Icon, subtitle, children }) {
  return (
    <div className="rounded-2xl border border-[#E3E8F5] bg-white p-5 md:p-6">
      <div className="flex items-center gap-2 mb-1">
        {Icon && (
          <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-[#E6F1FB] text-[#2563EB]">
            <Icon size={15} />
          </span>
        )}
        <h3 className="text-base font-semibold text-[#0B2545]">{title}</h3>
      </div>
      {subtitle && <p className="text-xs text-[#93A0BD] mb-4 ml-9">{subtitle}</p>}
      <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${subtitle ? "" : "mt-4"}`}>{children}</div>
    </div>
  );
}

// Simple light-themed toggle chips for agent feature selection.
// (No "add new" here — agents pick from what admin has already defined.)
function FeatureChips({ options, selected, onChange }) {
  function toggle(name) {
    if (selected.includes(name)) onChange(selected.filter((s) => s !== name));
    else onChange([...selected, name]);
  }
  if (!options.length) {
    return <p className="text-xs text-[#93A0BD]">No options set up yet for this category.</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((f) => {
        const active = selected.includes(f.name);
        return (
          <button
            type="button"
            key={f.id}
            onClick={() => toggle(f.name)}
            className={`px-3 py-1.5 rounded-full text-sm border transition ${
              active
                ? "bg-[#2563EB] border-[#2563EB] text-white font-medium"
                : "border-[#E1E8F5] text-[#4B5A78] hover:bg-[#F5F8FD]"
            }`}
          >
            {f.name}
          </button>
        );
      })}
    </div>
  );
}

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
};

const draftKeyFor = (requestId) => `agent_upload_draft_${requestId}`;
const specDraftKeyFor = (requestId) => `agent_upload_spec_draft_${requestId}`;

export default function AgentUploadCarPage() {
  const { requestId } = useParams();
  const navigate = useNavigate();
  const { lookups, features, loading: lookupsLoading, error: lookupError } = useLookups();

  const [request, setRequest] = useState(null);
  const [loadingRequest, setLoadingRequest] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const { models } = useModels(form.brand_id);

  const [specRows, setSpecRows] = useState([{ key: "", value: "" }]);

  const [thumbnail, setThumbnail] = useState([]);
  const [images, setImages] = useState([]);
  const [images360, setImages360] = useState([]);
  const [videos, setVideos] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState(null);

  // Draft autosave: keeps typed-in-progress data safe if the agent
  // accidentally navigates away before submitting.
  const [draftReady, setDraftReady] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function updateSpecRow(idx, key, value) {
    setSpecRows((rows) => rows.map((r, i) => (i === idx ? { ...r, [key]: value } : r)));
  }
  function addSpecRow() {
    setSpecRows((rows) => [...rows, { key: "", value: "" }]);
  }
  function removeSpecRow(idx) {
    setSpecRows((rows) => rows.filter((_, i) => i !== idx));
  }

  useEffect(() => {
    async function load() {
      setLoadingRequest(true);
      const { data, error } = await supabase
        .from("car_auction_requests")
        .select("*")
        .eq("id", requestId)
        .maybeSingle();
      if (!error && data) {
        setRequest(data);

        let draft = null;
        let specDraft = null;
        try {
          draft = JSON.parse(localStorage.getItem(draftKeyFor(requestId)));
          specDraft = JSON.parse(localStorage.getItem(specDraftKeyFor(requestId)));
        } catch {
          draft = null;
          specDraft = null;
        }

        setForm((f) => ({
          ...f,
          vehicle_title: data.vehicle_title || "",
          year: data.year || "",
          km_driven: data.km_driven || "",
          description: data.description || "",
          // Draft (agent's own typed values) wins over the seller-request
          // defaults above, since it reflects work already in progress.
          ...(draft || {}),
        }));
        if (Array.isArray(specDraft) && specDraft.length) setSpecRows(specDraft);
        if (draft) setDraftRestored(true);
      }
      setLoadingRequest(false);
      setDraftReady(true);
    }
    load();
  }, [requestId]);

  // Autosave the form to localStorage on every change, once the initial
  // load/restore above has finished (so we don't overwrite a real draft
  // with the blank emptyForm during the brief loading window).
  useEffect(() => {
    if (!draftReady) return;
    try {
      localStorage.setItem(draftKeyFor(requestId), JSON.stringify(form));
    } catch {
      // localStorage full/unavailable — fail silently, non-critical.
    }
  }, [form, requestId, draftReady]);

  useEffect(() => {
    if (!draftReady) return;
    try {
      localStorage.setItem(specDraftKeyFor(requestId), JSON.stringify(specRows));
    } catch {
      // non-critical
    }
  }, [specRows, requestId, draftReady]);

  function validate() {
    if (!form.vehicle_title.trim()) return "Vehicle title is required.";
    if (!form.brand_id) return "Pick a brand.";
    if (request?.listing_type === "buy_now_only" && !form.buy_now_price) {
      return "Buy Now Price is required for this listing.";
    }
    if (request?.listing_type === "auction" && !form.starting_bid) {
      return "Starting bid is required for an auction listing.";
    }
    if (images.length === 0) return "Add at least one photo of the car.";
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

      setProgress("Uploading gallery photos...");
      const imageUrls = await uploadManyCarFiles(images, "images");

      setProgress("Uploading 360° images...");
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

      setProgress("Saving listing...");
      const payload = {
        vehicle_title: form.vehicle_title,
        brand_id: form.brand_id,
        model_id: form.model_id,
        variant: form.variant || null,
        year: form.year ? Number(form.year) : null,
        registration_year: form.registration_year ? Number(form.registration_year) : null,
        mileage_km: form.mileage_km ? Number(form.mileage_km) : null,
        fuel_type_id: form.fuel_type_id,
        transmission_id: form.transmission_id,
        body_type_id: form.body_type_id,
        color_id: form.color_id,
        category_id: form.category_id,
        ownership: form.ownership,
        vin_number: form.vin_number || null,
        engine_number: form.engine_number || null,
        engine_capacity: form.engine_capacity || null,
        horsepower: form.horsepower ? Number(form.horsepower) : null,
        torque: form.torque || null,
        drive_type: form.drive_type,
        seating_capacity: form.seating_capacity ? Number(form.seating_capacity) : null,
        doors: form.doors ? Number(form.doors) : null,
        location: form.location || null,
        registration_state: form.registration_state || null,
        insurance_validity: form.insurance_validity || null,
        rc_status: form.rc_status,
        puc_status: form.puc_status || null,
        service_history: form.service_history || null,
        accidental_history: form.accidental_history || null,
        number_of_keys: form.number_of_keys ? Number(form.number_of_keys) : null,
        finance_status: form.finance_status,
        description: form.description || null,
        seller_notes: form.seller_notes || null,
        safety_features: form.safety_features,
        comfort_features: form.comfort_features,
        exterior_features: form.exterior_features,
        interior_features: form.interior_features,
        infotainment_features: form.infotainment_features,
        specifications,
        reserve_price: form.reserve_price ? Number(form.reserve_price) : null,
        starting_bid: form.starting_bid ? Number(form.starting_bid) : null,
        buy_now_price: form.buy_now_price ? Number(form.buy_now_price) : null,
        thumbnail_url: thumbnailUrl,
        images: imageUrls,
        images_360: images360Urls,
        videos: videoUrls,
        documents: documentUrls,
      };

      await submitAgentCar(requestId, payload);
      try {
        localStorage.removeItem(draftKeyFor(requestId));
        localStorage.removeItem(specDraftKeyFor(requestId));
      } catch {
        // non-critical
      }
      setResult({ ok: true, message: "Car submitted! It's now live on the site." });
      setTimeout(() => navigate("/agent/dashboard"), 1200);
    } catch (err) {
      setResult({ ok: false, message: err.message || "Something went wrong while saving." });
    } finally {
      setSaving(false);
      setProgress("");
    }
  }

  if (loadingRequest || lookupsLoading) return <p className="text-[#6B7A9A]">Loading…</p>;
  if (!request) return <p className="text-red-500">Request not found.</p>;
  if (request.agent_status === "submitted") {
    return (
      <div>
        <p className="text-[#0B2545] font-medium mb-3">This car has already been submitted.</p>
        <Link to="/agent/dashboard" className="text-emerald-700 text-sm font-medium flex items-center gap-1.5">
          <ArrowLeft size={14} /> Back to dashboard
        </Link>
      </div>
    );
  }
  if (lookupError) {
    return <p className="text-red-500">Couldn't load form data: {lookupError}</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="pb-20 max-w-4xl">
      <Link to="/agent/dashboard" className="text-sm text-[#6B7A9A] hover:text-[#2563EB] flex items-center gap-1.5 mb-4">
        <ArrowLeft size={14} /> Back to dashboard
      </Link>
      <div className="mb-6 flex items-start gap-3">
        <span className="flex items-center justify-center w-11 h-11 rounded-xl bg-[#E6F1FB] text-[#2563EB] shrink-0">
          <Car size={20} />
        </span>
        <div>
          <h1 className="text-2xl font-semibold text-[#0B2545]">Upload Car</h1>
          <p className="text-sm text-[#6B7A9A] mt-1 flex items-center gap-2 flex-wrap">
            {request.buyer_name || "Seller"} · {request.buyer_phone || "no phone on file"}
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                request.listing_type === "buy_now_only"
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-red-50 text-red-600 border border-red-200"
              }`}
            >
              <ShieldCheck size={11} />
              {request.listing_type === "buy_now_only" ? "Buy Now listing" : "Auction listing"}
            </span>
          </p>
        </div>
      </div>

      <p className="text-xs text-[#93A0BD] mb-5 -mt-2">
        Fill in as much detail as you can — buyers trust listings more when every field is complete.
      </p>

      {draftRestored && !result && (
        <div className="mb-6 flex items-center gap-2 rounded-xl px-4 py-3 text-sm bg-amber-50 text-amber-700 border border-amber-200">
          <AlertCircle size={18} /> Restored your unsaved draft from last time. Photos/videos/documents need to be re-attached.
        </div>
      )}

      {result && (
        <div
          className={`mb-6 flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${
            result.ok ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-600 border border-red-200"
          }`}
        >
          {result.ok ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          {result.message}
        </div>
      )}

      <div className="space-y-5">
        <Section title="Vehicle Identity" icon={Car}>
          <Field label="Vehicle Title" full>
            <input className={lightInput} value={form.vehicle_title} onChange={(e) => set("vehicle_title", e.target.value)} placeholder="e.g. 2021 Honda City ZX CVT" />
          </Field>
          <Field label="Brand">
            <select className={lightInput} value={form.brand_id || ""} onChange={(e) => { set("brand_id", e.target.value || null); set("model_id", null); }}>
              <option value="" disabled>Select brand...</option>
              {(lookups.brands || []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
          <Field label="Model">
            <select className={lightInput} value={form.model_id || ""} onChange={(e) => set("model_id", e.target.value || null)} disabled={!form.brand_id}>
              <option value="" disabled>{form.brand_id ? "Select model..." : "Pick a brand first"}</option>
              {models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </Field>
          <Field label="Variant">
            <input className={lightInput} value={form.variant} onChange={(e) => set("variant", e.target.value)} />
          </Field>
          <Field label="Year">
            <input type="number" className={lightInput} value={form.year} onChange={(e) => set("year", e.target.value)} />
          </Field>
          <Field label="Registration Year">
            <input type="number" className={lightInput} value={form.registration_year} onChange={(e) => set("registration_year", e.target.value)} />
          </Field>
          <Field label="Mileage (km)">
            <input type="number" className={lightInput} value={form.mileage_km} onChange={(e) => set("mileage_km", e.target.value)} />
          </Field>
          <Field label="Fuel Type">
            <select className={lightInput} value={form.fuel_type_id || ""} onChange={(e) => set("fuel_type_id", e.target.value || null)}>
              <option value="" disabled>Select...</option>
              {(lookups.fuel_types || []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </Field>
          <Field label="Transmission">
            <select className={lightInput} value={form.transmission_id || ""} onChange={(e) => set("transmission_id", e.target.value || null)}>
              <option value="" disabled>Select...</option>
              {(lookups.transmissions || []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </Field>
          <Field label="Body Type">
            <select className={lightInput} value={form.body_type_id || ""} onChange={(e) => set("body_type_id", e.target.value || null)}>
              <option value="" disabled>Select...</option>
              {(lookups.body_types || []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </Field>
          <Field label="Color">
            <select className={lightInput} value={form.color_id || ""} onChange={(e) => set("color_id", e.target.value || null)}>
              <option value="" disabled>Select...</option>
              {(lookups.colors || []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </Field>
          <Field label="Vehicle Category">
            <select className={lightInput} value={form.category_id || ""} onChange={(e) => set("category_id", e.target.value || null)}>
              <option value="" disabled>Select...</option>
              {(lookups.vehicle_categories || []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </Field>
          <Field label="Ownership">
            <select className={lightInput} value={form.ownership} onChange={(e) => set("ownership", e.target.value)}>
              {OWNERSHIP_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </Field>
        </Section>

        <Section title="Technical Specifications" icon={Settings}>
          <Field label="VIN / Chassis Number"><input className={lightInput} value={form.vin_number} onChange={(e) => set("vin_number", e.target.value)} /></Field>
          <Field label="Engine Number"><input className={lightInput} value={form.engine_number} onChange={(e) => set("engine_number", e.target.value)} /></Field>
          <Field label="Engine Capacity"><input className={lightInput} placeholder="e.g. 1498 cc" value={form.engine_capacity} onChange={(e) => set("engine_capacity", e.target.value)} /></Field>
          <Field label="Horsepower"><input type="number" className={lightInput} value={form.horsepower} onChange={(e) => set("horsepower", e.target.value)} /></Field>
          <Field label="Torque"><input className={lightInput} placeholder="e.g. 200 Nm" value={form.torque} onChange={(e) => set("torque", e.target.value)} /></Field>
          <Field label="Drive Type">
            <select className={lightInput} value={form.drive_type} onChange={(e) => set("drive_type", e.target.value)}>
              {DRIVE_TYPE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </Field>
          <Field label="Seating Capacity"><input type="number" className={lightInput} value={form.seating_capacity} onChange={(e) => set("seating_capacity", e.target.value)} /></Field>
          <Field label="Doors"><input type="number" className={lightInput} value={form.doors} onChange={(e) => set("doors", e.target.value)} /></Field>
        </Section>

        <Section title="Location & Compliance" icon={MapPin}>
          <Field label="Location">
            <input className={lightInput} value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="e.g. Janakpuri, Delhi" />
          </Field>
          <Field label="Registration State">
            <input className={lightInput} value={form.registration_state} onChange={(e) => set("registration_state", e.target.value)} placeholder="e.g. Delhi" />
          </Field>
          <Field label="Insurance Validity"><input type="date" className={lightInput} value={form.insurance_validity} onChange={(e) => set("insurance_validity", e.target.value)} /></Field>
          <Field label="RC Status">
            <select className={lightInput} value={form.rc_status} onChange={(e) => set("rc_status", e.target.value)}>
              {RC_STATUS_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </Field>
          <Field label="PUC Status"><input className={lightInput} value={form.puc_status} onChange={(e) => set("puc_status", e.target.value)} /></Field>
          <Field label="Service History"><input className={lightInput} value={form.service_history} onChange={(e) => set("service_history", e.target.value)} /></Field>
          <Field label="Accidental History"><input className={lightInput} value={form.accidental_history} onChange={(e) => set("accidental_history", e.target.value)} /></Field>
          <Field label="Number of Keys"><input type="number" className={lightInput} value={form.number_of_keys} onChange={(e) => set("number_of_keys", e.target.value)} /></Field>
          <Field label="Finance Status">
            <select className={lightInput} value={form.finance_status} onChange={(e) => set("finance_status", e.target.value)}>
              {FINANCE_STATUS_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </Field>
        </Section>

        <Section title="Description & Notes" icon={FileText}>
          <Field label="Description" full>
            <textarea rows={4} className={lightInput} value={form.description} onChange={(e) => set("description", e.target.value)} />
          </Field>
          <Field label="Seller Notes" full>
            <textarea rows={3} className={lightInput} value={form.seller_notes} onChange={(e) => set("seller_notes", e.target.value)} />
          </Field>
        </Section>

        <Section title="Features" icon={Sparkles} subtitle="Tap to select what this car has.">
          {FEATURE_CATEGORIES.map(({ key, category, label }) => (
            <Field key={key} label={label} full>
              <FeatureChips
                options={features.filter((f) => f.category === category)}
                selected={form[key]}
                onChange={(vals) => set(key, vals)}
              />
            </Field>
          ))}
        </Section>

        <Section title="Specifications" icon={Settings} subtitle="Free-form key/value pairs, e.g. Ground Clearance -> 185mm">
          <div className="md:col-span-2 flex flex-col gap-2">
            {specRows.map((row, i) => (
              <div key={i} className="flex gap-2">
                <input className={lightInput} placeholder="Key" value={row.key} onChange={(e) => updateSpecRow(i, "key", e.target.value)} />
                <input className={lightInput} placeholder="Value" value={row.value} onChange={(e) => updateSpecRow(i, "value", e.target.value)} />
                <button type="button" onClick={() => removeSpecRow(i)} className="shrink-0 rounded-xl border border-[#E1E8F5] px-3 text-[#93A0BD] hover:text-red-500 hover:bg-[#F5F8FD]">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            <button type="button" onClick={addSpecRow} className="self-start flex items-center gap-1.5 text-sm text-[#2563EB] hover:underline mt-1">
              <Plus size={14} /> Add row
            </button>
          </div>
        </Section>

        <Section title="Pricing" icon={Tag}>
          <Field label="Reserve Price (₹)">
            <input type="number" className={lightInput} value={form.reserve_price} onChange={(e) => set("reserve_price", e.target.value)} />
          </Field>
          {request.listing_type === "auction" ? (
            <Field label="Starting Bid (₹)">
              <input type="number" className={lightInput} value={form.starting_bid} onChange={(e) => set("starting_bid", e.target.value)} />
            </Field>
          ) : (
            <Field label="Buy Now Price (₹)">
              <input type="number" className={lightInput} value={form.buy_now_price} onChange={(e) => set("buy_now_price", e.target.value)} />
            </Field>
          )}
        </Section>

        <div className="rounded-2xl border border-[#E3E8F5] bg-white p-5 md:p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-[#E6F1FB] text-[#2563EB]">
              <Camera size={15} />
            </span>
            <h3 className="text-base font-semibold text-[#0B2545]">Media</h3>
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-[#4B5A78] mb-1.5">Thumbnail (main photo)</p>
              <FileDropzone light accept="image/*" multiple={false} files={thumbnail} onChange={setThumbnail} label="Upload thumbnail" />
            </div>
            <div>
              <p className="text-sm font-medium text-[#4B5A78] mb-1.5">Gallery photos</p>
              <FileDropzone light accept="image/*" multiple files={images} onChange={setImages} label="Upload photos" />
            </div>
            <div>
              <p className="text-sm font-medium text-[#4B5A78] mb-1.5">360° images</p>
              <FileDropzone light accept="image/*" multiple files={images360} onChange={setImages360} label="Upload 360° set" />
            </div>
            <div>
              <p className="text-sm font-medium text-[#4B5A78] mb-1.5">Videos</p>
              <FileDropzone light accept="video/*" multiple files={videos} onChange={setVideos} label="Upload videos" />
            </div>
            <div>
              <p className="text-sm font-medium text-[#4B5A78] mb-1.5">Documents</p>
              <FileDropzone light accept=".pdf,.doc,.docx,image/*" multiple files={documents} onChange={setDocuments} label="Upload documents" />
            </div>
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 mt-6 -mx-4 md:mx-0 px-4 md:px-0 py-4 bg-[#F8FAFD]/95 backdrop-blur border-t border-[#E3E8F5] flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-60 text-white font-semibold px-6 py-3 flex items-center gap-2 transition"
        >
          {saving && <Loader2 size={18} className="animate-spin" />} {progress || "Submit Car"}
        </button>
      </div>
    </form>
  );
}
