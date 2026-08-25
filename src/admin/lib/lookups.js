// Central registry of every dynamic dropdown table.
// Add a new lookup here and it automatically becomes manageable in
// Admin > Settings and available in the Add Car form.

export const LOOKUPS = {
  brands: { table: "brands", label: "Brand", orderBy: "name" },
  fuel_types: { table: "fuel_types", label: "Fuel Type", orderBy: "name" },
  body_types: { table: "body_types", label: "Body Type", orderBy: "name" },
  transmissions: { table: "transmissions", label: "Transmission", orderBy: "name" },
  colors: { table: "colors", label: "Color", orderBy: "name" },
  vehicle_categories: { table: "vehicle_categories", label: "Vehicle Category", orderBy: "name" },
  states: { table: "states", label: "State", orderBy: "name" },
};

export const FEATURE_CATEGORIES = [
  { key: "safety_features", category: "safety", label: "Safety Features" },
  { key: "comfort_features", category: "comfort", label: "Comfort Features" },
  { key: "exterior_features", category: "exterior", label: "Exterior Features" },
  { key: "interior_features", category: "interior", label: "Interior Features" },
  { key: "infotainment_features", category: "infotainment", label: "Infotainment Features" },
];

export const OWNERSHIP_OPTIONS = ["1st", "2nd", "3rd", "4th+"];
export const DRIVE_TYPE_OPTIONS = ["FWD", "RWD", "AWD", "4WD"];
export const RC_STATUS_OPTIONS = ["Clear", "Hypothecated", "Duplicate"];
export const FINANCE_STATUS_OPTIONS = ["No Loan", "Loan Active", "NOC Pending"];
export const CHANNEL_OPTIONS = [
  { value: "buyer", label: "Buyer Auction" },
  { value: "dealer", label: "Dealer Auction" },
];
export const LISTING_TYPE_OPTIONS = [
  { value: "auction", label: "Auction (bidding enabled)" },
  { value: "buy_now_only", label: "Buy Now Only (fixed price, no bidding)" },
];
export const STATUS_OPTIONS = ["draft", "upcoming", "live", "closed", "sold", "delisted"];

// The ONLY 5 categories the app tracks real inspection data for — same
// list on the Add Car form, the Inventory quick-editor, and the public
// RealCarDetail.jsx "Inspection Report" card. Keeping one source of truth
// here is what stops the display from ever showing a category nobody
// actually inspected.
export const INSPECTION_CATEGORIES = [
  { key: "engine_transmission", label: "Engine & Transmission" },
  { key: "body_paint", label: "Body & Paint" },
  { key: "interior", label: "Interior" },
  { key: "electricals", label: "Electricals" },
  { key: "tyres_suspension", label: "Tyres & Suspension" },
];

export const INSPECTION_STATUS_OPTIONS = [
  { value: "", label: "Not checked" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
  { value: "poor", label: "Poor" },
];

export const EMPTY_INSPECTION = Object.fromEntries(INSPECTION_CATEGORIES.map((c) => [c.key, null]));
