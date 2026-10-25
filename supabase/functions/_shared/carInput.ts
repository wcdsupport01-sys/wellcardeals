import { InputError } from "./http.ts";
const PROTECTED = new Set([
  "id",
  "created_at",
  "updated_at",
  "current_bid_buyer",
  "current_bid_dealer",
  "highest_bidder_id_buyer",
  "highest_bidder_id_dealer",
  "highest_bidder_name",
  "highest_bidder_name_buyer",
  "highest_bidder_name_dealer",
  "buyer_winner_marked_sold",
  "buyer_winner_marked_sold_at",
  "dealer_winner_marked_sold",
  "dealer_winner_marked_sold_at",
  "inspected_by",
  "inspected_at",
  "handled_at",
  "dealer_winner_contacted_at",
  "buyer_winner_contacted_at",
  "tl_reviewed_by",
  "tl_reviewed_at",
]);
export const AUCTION_TERMS = [
  "base_price_buyer",
  "base_price_dealer",
  "starting_bid",
  "reserve_price",
  "minimum_increment",
  "auction_start",
  "auction_end",
  "listing_type",
];
export function validateCarInput(payload: Record<string, any>, create = false) {
  for (const key of Object.keys(payload)) {
    if (PROTECTED.has(key)) {
      throw new InputError(`${key} is controlled by the server.`);
    }
  }
  for (
    const key of [
      "base_price_buyer",
      "base_price_dealer",
      "starting_bid",
      "reserve_price",
      "buy_now_price",
      "minimum_increment",
      "negotiated_price",
    ]
  ) {
    const value = payload[key];
    if (
      value != null &&
      (typeof value !== "number" || !Number.isFinite(value) || value < 0 ||
        value > Number.MAX_SAFE_INTEGER)
    ) throw new InputError(`${key} must be a valid nonnegative number.`);
  }
  if (
    payload.minimum_increment != null &&
    (!Number.isSafeInteger(payload.minimum_increment) ||
      payload.minimum_increment <= 0)
  ) {
    throw new InputError(
      "minimum_increment must be a positive whole-rupee amount.",
    );
  }
  if ("status" in payload && payload.status === "sold") {
    throw new InputError(
      "Confirm a sale through the sale action, not the listing editor.",
    );
  }
  if (
    create &&
    (typeof payload.vehicle_title !== "string" || !payload.vehicle_title.trim())
  ) throw new InputError("vehicle_title is required.");
  for (const field of ["auction_start", "auction_end"]) {
    if (
      payload[field] != null &&
      (typeof payload[field] !== "string" ||
        !Number.isFinite(Date.parse(payload[field])))
    ) throw new InputError(`${field} must be a valid timestamp.`);
  }
  if (
    payload.inspection != null &&
    (typeof payload.inspection !== "object" ||
      Array.isArray(payload.inspection))
  ) throw new InputError("inspection must be an object.");
}

export function auctionTermsChanged(
  payload: Record<string, any>,
  before: Record<string, any>,
): boolean {
  return AUCTION_TERMS.some((field) => {
    if (!(field in payload)) return false;
    if (payload[field] == null || before[field] == null) {
      return payload[field] !== before[field];
    }
    if (field === "auction_start" || field === "auction_end") {
      return Date.parse(payload[field]) !== Date.parse(before[field]);
    }
    if (field === "listing_type") return payload[field] !== before[field];
    return Number(payload[field]) !== Number(before[field]);
  });
}
