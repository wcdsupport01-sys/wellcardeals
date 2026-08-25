// supabase/functions/mark-sold/index.ts
// Admin-only. Body: { carId: uuid, role: "buyer" | "dealer" }
// Marks the winning track sold on `cars`, and best-effort pushes the
// winner's details to the "Sheet1" tab of the Google Sheet.
// Deploy: supabase functions deploy mark-sold
import { requireStaff, jsonResponse, corsHeaders, AdminAuthError } from "../_shared/adminAuth.ts";
import { pushRowToSheetBestEffort, pushRowToSheetEnsuringTab } from "../_shared/googleSheet.ts";
import {
  SALES_LOG_TAB,
  SALES_LOG_HEADERS,
  CARS_MASTER_TAB,
  CARS_MASTER_HEADERS,
} from "../_shared/sheetTabs.ts";

const WINNERS_TAB = Deno.env.get("GOOGLE_SHEET_WINNERS_TAB") || "Sheet1";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "POST only." }, 405);

  try {
    const { admin } = await requireStaff(req, ["admin", "manager"]);
    const { carId, role } = await req.json();
    if (!carId || !role || !["buyer", "dealer"].includes(role)) {
      return jsonResponse({ error: "carId and role ('buyer'|'dealer') are required." }, 400);
    }

    const { data: car, error: carErr } = await admin.from("cars").select("*").eq("id", carId).maybeSingle();
    if (carErr || !car) return jsonResponse({ error: "Car not found." }, 404);

    const bidderId = role === "dealer" ? car.highest_bidder_id_dealer : car.highest_bidder_id_buyer;
    const bidderName = role === "dealer" ? car.highest_bidder_name_dealer : car.highest_bidder_name_buyer;
    const amount = role === "dealer" ? car.current_bid_dealer : car.current_bid_buyer;

    let phone = "";
    let email = "";
    if (bidderId) {
      const { data: bidderProfile } = await admin
        .from("profiles")
        .select("phone, email")
        .eq("id", bidderId)
        .maybeSingle();
      phone = bidderProfile?.phone || "";
      email = bidderProfile?.email || "";
    }

    const soldField = role === "dealer" ? "dealer_winner_marked_sold" : "buyer_winner_marked_sold";
    const soldAtField = role === "dealer" ? "dealer_winner_marked_sold_at" : "buyer_winner_marked_sold_at";
    const nowIso = new Date().toISOString();

    const { data, error } = await admin
      .from("cars")
      .update({ [soldField]: true, [soldAtField]: nowIso, status: "sold" })
      .eq("id", carId)
      .select()
      .single();
    if (error) return jsonResponse({ error: error.message }, 400);

    await pushRowToSheetBestEffort(WINNERS_TAB, [
      nowIso,
      car.vehicle_title,
      role,
      bidderName || "Unknown",
      phone,
      email,
      amount ?? "",
    ]);

    // NEW — Sales_Log entry (one row per sale, exactly when status -> sold).
    await pushRowToSheetEnsuringTab(SALES_LOG_TAB, SALES_LOG_HEADERS, [
      nowIso,
      data.id,
      `${bidderName || "Unknown"} (${role})${phone ? " — " + phone : ""}`,
      amount ?? "",
      role === "dealer" ? "Dealer Track" : "Buyer Track",
      nowIso,
      "", // commission_margin — fill in if you track a commission calc
    ]);

    // NEW — mirror the sold status into Cars_Master too.
    await pushRowToSheetEnsuringTab(CARS_MASTER_TAB, CARS_MASTER_HEADERS, [
      nowIso,
      data.id,
      data.vehicle_title ?? "",
      data.dealer_id ?? data.created_by ?? "",
      data.status ?? "",
      "",
      "",
      amount ?? data.buy_now_price ?? data.reserve_price ?? "",
      data.listing_type ?? "",
      data.created_at ?? "",
      nowIso,
    ]);

    return jsonResponse({ data });
  } catch (err) {
    if (err instanceof AdminAuthError) return err;
    console.error("mark-sold error:", err);
    return jsonResponse({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});
