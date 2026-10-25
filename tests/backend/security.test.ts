import assert from "node:assert/strict";
import {
  activeStaff,
  escapeHtml,
  jsonResponse,
  literalLike,
  readJson,
  uuid,
} from "../../supabase/functions/_shared/http.ts";
import {
  accountPassword,
  randomCharacters,
  randomDigits,
} from "../../supabase/functions/_shared/passwords.ts";
const request = (body: string) =>
  new Request("https://example.test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
Deno.test("JSON parsing rejects arrays, primitives, invalid JSON and oversized streaming bodies", async () => {
  for (const body of ["null", "[]", "true", "{broken"]) {
    try {
      await readJson(request(body));
      assert.fail("accepted invalid body");
    } catch (error) {
      assert.equal((error as Response).status, 400);
    }
  }
  try {
    await readJson(request('{"x":"large"}'), 4);
    assert.fail("accepted oversized body");
  } catch (error) {
    assert.equal((error as Response).status, 413);
  }
  assert.deepEqual(await readJson(request('{"ok":true}')), { ok: true });
});
Deno.test("passwords use a bounded crypto generator and custom passwords keep exact characters", () => {
  const password = accountPassword(undefined);
  assert.equal(password.length, 16);
  assert.match(randomDigits(20), /^\d{20}$/);
  assert.equal(accountPassword("  eight characters  "), "  eight characters  ");
  for (const value of [true, {}, "short", "x".repeat(129)]) {
    assert.throws(() => accountPassword(value));
  }
  assert.throws(() => randomCharacters(1000000000, "ab"));
});
Deno.test("only approved callers with allowed roles pass the shared policy", () => {
  for (const status of [undefined, "pending", "rejected", "suspended"]) {
    assert.equal(activeStaff({ role: "admin", status }, ["admin"]), false);
  }
  assert.equal(
    activeStaff({ role: "manager", status: "approved" }, ["admin"]),
    false,
  );
  assert.equal(
    activeStaff({ role: "admin", status: "approved" }, ["admin"]),
    true,
  );
});
Deno.test("IDs are validated, credential responses cannot be cached, lookup wildcards and HTML are escaped", () => {
  assert.throws(() => uuid("not-an-id"));
  uuid("00000000-0000-0000-0000-000000000001");
  assert.equal(
    jsonResponse({ password: "synthetic-test" }).headers.get("Cache-Control"),
    "no-store",
  );
  assert.equal(literalLike("a_b%"), "a\\_b\\%");
  assert.equal(
    escapeHtml('<img onerror="x">'),
    "&lt;img onerror=&quot;x&quot;&gt;",
  );
});

Deno.test("listing inputs cannot overwrite bid receipts, server stamps or confirm sales", async () => {
  const { validateCarInput, auctionTermsChanged } = await import(
    "../../supabase/functions/_shared/carInput.ts"
  );
  for (
    const payload of [
      { current_bid_dealer: 1 },
      { highest_bidder_id_dealer: "fake" },
      { inspected_by: "fake" },
      { status: "sold" },
      { reserve_price: -1 },
      { minimum_increment: 0 },
    ]
  ) assert.throws(() => validateCarInput(payload));
  assert.equal(
    auctionTermsChanged({
      base_price_dealer: 100000,
      auction_end: "2026-10-25T12:00:00Z",
    }, {
      base_price_dealer: "100000",
      auction_end: "2026-10-25T12:00:00+00:00",
    }),
    false,
  );
  assert.equal(
    auctionTermsChanged({ base_price_dealer: 120000 }, {
      base_price_dealer: 100000,
    }),
    true,
  );
});

Deno.test("Sheet synchronization preserves unprovided cells and maps both column layouts", async () => {
 const {sheetRow}=await import("../../supabase/functions/_shared/sheetRow.ts");
 const record={id:12,row_key:"car",payload:{status:"sold",final_price:100000}};
 assert.deepEqual(sheetRow(record,["car_id","variant","status","final_price"],"car_id",["car","Retain variant","live","90000"]),["car","Retain variant","sold","100000"]);
 assert.deepEqual(sheetRow({...record,payload:{status:"sold"}},["status","car_id"],"car_id"),["sold","car"]);
 assert.equal(sheetRow(record,["sync_queue_id"],"sync_queue_id")[0],"12");
});
