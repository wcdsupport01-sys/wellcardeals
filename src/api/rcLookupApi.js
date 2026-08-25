// ---------------------------------------------------------------------------
// lookupByRegistrationNumber(regNumber)
//
// The "Sell Your Car" form auto-fills brand/model/year/variant as soon as
// the user types a registration number, the way sites like Cars24/Spinny
// do. Doing that for real needs a paid vehicle-registration API (e.g. Surepass,
// Signzy, VAHAN) that isn't wired up here — this sandbox has no network
// access to those providers.
//
// For now this returns a small deterministic "demo" match so the UI/UX can
// be built and tested end-to-end. Swap the body of this function for a real
// fetch() to your RC-lookup provider (through a Supabase Edge Function, to
// keep the API key off the client) when you're ready — the return shape is
// already what the form expects.
// ---------------------------------------------------------------------------

const DEMO_DB = {
  brands: ["Maruti Suzuki", "Hyundai", "Tata", "Honda", "Mahindra", "Toyota", "Kia"],
  models: {
    "Maruti Suzuki": ["Swift", "Baleno", "Dzire", "Brezza"],
    Hyundai: ["Creta", "i20", "Venue", "Verna"],
    Tata: ["Nexon", "Punch", "Harrier", "Altroz"],
    Honda: ["City", "Amaze", "Elevate"],
    Mahindra: ["XUV700", "Scorpio-N", "Thar"],
    Toyota: ["Innova Crysta", "Fortuner", "Glanza"],
    Kia: ["Seltos", "Sonet", "Carens"],
  },
  variants: ["LXI", "VXI", "ZXI", "SX", "SX(O)", "Base", "Top"],
};

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

// Very loose Indian-style plate check, e.g. "DL 4C AB 1234" / "DL4CAB1234".
export function isPlausibleRegistrationNumber(value) {
  const cleaned = (value || "").replace(/\s|-/g, "").toUpperCase();
  return /^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{4}$/.test(cleaned);
}

export async function lookupByRegistrationNumber(regNumber) {
  const cleaned = (regNumber || "").replace(/\s|-/g, "").toUpperCase();
  if (!isPlausibleRegistrationNumber(cleaned)) {
    throw new Error("Enter a valid registration number, e.g. DL4CAB1234");
  }

  // Simulate network latency of a real lookup call.
  await new Promise((resolve) => setTimeout(resolve, 600));

  const seed = hashString(cleaned);
  const brand = DEMO_DB.brands[seed % DEMO_DB.brands.length];
  const modelsForBrand = DEMO_DB.models[brand];
  const model = modelsForBrand[seed % modelsForBrand.length];
  const variant = DEMO_DB.variants[seed % DEMO_DB.variants.length];
  const currentYear = new Date().getFullYear();
  const year = currentYear - (seed % 12); // registration up to 12 years old

  return {
    registration_number: cleaned,
    brand,
    model,
    variant,
    year,
    _demo: true, // flag so the UI can label this as an unverified demo match
  };
}
