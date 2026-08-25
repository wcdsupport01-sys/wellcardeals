import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";

function requireSupabase() {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Supabase isn't configured yet — add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env (see SUPABASE_SETUP.md)."
    );
  }
  return supabase;
}

// ---------------------------------------------------------------------------
// fetchAuctionCars(userRole, options)
//
// Segments the `cars` table by who's asking:
//   - buyer / unauthenticated  -> access_type == "all" AND listing_type == "buy_now_only"
//                                 (Live Auction wali gaadiyaan buyers ko nahi dikhti)
//   - dealer (status approved) -> access_type in ("all", "dealer_only") — sab dikhta hai
//   - dealer (not approved yet)-> buyer wala view (buy_now_only + access_type all)
//   - admin                    -> everything, no filter
// ---------------------------------------------------------------------------
export async function fetchAuctionCars(userRole, { dealerStatus, status = "live" } = {}) {
  const db = requireSupabase();

  let query = db
    .from("cars")
    .select("*, fuel_types(name), transmissions(name)")
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const isApprovedDealer = userRole === "dealer" && dealerStatus === "approved";

  if (userRole === "admin") {
    // Admin — sab kuch dikhta hai, koi filter nahi
  } else if (isApprovedDealer) {
    // Approved dealer — dealer_only + all access_type, sab listing types
    query = query.in("access_type", ["all", "dealer_only"]);
  } else {
    // Buyer, unauthenticated, ya unapproved dealer:
    // - sirf access_type = "all"
    // - sirf buy_now_only listings (auction wali nahi)
    query = query
      .eq("access_type", "all")
      .eq("listing_type", "buy_now_only");
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}