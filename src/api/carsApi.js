import { readPages } from "../lib/readPages";

import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";

function requireSupabase() {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Supabase isn't configured yet — add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY."
    );
  }
  return supabase;
}

// Live auction listings are publicly visible.
// Dealer-only listings are visible only to approved dealers/admins.
// Bidding permissions must be enforced separately in the backend.
export async function fetchAuctionCars(
  userRole,
  { dealerStatus, status = "live", purchaseOnly = false } = {}
) {
  const db = requireSupabase();

  return readPages(() => {
  let query = db.from("cars_catalog").select("*, fuel_types(name), transmissions(name), body_types(name), brands(name), models(name)", {count:"exact"});
  if (status) query=query.eq("status",status);
  if (purchaseOnly) query=query.eq("listing_type","buy_now_only");

  const isApprovedDealer =
    userRole === "dealer" &&
    dealerStatus === "approved";

  const isAdmin = userRole === "admin";

  if (!isApprovedDealer && !isAdmin) {
    // Public users can see listings marked for everyone.
    query = query.eq("access_type", "all");
  }

  return query;
  });
}
