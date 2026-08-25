import { useState } from "react";
import { Loader2, CheckCircle2, AlertCircle, Car } from "lucide-react";
import FormSection, { Field, inputClass } from "../../admin/components/FormSection";
import LookupSelect from "../../admin/components/LookupSelect";
import FeaturePicker from "../../admin/components/FeaturePicker";
import FileDropzone from "../../admin/components/FileDropzone";
import { useLookups } from "../../admin/hooks/useLookups";
import { useModels } from "../../admin/hooks/useModels";
import { uploadCarFile, uploadManyCarFiles } from "../../admin/lib/carsApi";
import {
  FEATURE_CATEGORIES,
  OWNERSHIP_OPTIONS,
  DRIVE_TYPE_OPTIONS,
  RC_STATUS_OPTIONS,
  FINANCE_STATUS_OPTIONS,
} from "../../admin/lib/lookups";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../auth/AuthContext";

// Agent version of "Add Car" — same level of detail as the admin form
// (src/admin/pages/AddCarPage.jsx), reusing the exact same shared
// components/hooks so brand/model/feature dropdowns behave identically.
//
// Three differences from the admin form:
//   1. No Pricing & Auction / Visibility & Channel sections — those are
//      system-controlled here. Every agent submission is inserted as
//      status: "draft" + visibility: "hidden" + listing_type:
//      "buy_now_only", and only goes live once a team_lead/manager/admin
//      approves it on ManageAgentSubmissionsPage.jsx (which then sets
//      status: "live" + visibility: "visible" + access_type: "all").
//   2. Adds Seller Name / Seller Phone — fields the admin form doesn't
//      collect but a field agent has to, to let the office follow up.
//   3. Writes directly to the `cars` table from the client (not through
//      the admin-only add-car Edge Function), permitted by the
//      "agents insert own submissions" RLS policy from
//      agent_car_submission_tl_review.sql — which only allows a row where
//      submitted_by_agent_id = the agent's own auth uid and
//      tl_review_status = 'pending'.
//
// "Add new" (new brand/model/feature) is intentionally disabled here —
// only staff can create new lookup values (see manage-lookup Edge
// Function), so agents just pick from what already exists.
async function noAddNew() {
  throw new Error("Ask your Team Lead or admin to add this option first.");
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
  seller_name: "",
  seller_phone: "",
  expected_price: "",
  safety_features: [],
  comfort_features: [],
  exterior_features: [],
  interior_features: [],
  infotainment_features: [],
};

