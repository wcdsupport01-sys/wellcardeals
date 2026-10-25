import assert from "node:assert/strict";
import { actorId, configure, scenario } from "./fake-supabase.ts";
Deno.env.set("SUPABASE_URL", "https://example.test");
Deno.env.set("SUPABASE_ANON_KEY", "synthetic-anon");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "synthetic-service");
for (
  const name of [
    "GOOGLE_PRIVATE_KEY",
    "GOOGLE_CLIENT_EMAIL",
    "GOOGLE_SHEET_ID",
    "RESEND_API_KEY",
  ]
) Deno.env.delete(name);
const handlers = new Map<string, (req: Request) => Promise<Response>>();
async function handler(name: string) {
  if (!handlers.has(name)) {
    const original = Deno.serve;
    (Deno as any).serve = (callback: any) => {
      handlers.set(name, callback);
      return {};
    };
    try {
      await import(`../../supabase/functions/${name}/index.ts`);
    } finally {
      (Deno as any).serve = original;
    }
  }
  return handlers.get(name)!;
}
function request(body: unknown, authorized = true) {
  return new Request("https://example.test/function", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authorized ? { Authorization: "Bearer synthetic-token" } : {}),
    },
    body: JSON.stringify(body),
  });
}
Deno.test("staff password reset rejects anonymous, suspended, manager and buyer targets", async () => {
  const reset = await handler("reset-user-password");
  configure();
  assert.equal((await reset(request({}, false))).status, 401);
  configure({ actor: { id: actorId, role: "admin", status: "suspended" } });
  assert.equal((await reset(request({}))).status, 403);
  configure({ actor: { id: actorId, role: "manager", status: "approved" } });
  assert.equal((await reset(request({}))).status, 403);
  configure({
    target: { id: "00000000-0000-0000-0000-000000000002", role: "buyer" },
  });
  assert.equal(
    (await reset(request({ userId: scenario.target.id }))).status,
    400,
  );
  assert(!scenario.calls.includes("resetPassword"));
});
Deno.test("approved admin can reset a staff account once with an uncached generated password", async () => {
  configure();
  const reset = await handler("reset-user-password");
  const response = await reset(request({ userId: scenario.target.id }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal((await response.json()).password.length, 16);
  assert.equal(
    scenario.calls.filter((call: any) => call === "resetPassword").length,
    1,
  );
});
Deno.test("dealer approval never takes over an existing account with the same email", async () => {
  for (const name of ["approve-dealer", "approve-dealer-application"]) {
    configure({ createError: { message: "Email already registered" } });
    const approve = await handler(name);
    const response = await approve(
      request({ applicationId: scenario.target.id }),
    );
    assert.equal(response.status, 409);
    assert(!scenario.calls.includes("resetPassword"));
    assert(!scenario.calls.includes("listUsers"));
    assert(
      !scenario.calls.some((call: any) =>
        Array.isArray(call) && call[0] === "profiles" && call[1] === "upsert"
      ),
    );
  }
});
Deno.test("invalid JSON values return a client error instead of invoking account mutations", async () => {
  configure();
  const reset = await handler("reset-user-password");
  for (
    const value of [null, [], { userId: "bad-id" }, {
      userId: scenario.target.id,
      password: true,
    }]
  ) assert.equal((await reset(request(value))).status, 400);
  assert(!scenario.calls.includes("resetPassword"));
});

Deno.test("listing update rejects tampering and changed auction terms after bids", async () => {
  const update = await handler("update-car");
  configure();
  assert.equal(
    (await update(request({ id: scenario.target.id, current_bid_dealer: 1 })))
      .status,
    400,
  );
  assert(
    !scenario.calls.some((call: any) =>
      Array.isArray(call) && call[0] === "cars" && call[1] === "update"
    ),
  );
  configure({
    car: {
      id: "00000000-0000-0000-0000-000000000002",
      base_price_dealer: 100000,
    },
    bidCount: 1,
  });
  assert.equal(
    (await update(request({ id: scenario.car.id, base_price_dealer: 120000 })))
      .status,
    409,
  );
});
Deno.test("concurrent bid causes listing edit to return conflict instead of overwriting it", async () => {
  const update = await handler("update-car");
  configure({
    car: {
      id: "00000000-0000-0000-0000-000000000002",
      base_price_dealer: 100000,
      current_bid_dealer: 100000,
      highest_bidder_id_dealer: null,
    },
    bidCount: 0,
    carUpdateMissing: true,
  });
  assert.equal(
    (await update(request({ id: scenario.car.id, base_price_dealer: 120000 })))
      .status,
    409,
  );
  const mutation = scenario.calls.find((call: any) =>
    Array.isArray(call) && call[0] === "cars" && call[1] === "update"
  );
  assert(mutation);
  assert.equal(mutation[2].current_bid_dealer, 120000);
  assert(
    mutation[3].some((filter: any) =>
      filter[0] === "current_bid_dealer" && filter[1] === 100000
    ),
  );
});
Deno.test("sale confirmation is idempotent and rejects empty or still-open auctions", async () => {
  const sell = await handler("mark-sold");
  const id = "00000000-0000-0000-0000-000000000002";
  configure({ car: { id, status: "sold", dealer_winner_marked_sold: true } });
  const duplicate = await sell(request({ carId: id, role: "dealer" }));
  assert.equal(duplicate.status, 200);
  assert.equal((await duplicate.json()).alreadyConfirmed, true);
  assert(
    !scenario.calls.some((call: any) =>
      Array.isArray(call) && call[0] === "cars" && call[1] === "update"
    ),
  );
  configure({
    car: {
      id,
      status: "live",
      current_bid_dealer: 100000,
      highest_bidder_id_dealer: actorId,
      auction_end: new Date(Date.now() + 100000).toISOString(),
    },
  });
  assert.equal(
    (await sell(request({ carId: id, role: "dealer" }))).status,
    409,
  );
  configure({ car: { id, status: "live" } });
  assert.equal(
    (await sell(request({ carId: id, role: "dealer" }))).status,
    409,
  );
});
