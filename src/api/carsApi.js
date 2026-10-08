
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
  { dealerStatus, status = "live" } = {}
) {
  const db = requireSupabase();

  let query = db
    .from("cars")
    .select("*, fuel_types(name), transmissions(name)")
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const isApprovedDealer =
    userRole === "dealer" &&
    dealerStatus === "approved";

  const isAdmin = userRole === "admin";

  if (!isApprovedDealer && !isAdmin) {
    // Public users can see listings marked for everyone.
    query = query.eq("access_type", "all");
  }

  // Do not restrict public visitors to buy_now_only.
  // LiveAuctions.jsx filters buy_now_only from auction results.
  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data || [];
}
