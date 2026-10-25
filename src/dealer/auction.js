export const money = (amount) =>
  amount == null ? "—" : "₹" + Number(amount).toLocaleString("en-IN");

export function minimumBid(car) {
  const current = Number(
    car.current_bid_dealer || car.base_price_dealer || car.starting_bid || 0,
  );
  return Math.ceil(
    Math.max(
      current + Number(car.minimum_increment || 5000),
      Number(car.reserve_price || 0),
    ),
  );
}

export function auctionStatus(car, userId, myBid, now = Date.now()) {
  const leading = Boolean(userId && car.highest_bidder_id_dealer === userId);
  if (car.status === "sold")
    return leading && car.dealer_winner_marked_sold
      ? { key: "confirmed", label: "Deal confirmed", tone: "green" }
      : { key: "closed", label: "Closed", tone: "gray" };
  const deadline = car.auction_end ? Date.parse(car.auction_end) : NaN;
  const live = car.status === "live" && deadline > now;
  if (!live)
    return leading &&
      Number.isFinite(deadline) &&
      deadline <= now &&
      ["live", "ended"].includes(car.status)
      ? {
          key: "approval",
          label: "Highest bidder · awaiting approval",
          tone: "amber",
        }
      : { key: "ended", label: "Auction ended", tone: "gray" };
  if (leading)
    return { key: "leading", label: "You are leading", tone: "green" };
  if (myBid)
    return { key: "outbid", label: "You have been outbid", tone: "red" };
  return { key: "live", label: "Open for bidding", tone: "blue" };
}

export function timeLeft(end, now) {
  const remaining = new Date(end).getTime() - now;
  if (!Number.isFinite(remaining) || remaining <= 0) return "Ended";
  const seconds = Math.floor(remaining / 1000);
  return `${Math.floor(seconds / 3600)
    .toString()
    .padStart(2, "0")}:${Math.floor((seconds / 60) % 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}

export function bidErrorMessage(error) {
  if (error?.code === "PGRST202" || error?.code === "42883") {
    return "Auction upgrade is not available yet. Please contact support; no new bid was confirmed.";
  }
  return (
    error?.message ||
    "Could not confirm the bid. Check its status before placing another bid."
  );
}

export const definiteRejection = (error) =>
  ["22023", "42501", "P0002", "PGRST202", "42883", "23514"].includes(
    error?.code,
  );

// Formula-safe CSV, including names supplied by users. IDs are exported as text.
export function bidsCsv(rows) {
  const quote = (value) => {
    const text = String(value ?? "");
    return (
      '"' +
      (/^\s*[=+@-]|^[\t\r\n]/.test(text) ? "'" + text : text).replaceAll(
        '"',
        '""',
      ) +
      '"'
    );
  };
  const columns = [
    "id",
    "request_id",
    "car_id",
    "bidder_id",
    "bidder_name",
    "bidder_role",
    "amount",
    "created_at",
  ];
  return [
    columns.join(","),
    ...rows.map((row) => columns.map((key) => quote(row[key])).join(",")),
  ].join("\r\n");
}

// Keep server cursors intact: bid IDs can be UUIDs or large integer strings.
export async function loadBidAudit(db) {
  const rows = [];
  const seen = new Set();
  let cursor = null;
  let asOf = null;
  while (true) {
    const { data, error } = await db
      .rpc("get_dealer_bid_audit_page", {
        p_before_time: cursor?.time ?? null,
        p_before_id: cursor?.id ?? null,
        p_limit: 500,
        p_as_of: asOf,
      })
      .abortSignal(AbortSignal.timeout(15000));
    if (error) throw error;
    if (!Array.isArray(data?.rows) || !data.as_of)
      throw new Error("Invalid bid export response.");
    rows.push(...data.rows);
    if (!data.next_cursor) return rows;
    const next = data.next_cursor;
    const key = JSON.stringify([next.time, next.id]);
    if (typeof next.id !== "string" || !next.time || seen.has(key))
      throw new Error("Unable to advance bid export.");
    seen.add(key);
    cursor = next;
    asOf = data.as_of;
  }
}
