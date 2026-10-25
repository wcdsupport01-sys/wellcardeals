import test from "node:test";
import assert from "node:assert/strict";
import {
  loadBidAudit,
  auctionStatus,
  bidsCsv,
  minimumBid,
  timeLeft,
} from "../src/dealer/auction.js";

const now = Date.parse("2026-10-25T12:00:00Z");
const car = {
  status: "live",
  auction_end: "2026-10-25T13:00:00Z",
  current_bid_dealer: "400000",
  minimum_increment: "5000",
  reserve_price: "420000",
};
test("minimum bid handles database numeric strings and reserve price", () => {
  assert.equal(minimumBid(car), 420000);
  assert.equal(minimumBid({ ...car, reserve_price: 0 }), 405000);
  assert.equal(minimumBid({ base_price_dealer: "300000" }), 305000);
});
test("ranking uses bidder identity and distinguishes seller approval from sale", () => {
  assert.equal(auctionStatus(car, "me", null, now).key, "live");
  assert.equal(auctionStatus(car, "me", { amount: 400000 }, now).key, "outbid");
  const leading = { ...car, highest_bidder_id_dealer: "me" };
  assert.equal(auctionStatus(leading, "me", {}, now).key, "leading");
  assert.equal(auctionStatus(leading, "me", {}, now + 3600001).key, "approval");
  assert.equal(
    auctionStatus({ ...leading, status: "sold" }, "me", {}, now).key,
    "closed",
  );
  assert.equal(
    auctionStatus(
      { ...leading, status: "sold", dealer_winner_marked_sold: true },
      "me",
      {},
      now,
    ).key,
    "confirmed",
  );
});
test("missing and invalid deadlines cannot appear open", () => {
  assert.equal(
    auctionStatus(
      { ...car, auction_end: null, highest_bidder_id_dealer: "me" },
      "me",
      {},
      now,
    ).key,
    "ended",
  );
  assert.equal(
    auctionStatus(
      { ...car, status: "paused", highest_bidder_id_dealer: "me" },
      "me",
      {},
      now + 3600001,
    ).key,
    "ended",
  );
  assert.equal(timeLeft(null, now), "Ended");
  assert.equal(timeLeft("invalid", now), "Ended");
  assert.equal(timeLeft(car.auction_end, now), "01:00:00");
  assert.equal(
    auctionStatus({ ...car, auction_end: null }, "me", null, now).key,
    "ended",
  );
});
test("CSV preserves bid IDs and escapes names that spreadsheets could execute", () => {
  const csv = bidsCsv([
    { id: "9007199254740993", bidder_name: '=1+1,"dealer"', amount: 500000 },
  ]);
  assert(csv.includes('"9007199254740993"'));
  assert(csv.includes('"\'=1+1,""dealer"""'));
});

test("admin export keeps UUID cursors and the same server cutoff across pages", async () => {
  const calls = [];
  const id = "f0000000-0000-0000-0000-000000000001";
  const at = "2026-10-25T12:00:00Z";
  const replies = [
    { rows: [{ id }], as_of: at, next_cursor: { time: at, id } },
    {
      rows: [{ id: "00000000-0000-0000-0000-000000000002" }],
      as_of: at,
      next_cursor: null,
    },
  ];
  const db = {
    rpc: (name, args) => {
      calls.push({ name, args });
      return {
        abortSignal: async () => ({ data: replies.shift(), error: null }),
      };
    },
  };
  const rows = await loadBidAudit(db);
  assert.equal(rows.length, 2);
  assert.equal(calls[1].args.p_before_id, id);
  assert.equal(calls[1].args.p_before_time, at);
  assert.equal(calls[1].args.p_as_of, at);
});

test("admin export refuses a repeated cursor", async () => {
  const response = {
    rows: [],
    as_of: "2026-10-25T12:00:00Z",
    next_cursor: { id: "same", time: "2026-10-25T11:00:00Z" },
  };
  const db = {
    rpc: () => ({ abortSignal: async () => ({ data: response, error: null }) }),
  };
  await assert.rejects(loadBidAudit(db), /advance bid export/);
});