export default function AgentAddCarPage() {
  const { user } = useAuth();
  const { lookups, features, loading, error: lookupError } = useLookups();
  const [form, setForm] = useState(emptyForm);
  const { models } = useModels(form.brand_id);

  const [thumbnail, setThumbnail] = useState([]);
  const [images, setImages] = useState([]);
  const [videos, setVideos] = useState([]);
  const [documents, setDocuments] = useState([]);

  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState(null); // { ok, message }

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function validate() {
    if (!form.vehicle_title.trim()) return "Vehicle title is required.";
    if (!form.brand_id) return "Pick a brand.";
    if (!form.model_id) return "Pick a model.";
    if (!form.seller_phone.trim()) return "Seller's phone number is required.";
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
      const thumbnailUrl = thumbnail[0] ? await uploadCarFile(thumbnail[0], "agent-submissions") : null;

      setProgress("Uploading gallery images...");
      const imageUrls = await uploadManyCarFiles(images, "agent-submissions");

      setProgress("Uploading videos...");
      const videoUrls = await uploadManyCarFiles(videos, "agent-submissions");

      setProgress("Uploading documents...");
      const documentUrls = await Promise.all(
        documents.map(async (doc) => ({ name: doc.name, url: await uploadCarFile(doc, "agent-submissions") }))
      );

      setProgress("Submitting for Team Lead approval...");
      const payload = {
        vehicle_title: form.vehicle_title.trim(),
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
        seller_name: form.seller_name || null,
        seller_phone: form.seller_phone.trim(),
        buy_now_price: form.expected_price ? Number(form.expected_price) : null,
        safety_features: form.safety_features,
        comfort_features: form.comfort_features,
        exterior_features: form.exterior_features,
        interior_features: form.interior_features,
        infotainment_features: form.infotainment_features,
        thumbnail_url: thumbnailUrl,
        images: imageUrls,
        videos: videoUrls,
        documents: documentUrls,
        // System-controlled — not editable by the agent. Stays off the
        // public site until a team_lead/manager/admin approves it.
        listing_type: "buy_now_only",
        channel: "buyer",
        status: "draft",
        visibility: "hidden",
        tl_review_status: "pending",
        submitted_by_agent_id: user.id,
      };

      const { error: insertError } = await supabase.from("cars").insert(payload);
      if (insertError) throw insertError;

      setResult({ ok: true, message: "Submitted for Team Lead approval." });
      setForm(emptyForm);
      setThumbnail([]);
      setImages([]);
      setVideos([]);
      setDocuments([]);
    } catch (err) {
      setResult({ ok: false, message: err.message || "Something went wrong while submitting." });
    } finally {
      setSaving(false);
      setProgress("");
    }
  }

  if (loading) return <p className="text-zinc-400">Loading form data...</p>;
  if (lookupError)
    return <p className="text-red-400">Couldn't load dropdown data: {lookupError}.</p>;

  return (
    <form onSubmit={handleSubmit} className="pb-24 bg-[#0B1120] text-white rounded-2xl p-5 md:p-8 -m-1">
      <div className="mb-6 flex items-center gap-2">
        <Car size={22} className="text-emerald-500" />
        <div>
          <h1 className="text-2xl font-bold text-white">Add Car</h1>
          <p className="text-zinc-400 text-sm">
            Fill in what you found at the seller's location. This goes to your Team Lead for
            approval — once they approve it, the car goes live on the site automatically.
          </p>
        </div>
      </div>

      {result && (
        <div
          className={`mb-6 flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${
            result.ok
              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
              : "bg-red-500/10 text-red-400 border border-red-500/30"
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
            <LookupSelect options={lookups.brands || []} value={form.brand_id} onChange={(v) => { set("brand_id", v); set("model_id", null); }} onAddNew={noAddNew} />
          </Field>
          <Field label="Model">
            <LookupSelect options={models} value={form.model_id} onChange={(v) => set("model_id", v)} onAddNew={noAddNew} placeholder={form.brand_id ? "Select model..." : "Pick a brand first"} />
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
            <LookupSelect options={lookups.fuel_types || []} value={form.fuel_type_id} onChange={(v) => set("fuel_type_id", v)} onAddNew={noAddNew} />
          </Field>
          <Field label="Transmission">
            <LookupSelect options={lookups.transmissions || []} value={form.transmission_id} onChange={(v) => set("transmission_id", v)} onAddNew={noAddNew} />
          </Field>
          <Field label="Body Type">
            <LookupSelect options={lookups.body_types || []} value={form.body_type_id} onChange={(v) => set("body_type_id", v)} onAddNew={noAddNew} />
          </Field>
          <Field label="Color">
            <LookupSelect options={lookups.colors || []} value={form.color_id} onChange={(v) => set("color_id", v)} onAddNew={noAddNew} />
          </Field>
          <Field label="Vehicle Category">
            <LookupSelect options={lookups.vehicle_categories || []} value={form.category_id} onChange={(v) => set("category_id", v)} onAddNew={noAddNew} />
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
          <Field label="Registration State"><input className={inputClass} value={form.registration_state} onChange={(e) => set("registration_state", e.target.value)} placeholder="e.g. Delhi" /></Field>
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

        <FormSection title="Seller Information" subtitle="So your Team Lead / the office can follow up directly with the seller.">
          <Field label="Seller's Name"><input className={inputClass} value={form.seller_name} onChange={(e) => set("seller_name", e.target.value)} /></Field>
          <Field label="Seller's Phone"><input className={inputClass} value={form.seller_phone} onChange={(e) => set("seller_phone", e.target.value)} /></Field>
          <Field label="Asking Price (₹)"><input type="number" className={inputClass} value={form.expected_price} onChange={(e) => set("expected_price", e.target.value)} /></Field>
        </FormSection>

        <FormSection title="Description & Notes">
          <Field label="Description" full>
            <textarea rows={4} className={inputClass} value={form.description} onChange={(e) => set("description", e.target.value)} />
          </Field>
          <Field label="Notes for your Team Lead" full>
            <textarea rows={3} className={inputClass} value={form.seller_notes} onChange={(e) => set("seller_notes", e.target.value)} placeholder="Condition, damage, urgency, anything they should know before approving..." />
          </Field>
        </FormSection>

        <FormSection title="Features" subtitle="Tap to select what the car actually has.">
          {FEATURE_CATEGORIES.map(({ key, category, label }) => (
            <Field key={key} label={label} full>
              <FeaturePicker
                category={category}
                allFeatures={features}
                selected={form[key]}
                onChange={(vals) => set(key, vals)}
                onAddNew={noAddNew}
              />
            </Field>
          ))}
        </FormSection>

        <FormSection title="Media">
          <Field label="Thumbnail" full>
            <FileDropzone accept="image/*" multiple={false} files={thumbnail} onChange={setThumbnail} label="Upload thumbnail" />
          </Field>
          <Field label="Gallery Images" full>
            <FileDropzone accept="image/*" files={images} onChange={setImages} label="Upload images" />
          </Field>
          <Field label="Videos" full>
            <FileDropzone accept="video/*" files={videos} onChange={setVideos} label="Upload videos" />
          </Field>
          <Field label="Documents" full>
            <FileDropzone accept=".pdf,.doc,.docx,image/*" files={documents} onChange={setDocuments} label="Upload documents" />
          </Field>
        </FormSection>
      </div>

      <div className="sticky bottom-0 mt-8 -mx-5 md:-mx-8 px-5 md:px-8 py-4 bg-[#0B1120]/95 backdrop-blur border-t border-white/10 flex items-center gap-4 rounded-b-2xl">
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-semibold px-6 py-3 flex items-center gap-2"
        >
          {saving && <Loader2 size={18} className="animate-spin" />}
          {saving ? progress || "Submitting..." : "Submit for Approval"}
        </button>
        {saving && <span className="text-sm text-zinc-400">{progress}</span>}
      </div>
    </form>
  );
}