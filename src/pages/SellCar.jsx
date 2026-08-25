import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Car, MapPin, Loader2, CheckCircle2, Search, Gauge, LogIn, ClipboardCheck, BadgeIndianRupee, Repeat, Sparkles, TrendingUp } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { supabase } from "../lib/supabaseClient";
import { openAuthModal } from "../utils/authBus";
import { lookupByRegistrationNumber } from "../api/rcLookupApi";
import {
  fetchDistinctBrands,
  fetchModelsForBrand,
  fetchVariantsForBrandModel,
} from "../lib/carMasterApi";

const ODO_RANGES = [
  "0-10000",
  "10000-20000",
  "20000-30000",
  "30000-50000",
  "50000-70000",
  "70000-100000",
  "100000+",
];

// Manual Year Array (Current year se 1990 tak)
const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from(
  { length: CURRENT_YEAR - 1990 + 1 },
  (_, i) => String(CURRENT_YEAR - i)
);

const EMPTY_FORM = {
  customer_name: "",
  registration_number: "",
  brand: "",
  model: "",
  variant: "",
  year: "",
  odo_range: "",
  landmark: "",
  buyer_phone: "",
  customer_email: "",
};

export default function SellCar() {
  const { user, profile, loading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const regFromHero = searchParams.get("reg") || "";

  const [form, setForm] = useState({
    ...EMPTY_FORM,
    registration_number: regFromHero,
    customer_name: profile?.full_name || "",
    customer_email: profile?.email || "",
    buyer_phone: profile?.phone || "",
  });
  const [coords, setCoords] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState("");

  // Brand -> Model -> Variant cascading dropdowns
  const [brands, setBrands] = useState([]);
  const [brandsLoading, setBrandsLoading] = useState(false);
  const [models, setModels] = useState([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [variants, setVariants] = useState([]);
  const [variantsLoading, setVariantsLoading] = useState(false);

  // AI Estimation state
  const [valuation, setValuation] = useState(null);

  // 1. Brands — fetched once on mount
  useEffect(() => {
    setBrandsLoading(true);
    fetchDistinctBrands()
      .then(setBrands)
      .catch(() => setBrands([]))
      .finally(() => setBrandsLoading(false));
  }, []);

  // 2. Models — refetch whenever brand changes
  useEffect(() => {
    if (!form.brand) {
      setModels([]);
      return;
    }
    setModelsLoading(true);
    fetchModelsForBrand(form.brand)
      .then(setModels)
      .catch(() => setModels([]))
      .finally(() => setModelsLoading(false));
  }, [form.brand]);

  // 3. Variants — refetch whenever brand+model changes
  useEffect(() => {
    if (!form.brand || !form.model) {
      setVariants([]);
      return;
    }
    setVariantsLoading(true);
    fetchVariantsForBrandModel(form.brand, form.model)
      .then(setVariants)
      .catch(() => setVariants([]))
      .finally(() => setVariantsLoading(false));
  }, [form.brand, form.model]);

  // AI Market Valuation Engine
  useEffect(() => {
    if (form.brand && form.model && form.year) {
      calculateAiValuation();
    } else {
      setValuation(null);
    }
  }, [form.brand, form.model, form.year, form.odo_range]);

  function calculateAiValuation() {
    const brandLower = (form.brand || "").toLowerCase();
    const modelLower = (form.model || "").toLowerCase();

    // 1. Dynamic Base Price Segment Selection
    let baseVal = 700000; // Default budget car base price (e.g. Swift/i10)

    if (
      brandLower.includes("bmw") ||
      brandLower.includes("mercedes") ||
      brandLower.includes("audi") ||
      brandLower.includes("jaguar") ||
      brandLower.includes("porsche") ||
      brandLower.includes("land rover") ||
      brandLower.includes("volvo")
    ) {
      baseVal = 4500000; // Luxury segment (e.g., BMW 3 Series, C-Class)
    } else if (
      brandLower.includes("fortuner") ||
      brandLower.includes("endeavour") ||
      modelLower.includes("fortuner") ||
      modelLower.includes("harrier") ||
      modelLower.includes("safari") ||
      modelLower.includes("xuv700") ||
      modelLower.includes("jeep")
    ) {
      baseVal = 2500000; // Premium SUV Segment
    } else if (
      brandLower.includes("honda") ||
      brandLower.includes("hyundai") ||
      brandLower.includes("kia") ||
      brandLower.includes("volkswagen") ||
      brandLower.includes("skoda") ||
      brandLower.includes("mg")
    ) {
      baseVal = 1200000; // Mid-range segment (Creta, City, Seltos)
    } else if (
      brandLower.includes("maruti") ||
      brandLower.includes("tata") ||
      brandLower.includes("renault") ||
      brandLower.includes("nissan")
    ) {
      baseVal = 700000; // Economy segment
    }

    // 2. Age Depreciation Calculation
    const currentYear = new Date().getFullYear();
    const carYear = parseInt(form.year) || currentYear;
    const age = Math.max(0, currentYear - carYear);

    let depRate = 0;
    if (age === 0) depRate = 0.08;
    else if (age === 1) depRate = 0.15;
    else if (age === 2) depRate = 0.25;
    else if (age === 3) depRate = 0.35;
    else if (age === 4) depRate = 0.42;
    else if (age === 5) depRate = 0.50;
    else if (age === 6) depRate = 0.55;
    else if (age === 7) depRate = 0.60;
    else if (age === 8) depRate = 0.65;
    else depRate = Math.min(0.68 + (age - 8) * 0.02, 0.82); // Max 82% depreciation

    let estimatedVal = baseVal * (1 - depRate);

    // 3. Odometer Factor
    if (form.odo_range) {
      if (form.odo_range.includes("0-10000") || form.odo_range.includes("10000-20000")) {
        estimatedVal *= 1.08;
      } else if (form.odo_range.includes("20000-30000")) {
        estimatedVal *= 1.03;
      } else if (form.odo_range.includes("50000-70000")) {
        estimatedVal *= 0.93;
      } else if (form.odo_range.includes("70000") || form.odo_range.includes("100000") || form.odo_range.includes("100000+")) {
        estimatedVal *= 0.85;
      }
    }

    // Rounding off to nearest 10,000
    const minPrice = Math.round((estimatedVal * 0.92) / 10000) * 10000;
    const maxPrice = Math.round((estimatedVal * 1.08) / 10000) * 10000;

    setValuation({
      min: `₹${(minPrice / 100000).toFixed(2)} Lakh`,
      max: `₹${(maxPrice / 100000).toFixed(2)} Lakh`,
    });
  }

  function handleBrandChange(brand) {
    setForm((f) => ({ ...f, brand, model: "", variant: "" }));
  }

  function handleModelChange(model) {
    setForm((f) => ({ ...f, model, variant: "" }));
  }

  function handleVariantChange(variant) {
    setForm((f) => ({ ...f, variant }));
  }

  const [looking, setLooking] = useState(false);
  const [lookupMsg, setLookupMsg] = useState("");
  const [lookupError, setLookupError] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function fetchRegistrationDetails() {
    setLookupError("");
    setLookupMsg("");
    if (!form.registration_number.trim()) {
      setLookupError("Enter your car's registration number first.");
      return;
    }
    setLooking(true);
    try {
      const details = await lookupByRegistrationNumber(form.registration_number);
      setForm((f) => ({
        ...f,
        registration_number: details.registration_number,
        brand: details.brand,
        model: details.model,
        variant: details.variant,
      }));

      setLookupMsg("Details fetched — please select the manufacturing year manually.");
    } catch (err) {
      setLookupError(err.message || "Couldn't fetch details for that number.");
    } finally {
      setLooking(false);
    }
  }

  function useMyLocation() {
    setLocateError("");
    if (!navigator.geolocation) {
      setLocateError("Location isn't supported on this device/browser.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setCoords({ latitude, longitude });
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
          );
          const data = await res.json();
          const place =
            data?.display_name ||
            [data?.address?.suburb, data?.address?.city, data?.address?.state].filter(Boolean).join(", ");
          if (place) update("landmark", place);
        } catch {
          // Fallback
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocateError("Couldn't get your location — please enter manually.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  async function submitRequest(e) {
    e.preventDefault();
    setError("");

    if (!user) {
      openAuthModal("login");
      return;
    }
    if (!form.customer_name.trim()) return setError("Please enter your name.");
    if (!form.registration_number.trim()) return setError("Please enter the car's registration number.");
    if (!form.brand.trim() || !form.model.trim()) return setError("Please enter the car's brand and model.");
    if (!form.landmark.trim()) return setError("Please add your location/landmark.");
    if (!form.buyer_phone.trim()) return setError("Please enter a contact phone number.");
    if (!supabase) return setError("Service isn't configured yet.");

    setSubmitting(true);
    const vehicleTitle = [form.brand, form.model, form.variant].filter(Boolean).join(" ");
    const { error: insertError } = await supabase.from("car_auction_requests").insert({
      buyer_id: user.id,
      buyer_name: form.customer_name,
      buyer_phone: form.buyer_phone,
      vehicle_title: vehicleTitle || form.registration_number,
      year: form.year ? Number(form.year) : null,
      km_driven: null,
      expected_price: null,
      description: null,
      customer_name: form.customer_name,
      customer_email: form.customer_email || null,
      registration_number: form.registration_number,
      brand: form.brand,
      model: form.model,
      variant: form.variant || null,
      odo_range: form.odo_range || null,
      landmark: form.landmark,
      latitude: coords?.latitude ?? null,
      longitude: coords?.longitude ?? null,
    });
    setSubmitting(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }
    setSuccess(true);
    setForm({ ...EMPTY_FORM });
    setCoords(null);
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-14">
      <div className="flex items-center gap-2 mb-2 text-[#1E6FD9]">
        <Car size={22} />
        <span className="text-sm font-semibold tracking-wide uppercase">Sell Your Car</span>
      </div>
      <h1 className="text-3xl font-bold text-gray-900 mb-3">Get a great price for your car</h1>
      <p className="text-gray-500 mb-8">
        Fill in your car's details below. Our AI engine will provide an instant valuation range and list it for dealer bidding.
      </p>

      {/* Process steps */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
        {[
          { icon: Search, title: "Get Valuation", desc: "Enter car details for estimate." },
          { icon: ClipboardCheck, title: "Inspection", desc: "Our team verifies details." },
          { icon: BadgeIndianRupee, title: "Best Offer", desc: "Get top dealer bids." },
          { icon: Repeat, title: "Transfer", desc: "Easy payment & handover." },
        ].map((step, i) => (
          <div key={step.title} className="rounded-2xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 text-[#1E6FD9] mb-2">
              <step.icon size={18} />
              <span className="text-xs font-semibold text-gray-400">STEP {i + 1}</span>
            </div>
            <h3 className="text-sm font-semibold text-gray-900">{step.title}</h3>
            <p className="text-xs text-gray-500 mt-1">{step.desc}</p>
          </div>
        ))}
      </div>

      {!authLoading && !user && (
        <div className="flex items-center justify-between gap-4 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 mb-8">
          <p className="text-sm text-amber-800">You'll need an account to submit — it only takes a minute.</p>
          <button
            type="button"
            onClick={() => openAuthModal("login")}
            className="flex items-center gap-1.5 whitespace-nowrap bg-[#0B2545] text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-[#123a6b] transition"
          >
            <LogIn size={15} /> Log In / Sign Up
          </button>
        </div>
      )}

      {success ? (
        <div className="flex flex-col items-center text-center gap-3 border border-emerald-200 bg-emerald-50 rounded-2xl px-6 py-12">
          <CheckCircle2 size={40} className="text-emerald-500" />
          <h2 className="text-xl font-semibold text-gray-900">Request submitted!</h2>
          <p className="text-gray-500 max-w-md">
            Our team will review your car's details and get in touch shortly.
          </p>
          <div className="flex gap-3 mt-2">
            <Link to="/buyer/dashboard" className="bg-[#0B2545] text-white text-sm font-medium px-5 py-2.5 rounded-xl">
              View My Requests
            </Link>
            <button
              onClick={() => setSuccess(false)}
              className="border border-gray-300 text-sm font-medium px-5 py-2.5 rounded-xl hover:bg-gray-50"
            >
              Submit Another Car
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={submitRequest} className="space-y-8">
          {/* Customer details */}
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Your Name">
              <input
                value={form.customer_name}
                onChange={(e) => update("customer_name", e.target.value)}
                placeholder="Full name"
                className="input"
              />
            </Field>
            <Field label="Phone Number">
              <input
                value={form.buyer_phone}
                onChange={(e) => update("buyer_phone", e.target.value)}
                placeholder="10-digit mobile number"
                className="input"
              />
            </Field>
            <Field label="Email" className="sm:col-span-2">
              <input
                value={form.customer_email}
                onChange={(e) => update("customer_email", e.target.value)}
                type="email"
                placeholder="you@example.com"
                className="input"
              />
            </Field>
          </section>

          {/* Registration Lookup */}
          <section>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Car Registration Number</label>
            <div className="flex gap-2">
              <input
                value={form.registration_number}
                onChange={(e) => update("registration_number", e.target.value.toUpperCase())}
                placeholder="e.g. DL4CAB1234"
                className="input flex-1"
              />
              <button
                type="button"
                onClick={fetchRegistrationDetails}
                disabled={looking}
                className="flex items-center gap-1.5 bg-gray-900 text-white text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-[#123a6b] disabled:opacity-60 transition whitespace-nowrap"
              >
                {looking ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
                {looking ? "Fetching…" : "Get Details"}
              </button>
            </div>
            {lookupMsg && <p className="text-xs text-emerald-600 mt-1.5">{lookupMsg}</p>}
            {lookupError && <p className="text-xs text-red-500 mt-1.5">{lookupError}</p>}
          </section>

          {/* Car Details */}
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Brand">
              <div className="relative">
                <select
                  value={form.brand}
                  onChange={(e) => handleBrandChange(e.target.value)}
                  disabled={brandsLoading}
                  className="input disabled:bg-gray-100 disabled:text-gray-400 pr-9"
                >
                  <option value="" disabled>
                    {brandsLoading ? "Loading brands..." : "Select brand..."}
                  </option>
                  {brands.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
                {brandsLoading && <DropdownSpinner />}
              </div>
            </Field>

            <Field label="Model">
              <div className="relative">
                <select
                  value={form.model}
                  onChange={(e) => handleModelChange(e.target.value)}
                  disabled={!form.brand || modelsLoading}
                  className="input disabled:bg-gray-100 disabled:text-gray-400 pr-9"
                >
                  <option value="" disabled>
                    {!form.brand ? "Pick a brand first" : modelsLoading ? "Loading models..." : "Select model..."}
                  </option>
                  {models.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                {modelsLoading && <DropdownSpinner />}
              </div>
            </Field>

            <Field label="Variant">
              <div className="relative">
                <select
                  value={form.variant}
                  onChange={(e) => handleVariantChange(e.target.value)}
                  disabled={!form.model || variantsLoading}
                  className="input disabled:bg-gray-100 disabled:text-gray-400 pr-9"
                >
                  <option value="" disabled>
                    {!form.model ? "Pick a model first" : variantsLoading ? "Loading variants..." : "Select variant..."}
                  </option>
                  {variants.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
                {variantsLoading && <DropdownSpinner />}
              </div>
            </Field>

            {/* MANUAL MODEL YEAR SELECTION */}
            <Field label="Model Year">
              <div className="relative">
                <select
                  value={form.year}
                  onChange={(e) => update("year", e.target.value)}
                  className="input pr-9"
                >
                  <option value="">Select year...</option>
                  {YEAR_OPTIONS.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </Field>
          </section>

          {/* Odometer */}
          <section>
            <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-2.5">
              <Gauge size={15} /> Odometer Reading (km)
            </label>
            <div className="flex flex-wrap gap-2">
              {ODO_RANGES.map((range) => (
                <button
                  key={range}
                  type="button"
                  onClick={() => update("odo_range", range)}
                  className={`px-4 py-2 rounded-full text-sm font-medium border transition ${
                    form.odo_range === range
                      ? "bg-[#0B2545] text-white border-[#0B2545]"
                      : "bg-white text-gray-700 border-gray-300 hover:border-gray-400"
                  }`}
                >
                  {range.replace("+", "+ ").replace("-", " – ")}
                </button>
              ))}
            </div>
          </section>

          {/* Dynamic AI Valuation Result Display */}
          {valuation && (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm animate-fade-in">
              <div>
                <div className="flex items-center gap-2 text-blue-700 font-bold text-xs uppercase tracking-wider mb-1">
                  <Sparkles size={16} /> AI Estimated Market Value Range
                </div>
                <div className="text-2xl font-extrabold text-blue-950">
                  {valuation.min} <span className="text-blue-400 font-normal">—</span> {valuation.max}
                </div>
                <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                  <TrendingUp size={13} className="text-emerald-500" /> Based on live market resale trends & depreciation
                </p>
              </div>
              <div className="text-right sm:text-right w-full sm:w-auto border-t sm:border-t-0 pt-3 sm:pt-0 border-blue-100">
                <span className="inline-block bg-blue-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                  Fair Valuation
                </span>
              </div>
            </div>
          )}

          {/* Location */}
          <section>
            <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
              <MapPin size={15} /> Your Location
            </label>
            <div className="flex gap-2">
              <input
                value={form.landmark}
                onChange={(e) => update("landmark", e.target.value)}
                placeholder="Enter your nearby landmark or area"
                className="input flex-1"
              />
              <button
                type="button"
                onClick={useMyLocation}
                disabled={locating}
                className="flex items-center gap-1.5 border border-gray-300 text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-gray-50 disabled:opacity-60 transition whitespace-nowrap"
              >
                {locating ? <Loader2 size={15} className="animate-spin" /> : <MapPin size={15} />}
                {locating ? "Locating…" : "Use My Location"}
              </button>
            </div>
            {locateError && <p className="text-xs text-red-500 mt-1.5">{locateError}</p>}
          </section>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-[#0B2545] text-white font-semibold text-sm py-3.5 rounded-xl hover:bg-[#123a6b] disabled:opacity-60 transition"
          >
            {submitting ? "Submitting…" : user ? "Submit for Review" : "Log In to Submit"}
          </button>
        </form>
      )}

      <style>{`
        .input {
          width: 100%;
          background: white;
          border: 1px solid rgb(209 213 219);
          border-radius: 0.75rem;
          padding: 0.625rem 0.875rem;
          font-size: 0.875rem;
          color: rgb(17 24 39);
        }
        .input:focus {
          outline: none;
          border-color: rgb(0 0 0);
        }
      `}</style>
    </div>
  );
}

function DropdownSpinner() {
  return (
    <Loader2
      size={14}
      className="animate-spin text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
    />
  );
}

function Field({ label, className = "", children }) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      {children}
    </div>
  );
}