// supabase/functions/agent-add-car/index.ts
// Agent-only. Body: { requestId: uuid, ...carPayload }
// Verifies the request is actually assigned to the calling agent and not
// already submitted, then inserts the car (service_role, bypasses the
// select-only RLS on `cars`) and links it back onto car_auction_requests.
// Deploy: supabase functions deploy agent-add-car
import { requireAgent, jsonResponse, corsHeaders, AgentAuthError } from "../_shared/agentAuth.ts";
import { pushRowToSheetEnsuringTab } from "../_shared/googleSheet.ts";
import {
  CARS_MASTER_TAB,
  CARS_MASTER_HEADERS,
  ADMIN_AUDIT_LOGS_TAB,
  ADMIN_AUDIT_LOGS_HEADERS,
} from "../_shared/sheetTabs.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "POST only." }, 405);

  try {
    const { admin, user, profile } = await requireAgent(req);
    const { requestId, ...carPayload } = await req.json();

    if (!requestId) return jsonResponse({ error: "requestId is required." }, 400);
    if (!carPayload || !carPayload.vehicle_title) {
      return jsonResponse({ error: "vehicle_title is required." }, 400);
    }

    const { data: request, error: reqErr } = await admin
      .from("car_auction_requests")
      .select("*")
      .eq("id", requestId)
      .maybeSingle();

    if (reqErr || !request) return jsonResponse({ error: "Request not found." }, 404);
    if (request.assigned_agent_id !== user.id) {
      return jsonResponse({ error: "This request isn't assigned to you." }, 403);
    }
    if (request.status !== "approved") {
      return jsonResponse({ error: "This request hasn't been approved by admin yet." }, 400);
    }
    if (request.agent_status === "submitted") {
      return jsonResponse({ error: "This car has already been submitted." }, 400);
    }
    if (!request.listing_type) {
      return jsonResponse({ error: "Admin hasn't set a listing type (auction / buy now) yet." }, 400);
    }

    const payload = {
      ...carPayload,
      listing_type: request.listing_type,
      status: carPayload.status || "live",
      visibility: carPayload.visibility || "visible",
      channel: carPayload.channel || "buyer",
    };

    // The listing cards / detail page read base_price_buyer / base_price_dealer
    // (and current_bid_buyer / current_bid_dealer) — NOT buy_now_price /
    // starting_bid directly. Those need to be populated on insert or every
    // new listing shows a blank ("—") price. See dealer_pricing_migration.sql.
    const basePrice =
      request.listing_type === "buy_now_only"
        ? carPayload.buy_now_price
        : carPayload.starting_bid ?? carPayload.reserve_price;

    if (basePrice != null) {
      payload.base_price_buyer = basePrice;
      payload.base_price_dealer = basePrice;
      payload.current_bid_buyer = basePrice;
      payload.current_bid_dealer = basePrice;
    }

    const { data: car, error: carErr } = await admin.from("cars").insert(payload).select().single();
    if (carErr) return jsonResponse({ error: carErr.message }, 400);

    const { error: updateErr } = await admin
      .from("car_auction_requests")
      .update({ agent_status: "submitted", car_id: car.id })
      .eq("id", requestId);
    if (updateErr) console.error("agent-add-car: failed to link car_id back:", updateErr.message);

    // NEW — this is the real "car goes live" path for agent-submitted
    // listings, so Cars_Master needs to be updated here too (add-car's own
    // push only covers admin-created cars, not this route).
    const nowIso = new Date().toISOString();
    await pushRowToSheetEnsuringTab(CARS_MASTER_TAB, CARS_MASTER_HEADERS, [
      nowIso,
      car.id,
      car.vehicle_title,
      request.buyer_name ?? request.customer_name ?? request.buyer_id ?? "",
      car.status ?? "",
      user.id,
      profile?.full_name ?? "",
      car.buy_now_price ?? car.reserve_price ?? "",
      car.listing_type ?? "",
      car.created_at ?? nowIso,
      "",
    ]);

    await pushRowToSheetEnsuringTab(ADMIN_AUDIT_LOGS_TAB, ADMIN_AUDIT_LOGS_HEADERS, [
      nowIso,
      user.id,
      profile?.full_name ?? "",
      `Agent submitted inspection & published car ${car.id} from request ${requestId}`,
      "INSPECTION_SUBMITTED",
      car.status ?? "",
    ]);

    return jsonResponse({ data: car });
  } catch (err) {
    if (err instanceof AgentAuthError) return err;
    console.error("agent-add-car error:", err);
    return jsonResponse({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});
