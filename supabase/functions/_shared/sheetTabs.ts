// supabase/functions/_shared/sheetTabs.ts
// Central place for the 4 new audit/tracking tab names + header rows, so
// every function that writes to them stays in sync with the same column
// order. Existing tabs (Listings, Negotiations, Sheet1, Signups) are NOT
// touched by this file — they keep using pushRowToSheetBestEffort as-is.

export const CARS_MASTER_TAB = Deno.env.get("GOOGLE_SHEET_CARS_MASTER_TAB") || "Cars_Master";
export const CARS_MASTER_HEADERS = [
  "timestamp",
  "car_id",
  "make_model_year",
  "variant",
  "mileage_km",
  "fuel_type",
  "transmission",
  "location",
  "seller_info",
  "status",
  "visibility",
  "handled_by_id",
  "handled_by_name",
  "reserve_price",
  "starting_bid",
  "buy_now_price",
  "final_price",
  "listing_type",
  "inspection_status",
  "listing_date",
  "live_until",
  "sold_date",
];

export const AGENTS_DIRECTORY_TAB = Deno.env.get("GOOGLE_SHEET_AGENTS_TAB") || "Agents_Directory";
export const AGENTS_DIRECTORY_HEADERS = [
  "timestamp",
  "agent_id",
  "agent_code",
  "full_name",
  "phone",
  "email",
  "account_created",
  "active_status",
];

// MANAGER + TEAM_LEAD accounts — same idea as Agents_Directory, kept as a
// separate tab/sheet since these are staff roles (created via
// create-staff-user), not the agent_code login flow agents use.
export const STAFF_DIRECTORY_TAB = Deno.env.get("GOOGLE_SHEET_STAFF_TAB") || "Staff_Directory";
export const STAFF_DIRECTORY_HEADERS = [
  "timestamp",
  "user_id",
  "role",
  "full_name",
  "phone",
  "email",
  "account_created",
  "active_status",
  "created_by",
];

export const ADMIN_AUDIT_LOGS_TAB = Deno.env.get("GOOGLE_SHEET_AUDIT_TAB") || "Admin_Audit_Logs";
export const ADMIN_AUDIT_LOGS_HEADERS = [
  "timestamp",
  "actor_id",
  "actor_name",
  "action",
  "previous_status",
  "new_status",
];

export const SALES_LOG_TAB = Deno.env.get("GOOGLE_SHEET_SALES_TAB") || "Sales_Log";
export const SALES_LOG_HEADERS = [
  "timestamp",
  "car_id",
  "buyer_details",
  "final_sale_price",
  "sale_type",
  "closing_date",
  "commission_margin",
];
