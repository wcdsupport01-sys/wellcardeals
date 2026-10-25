// Start a disposable database and load tests/auction-fixture.sql + the v2
// migration first. See docs/DEALER_AUCTIONS.md. Never targets a remote database.
import test, { before } from "node:test";
import process from "node:process";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

const container = process.env.AUCTION_TEST_CONTAINER;
function sql(query) {
  return new Promise((resolve, reject) => {
    const process = spawn("docker", [
      "exec",
      "-i",
      container,
      "psql",
      "-U",
      "postgres",
      "-AtXq",
      "-v",
      "ON_ERROR_STOP=1",
    ]);
    let out = "",
      err = "";
    process.stdout.on("data", (data) => {
      out += data;
    });
    process.stderr.on("data", (data) => {
      err += data;
    });
    process.on("error", reject);
    process.on("close", (code) =>
      code ? reject(new Error(err)) : resolve(out.trim()),
    );
    process.stdin.end(query);
  });
}
const user = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const as = (n, query) =>
  sql(
    `BEGIN; SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub = '${user(n)}'; ${query}; COMMIT;`,
  );
async function auction(overrides = "") {
  const id = randomUUID();
  await sql(
    `INSERT INTO public.cars (id,vehicle_title,location,status,listing_type,auction_end,base_price_dealer,minimum_increment) VALUES ('${id}','Test car','Delhi','live','auction',clock_timestamp()+interval '1 hour',100000,5000); ${overrides ? `UPDATE public.cars SET ${overrides} WHERE id='${id}';` : ""}`,
  );
  return id;
}
const place = (who, carId, amount, requestId = randomUUID()) =>
  as(
    who,
    `SELECT public.place_dealer_bid_v2('${carId}',${amount},'${requestId}')`,
  ).then(JSON.parse);
const dbtest = (name, fn) => test(name, { skip: !container }, fn);
if (container)
  before(async () => {
    assert.equal(
      await sql("SELECT disposable FROM public.auction_test_marker"),
      "t",
      "Refusing to reset a database without the disposable fixture marker",
    );
    await sql(
      "TRUNCATE public.wishlist, public.car_bids, public.cars RESTART IDENTITY CASCADE",
    );
  });

