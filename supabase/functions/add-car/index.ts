// supabase/functions/add-car/index.ts
// Admin-only. Replaces the old direct `supabase.from("cars").insert(...)`
// call from the anon key. Also best-effort pushes every new listing to the
// "Listings" tab of the connected Google Sheet.
// Deploy: supabase functions deploy add-car
import { requireStaff, jsonResponse, corsHeaders, AdminAuthError } from "../_shared/adminAuth.ts";
import { pushRowToSheetBestEffort, pushRowToSheetEnsuringTab } from "../_shared/googleSheet.ts";
import { CARS_MASTER_TAB, CARS_MASTER_HEADERS } from "../_shared/sheetTabs.ts";

const LISTINGS_TAB = Deno.env.get("GOOGLE_SHEET_LISTINGS_TAB") || "Listings";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "POST only." }, 405);

  try {
    const { admin, user } = await requireStaff(req, ["admin", "manager"]);
    const payload = await req.json();

    if (!payload || typeof payload !== "object" || !payload.vehicle_title) {
      return jsonResponse({ error: "vehicle_title is required." }, 400);
    }

    // Same as agent-add-car: the listing cards / detail page read
    // base_price_buyer / base_price_dealer (and current_bid_buyer/dealer),
    // not buy_now_price / starting_bid directly. Populate them here so the
    // price actually shows instead of "—". Only fill in fields the caller
    // didn't already set explicitly.
    if (payload.base_price_buyer == null && payload.base_price_dealer == null) {
      const basePrice =
        payload.listing_type === "buy_now_only"
          ? payload.buy_now_price
          : payload.starting_bid ?? payload.reserve_price;
      if (basePrice != null) {
        payload.base_price_buyer = basePrice;
        payload.base_price_dealer = basePrice;
        payload.current_bid_buyer = basePrice;
        payload.current_bid_dealer = basePrice;
      }
    }

    // Server-side stamp, not client-supplied — RealCarDetail.jsx's
    // "Inspected on <date>" line has to be trustworthy, so the timestamp
    // and who-did-it always come from this request's own auth, never from
    // whatever the browser sent.
    const hasRealInspection =
      payload.inspection && Object.values(payload.inspection).some((v) => v && v.status);
    if (hasRealInspection) {
      payload.inspected_by = user.id;
      payload.inspected_at = new Date().toISOString();
    } else {
      payload.inspected_by = null;
      payload.inspected_at = null;
    }

    // Whoever creates a car is handling it by default — a manager can hand
    // it off to someone else later from the Inventory page's "Claim"
    // button, which goes through update-car below.
    if (!payload.handled_by) {
      payload.handled_by = user.id;
      payload.handled_at = new Date().toISOString();
    }

    const { data, error } = await admin.from("cars").insert(payload).select().single();
    if (error) return jsonResponse({ error: error.message }, 400);

    // Best-effort -- never blocks the response if the Sheet push fails.
    await pushRowToSheetBestEffort(LISTINGS_TAB, [
      new Date().toISOString(),
      data.id,
      data.vehicle_title,
      data.channel ?? "",
      data.status ?? "",
      data.reserve_price ?? "",
      data.starting_bid ?? "",
      data.auction_start ?? "",
      data.auction_end ?? "",
      data.location ?? "",
    ]);

    // NEW — also mirror this into Cars_Master (auto-creates the tab on first use).
    const [{ data: handlerProfile }, { data: fuelType }, { data: transmission }] = await Promise.all([
      admin.from("profiles").select("full_name").eq("id", data.handled_by).maybeSingle(),
      data.fuel_type_id ? admin.from("fuel_types").select("name").eq("id", data.fuel_type_id).maybeSingle() : { data: null },
      data.transmission_id ? admin.from("transmissions").select("name").eq("id", data.transmission_id).maybeSingle() : { data: null },
    ]);

    await pushRowToSheetEnsuringTab(CARS_MASTER_TAB, CARS_MASTER_HEADERS, [
      new Date().toISOString(),
      data.id,
      data.vehicle_title,
      data.variant ?? "",
      data.mileage_km ?? "",
      fuelType?.name ?? "",
      transmission?.name ?? "",
      data.location ?? "",
      data.dealer_id ?? data.created_by ?? "",
      data.status ?? "",
      data.visibility ?? "",
      data.handled_by ?? "",
      handlerProfile?.full_name ?? "",
      data.reserve_price ?? "",
      data.starting_bid ?? "",
      data.buy_now_price ?? "",
      "", // final_price — only known once sold
      data.listing_type ?? "",
      data.inspected_at ? "inspected" : "not inspected",
      data.created_at ?? new Date().toISOString(),
      data.auction_end ?? "",
      "",
    ]);

    return jsonResponse({ data });
  } catch (err) {
    if (err instanceof AdminAuthError) return err;
    console.error("add-car error:", err);
    return jsonResponse({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});
