import { validateCarInput, auctionTermsChanged } from "../_shared/carInput.ts";
import { readJson, InputError, uuid } from "../_shared/http.ts";
// supabase/functions/update-car/index.ts
// Admin-only. Body: { id: uuid, ...fieldsToUpdate }
// If the update touches negotiation_status/notes/price, also best-effort
// pushes a row to the "Negotiations" tab of the Google Sheet.
// Deploy: supabase functions deploy update-car
import { requireStaff, jsonResponse, corsHeaders, AdminAuthError } from "../_shared/adminAuth.ts";
import { pushRowToSheetBestEffort, pushRowToSheetEnsuringTab } from "../_shared/googleSheet.ts";
import {
  CARS_MASTER_TAB,
  CARS_MASTER_HEADERS,
  ADMIN_AUDIT_LOGS_TAB,
  ADMIN_AUDIT_LOGS_HEADERS,
} from "../_shared/sheetTabs.ts";

const NEGOTIATIONS_TAB = Deno.env.get("GOOGLE_SHEET_NEGOTIATIONS_TAB") || "Negotiations";
const NEGOTIATION_FIELDS = ["negotiation_status", "negotiation_notes", "negotiated_price"];
const AUDIT_TRACKED_FIELDS = ["status", "reserve_price", "buy_now_price", "starting_bid", "listing_type", "handled_by"];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "POST only." }, 405);

  try {
    const { admin, user, profile } = await requireStaff(req, ["admin", "manager"]);
    const { id, ...payload } = await readJson(req);
    uuid(id, "id");
    validateCarInput(payload);

    if (!id) return jsonResponse({ error: "id is required." }, 400);
    if (Object.keys(payload).length === 0) {
      return jsonResponse({ error: "No fields to update." }, 400);
    }

    if (payload.inspection != null && (typeof payload.inspection !== "object" || Array.isArray(payload.inspection))) throw new InputError("inspection must be an object.");
    // Same reasoning as add-car: never trust a client-supplied
    // inspected_by/inspected_at, always derive from this request's own
    // verified session.
    if ("inspection" in payload) {
      const hasRealInspection = Object.values((payload.inspection || {}) as Record<string, { status?: string }>).some((v) => v && v.status);
      payload.inspected_by = hasRealInspection ? user.id : null;
      payload.inspected_at = hasRealInspection ? new Date().toISOString() : null;
    }

    // Claiming a car ("I'm handling this one") — Inventory page sends
    // { handled_by: <uuid> }. Timestamp is still server-derived so it can't
    // be spoofed, same as inspected_at above.
    if ("handled_by" in payload) {
      payload.handled_at = payload.handled_by ? new Date().toISOString() : null;
    }

    // Fetch the row BEFORE updating so the audit log can show a meaningful
    // "previous_status -> new_status" (and which fields actually changed).
    const { data: before, error: readError } = await admin.from("cars").select("*").eq("id", id).maybeSingle();

    if (readError) return jsonResponse({ error: "Could not verify the current listing." }, 503);
    if (!before) return jsonResponse({ error: "Car not found." }, 404);
    const changesTerms = auctionTermsChanged(payload, before);
    if (changesTerms) {
      const { count, error: bidsError } = await admin.from("car_bids").select("id", { count: "exact", head: true }).eq("car_id", id);
      if (bidsError) return jsonResponse({ error: "Could not verify bid history." }, 503);
      if (count || before.highest_bidder_id_dealer || before.highest_bidder_id_buyer) return jsonResponse({ error: "Auction terms cannot change after bids exist. Preserve this auction and create a new listing." }, 409);
      if ("base_price_dealer" in payload) payload.current_bid_dealer = payload.base_price_dealer;
      if ("base_price_buyer" in payload) payload.current_bid_buyer = payload.base_price_buyer;
    }
    let mutation = admin.from("cars").update(payload).eq("id", id);
    if (changesTerms) {
      // The UPDATE rechecks these predicates after waiting for any concurrent
      // bid transaction. A bid arriving after the count cannot be overwritten.
      for (const field of ["current_bid_dealer", "current_bid_buyer", "highest_bidder_id_dealer", "highest_bidder_id_buyer"]) {
        mutation = before[field] == null ? mutation.is(field, null) : mutation.eq(field, before[field]);
      }
    }
    const { data, error } = await mutation.select().maybeSingle();
    if (error) return jsonResponse({ error: error.message }, 400);
    if (!data) return jsonResponse({ error: "Listing changed while you were editing. Refresh and review it again." }, 409);

    const touchesNegotiation = NEGOTIATION_FIELDS.some((f) => f in payload);
    if (touchesNegotiation) {
      await pushRowToSheetBestEffort(NEGOTIATIONS_TAB, [
        new Date().toISOString(),
        data.id,
        data.vehicle_title ?? "",
        data.negotiation_status ?? "",
        data.negotiated_price ?? "",
        data.negotiation_notes ?? "",
      ]);
    }

    // NEW — mirror into Cars_Master + Admin_Audit_Logs if anything
    // audit-worthy (status/price/listing_type/handled_by) changed.
    const touchesAudit = AUDIT_TRACKED_FIELDS.some((f) => f in payload);
    if (touchesAudit && before) {
      const nowIso = new Date().toISOString();

      const [{ data: handlerProfile }, { data: fuelType }, { data: transmission }] = await Promise.all([
        data.handled_by
          ? admin.from("profiles").select("full_name").eq("id", data.handled_by).maybeSingle()
          : { data: null },
        data.fuel_type_id
          ? admin.from("fuel_types").select("name").eq("id", data.fuel_type_id).maybeSingle()
          : { data: null },
        data.transmission_id
          ? admin.from("transmissions").select("name").eq("id", data.transmission_id).maybeSingle()
          : { data: null },
      ]);

      await pushRowToSheetEnsuringTab(CARS_MASTER_TAB, CARS_MASTER_HEADERS, [
        nowIso,
        data.id,
        data.vehicle_title ?? "",
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
        data.status === "sold" ? data.buy_now_price ?? data.reserve_price ?? "" : "",
        data.listing_type ?? "",
        data.inspected_at ? "inspected" : "not inspected",
        data.created_at ?? "",
        data.auction_end ?? "",
        data.status === "sold" ? nowIso : "",
      ]);

      const changedFields = AUDIT_TRACKED_FIELDS.filter(
        (f) => (before as any)[f] !== (data as any)[f]
      );
      const actionSummary = changedFields
        .map((f) => `${f}: ${(before as any)[f] ?? "—"} -> ${(data as any)[f] ?? "—"}`)
        .join("; ");

      await pushRowToSheetEnsuringTab(ADMIN_AUDIT_LOGS_TAB, ADMIN_AUDIT_LOGS_HEADERS, [
        nowIso,
        user?.id ?? "",
        profile?.full_name ?? user?.email ?? "",
        `Updated car ${data.id}: ${actionSummary}`,
        before.status ?? "",
        data.status ?? "",
      ]);
    }

    return jsonResponse({ data });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("update-car error:", err);
    return jsonResponse({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});