dbtest(
  "accepted bid and car state commit together; retry after close returns original receipt",
  async () => {
    const id = await auction();
    const key = randomUUID();
    const first = await place(1, id, 105000, key);
    assert.equal(first.amount, 105000);
    assert.equal(typeof first.bid_id, "string");
    assert(first.accepted_at);
    const snapshot = JSON.parse(
      await as(1, `SELECT public.dealer_auction_snapshot('${id}')`),
    );
    assert.equal(snapshot.my_bid_count, 1);
    assert.equal(snapshot.recent_bids.length, 1);
    assert.equal(snapshot.my_bid.amount, snapshot.car.current_bid_dealer);
    await sql(
      `UPDATE public.cars SET auction_end=clock_timestamp()-interval '1 second' WHERE id='${id}'`,
    );
    const second = await place(1, id, 105000, key);
    assert.equal(first.bid_id, second.bid_id);
    assert.equal(
      await sql(`SELECT count(*) FROM public.car_bids WHERE car_id='${id}'`),
      "1",
    );
    assert.equal(
      await sql(`SELECT current_bid_dealer FROM public.cars WHERE id='${id}'`),
      "105000",
    );
    await assert.rejects(place(1, id, 110000, key), /another bid/);
  },
);
dbtest("simultaneous equal bids accept exactly one dealer", async () => {
  const id = await auction();
  const outcomes = await Promise.allSettled([
    place(1, id, 105000),
    place(2, id, 105000),
  ]);
  assert.equal(
    outcomes.filter((result) => result.status === "fulfilled").length,
    1,
  );
  assert.equal(
    await sql(`SELECT count(*) FROM public.car_bids WHERE car_id='${id}'`),
    "1",
  );
});
dbtest(
  "concurrent retries with one request ID create one receipt",
  async () => {
    const id = await auction();
    const key = randomUUID();
    const receipts = await Promise.all([
      place(1, id, 105000, key),
      place(1, id, 105000, key),
    ]);
    assert.equal(receipts[0].bid_id, receipts[1].bid_id);
  },
);
dbtest(
  "buyers, pending dealers, closed and buy-now listings are rejected",
  async () => {
    const id = await auction();
    await assert.rejects(place(3, id, 105000), /approved dealers/);
    await assert.rejects(place(4, id, 105000), /approved dealers/);
    await assert.rejects(
      place(1, await auction("listing_type='buy_now_only'"), 105000),
      /not open/,
    );
    await assert.rejects(
      place(
        1,
        await auction("auction_end=clock_timestamp()-interval '1 second'"),
        105000,
      ),
      /not open/,
    );
    await assert.rejects(place(1, id, 105000.5), /whole-rupee/);
    await assert.rejects(place(1, id, "'NaN'::numeric"), /whole-rupee/);
    await assert.rejects(place(1, id, 100001), /at least/);
    await assert.rejects(
      place(1, await auction("reserve_price=150000"), 105000),
      /at least/,
    );
  },
);
dbtest(
  "deadline is checked after waiting for another transaction",
  async () => {
    const id = await auction(
      "auction_end=clock_timestamp()+interval '700 milliseconds'",
    );
    const lock = sql(
      `SET application_name='auction-expiry-test'; BEGIN; SELECT id FROM public.cars WHERE id='${id}' FOR UPDATE; SELECT pg_sleep(1.1); COMMIT;`,
    );
    for (let i = 0; i < 20; i++) {
      if (
        (await sql(
          "SELECT count(*) FROM pg_stat_activity WHERE application_name='auction-expiry-test' AND wait_event='PgSleep'",
        )) === "1"
      )
        break;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    await assert.rejects(place(1, id, 105000), /not open/);
    await lock;
    assert.equal(
      await sql(`SELECT count(*) FROM public.car_bids WHERE car_id='${id}'`),
      "0",
    );
  },
);
dbtest("failure to update car rolls back the new bid", async () => {
  const id = await auction();
  await sql(
    `CREATE FUNCTION public.test_update_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.id='${id}' THEN RAISE EXCEPTION 'test update rejected'; END IF; RETURN NEW; END $$; CREATE TRIGGER test_update_failure BEFORE UPDATE ON public.cars FOR EACH ROW EXECUTE FUNCTION public.test_update_failure();`,
  );
  try {
    await assert.rejects(place(1, id, 105000), /test update rejected/);
  } finally {
    await sql(
      "DROP TRIGGER test_update_failure ON public.cars; DROP FUNCTION public.test_update_failure()",
    );
  }
  assert.equal(
    await sql(`SELECT count(*) FROM public.car_bids WHERE car_id='${id}'`),
    "0",
  );
});
dbtest(
  "receipt privacy, direct-write prevention and history retention",
  async () => {
    const id = await auction();
    const key = randomUUID();
    await place(1, id, 105000, key);
    assert.equal(
      await as(2, `SELECT public.dealer_bid_receipt('${key}') IS NULL`),
      "t",
    );
    await assert.rejects(
      as(
        1,
        `UPDATE public.cars SET auction_end=clock_timestamp()+interval '1 day' WHERE id='${id}'`,
      ),
      /permission denied|verified server/,
    );
    await assert.rejects(
      as(
        1,
        `INSERT INTO public.car_bids(car_id,bidder_id,bidder_name,bidder_role,amount) VALUES ('${id}','${user(1)}','spoof','dealer',999999)`,
      ),
      /permission denied|verified server/,
    );
    await assert.rejects(
      sql(`DELETE FROM public.cars WHERE id='${id}'`),
      /foreign key/,
    );
    await assert.rejects(
      as(1, "SELECT public.get_dealer_bid_audit_page()"),
      /Staff access/,
    );
    const audit = await as(
      5,
      "SELECT public.get_dealer_bid_audit_page(NULL,NULL,1)",
    );
    assert.equal(typeof JSON.parse(audit).rows[0].id, "string");
  },
);
dbtest(
  "dashboard counts every participated car, paginates and supports watchlists",
  async () => {
    for (let i = 0; i < 10; i++) await place(1, await auction(), 105000);
    const result = JSON.parse(
      await as(1, "SELECT public.get_dealer_auction_dashboard('bids','',0,3)"),
    );
    assert(result.summary.bids >= 10);
    assert(result.total >= 10);
    assert.equal(result.items.length, 3);
    const watched = result.items[0].id;
    await as(
      1,
      `INSERT INTO public.wishlist(buyer_id,car_id) VALUES ('${user(1)}','${watched}')`,
    );
    const watch = JSON.parse(
      await as(1, "SELECT public.get_dealer_auction_dashboard('watchlist')"),
    );
    assert.equal(watch.items.length, 1);
    assert.equal(watch.items[0].id, watched);
  },
);

dbtest(
  "legacy frontend signature delegates to verified v2 without changing its response shape",
  async () => {
    const id = await auction();
    const car = JSON.parse(
      await as(1, `SELECT to_jsonb(public.place_dealer_bid('${id}',105000))`),
    );
    assert.equal(car.id, id);
    assert.equal(car.current_bid_dealer, 105000);
    assert.equal(car.highest_bidder_id_dealer, user(1));
    assert.equal(
      await sql(
        `SELECT count(*) FROM public.car_bids WHERE car_id='${id}' AND request_id IS NOT NULL`,
      ),
      "1",
    );
    await assert.rejects(
      as(1, `SELECT public.place_dealer_bid('${id}',105000)`),
      /at least/,
    );
    await assert.rejects(
      as(3, `SELECT public.place_dealer_bid('${id}',110000)`),
      /approved dealers/,
    );
    await assert.rejects(
      as(1, `SELECT public.place_dealer_bid('${id}',110000.5)`),
      /whole-rupee/,
    );
    await assert.rejects(
      sql(`SET ROLE anon; SELECT public.place_dealer_bid('${id}',110000)`),
      /permission denied/,
    );
  },
);

dbtest("legacy endpoint also rejects closed and buy-now auctions", async () => {
  const closed = await auction(
    "auction_end=clock_timestamp()-interval '1 second'",
  );
  const buyNow = await auction("listing_type='buy_now_only'");
  await assert.rejects(
    as(1, `SELECT public.place_dealer_bid('${closed}',105000)`),
    /not open/,
  );
  await assert.rejects(
    as(1, `SELECT public.place_dealer_bid('${buyNow}',105000)`),
    /not open/,
  );
});

dbtest(
  "audit pagination preserves opaque IDs, equal timestamps and legacy null times",
  async () => {
    const id = await auction();
    await sql(`INSERT INTO public.car_bids(car_id,bidder_id,bidder_name,bidder_role,amount,created_at)
    SELECT '${id}','${user(1)}','Historical dealer','dealer',105000+n,
      CASE WHEN n=6 THEN NULL ELSE '2020-01-01T00:00:00Z'::timestamptz END
    FROM generate_series(1,6) n`);
    const expected = JSON.parse(
      await sql(
        `SELECT jsonb_agg(id::text) FROM public.car_bids WHERE car_id='${id}'`,
      ),
    );
    const first = JSON.parse(
      await as(5, "SELECT public.get_dealer_bid_audit_page(NULL,NULL,3)"),
    );
    const newer =
      await sql(`INSERT INTO public.car_bids(car_id,bidder_id,bidder_name,bidder_role,amount)
    VALUES ('${id}','${user(1)}','Newer dealer','dealer',150000) RETURNING id::text`);
    const rows = [...first.rows];
    let cursor = first.next_cursor;
    let pages = 0;
    while (cursor) {
      assert(++pages < 100);
      const next = JSON.parse(
        await as(
          5,
          `SELECT public.get_dealer_bid_audit_page('${cursor.time}','${cursor.id}',3,'${first.as_of}')`,
        ),
      );
      rows.push(...next.rows);
      cursor = next.next_cursor;
    }
    const ids = rows.map((row) => row.id);
    assert.equal(new Set(ids).size, ids.length);
    assert(!ids.includes(newer));
    for (const saved of expected)
      assert(ids.includes(saved), `missing bid ${saved}`);
  },
);

dbtest(
  "reapplying the migration preserves all existing bid IDs, amounts and receipts",
  async () => {
    const capture =
      "SELECT jsonb_agg(to_jsonb(b) ORDER BY b.id::text) FROM public.car_bids b";
    const before = await sql(capture);
    const migration = await readFile(
      new URL("../supabase/dealer_auction_v2_migration.sql", import.meta.url),
      "utf8",
    );
    await sql(migration);
    assert.equal(await sql(capture), before);
  },
);
