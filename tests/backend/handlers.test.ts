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

Deno.test("listing update rejects client tampering before a database command and maps database conflicts", async () => {
  const update=await handler("update-car"); configure();
  assert.equal((await update(request({id:scenario.target.id,current_bid_dealer:1}))).status,400);
  assert(!scenario.calls.some((c:any)=>Array.isArray(c)&&c[0]==="rpc"));
  configure({commandError:{code:"22023",message:"Auction terms cannot change after bids exist."}});
  assert.equal((await update(request({id:scenario.target.id,base_price_dealer:120000}))).status,409);
  assert(!scenario.calls.some((c:any)=>Array.isArray(c)&&c[0]==="cars"&&c[1]==="update"));
});
Deno.test("authenticated commands forward the verified actor and stable operation header", async () => {
 const update=await handler("update-car"); configure();
 const req=request({id:scenario.target.id,vehicle_title:"Revised listing"});
 req.headers.set("idempotency-key","00000000-0000-0000-0000-000000000099");
 assert.equal((await update(req)).status,200);
 const call=scenario.calls.find((c:any)=>Array.isArray(c)&&c[0]==="rpc");
 assert.equal(call[2].p_actor_id,actorId);assert.equal(call[2].p_operation_id,req.headers.get("idempotency-key"));
 configure({commandError:{code:"42501",message:"Account no longer approved."}});
 assert.equal((await update(request({id:scenario.target.id}))).status,403);
});
Deno.test("sale errors and uncertain commits are surfaced without an unverified browser write", async () => {
 const sell=await handler("mark-sold");configure({commandError:{code:"22023",message:"Closed auction required."}});
 assert.equal((await sell(request({carId:scenario.target.id,role:"dealer"}))).status,409);
 configure({commandError:{code:"network",message:"Timed out"}});
 assert.equal((await sell(request({carId:scenario.target.id,role:"dealer"}))).status,503);
 assert(!scenario.calls.some((c:any)=>Array.isArray(c)&&c[0]==="cars"&&c[1]==="update"));
});
Deno.test("dealer provisioning binds the newly created login and never deletes it after an uncertain commit", async () => {
 const approve=await handler("approve-dealer-application");
 configure({commandError:{code:"network",message:"Timed out"}});
 assert.equal((await approve(request({applicationId:scenario.target.id}))).status,503);
 assert.equal(scenario.createOptions.app_metadata.dealer_application_id,scenario.target.id);
 assert(!scenario.calls.includes("deleteUser"));assert(!scenario.calls.includes("resetPassword"));
});
Deno.test("legacy winner endpoint rejects suspended admins and cannot bypass transactional sale checks", async () => {
 const sell=await handler("push-winner-to-sheet");configure();
 assert.equal((await sell(request({},false))).status,401);
 configure({actor:{id:actorId,role:"admin",status:"suspended"}});
 assert.equal((await sell(request({carId:scenario.target.id,role:"dealer"}))).status,403);
 configure({commandError:{code:"22023",message:"Closed auction with a verified highest bidder required."}});
 assert.equal((await sell(request({carId:scenario.target.id,role:"dealer"}))).status,409);
 const call=scenario.calls.find((c:any)=>Array.isArray(c)&&c[0]==="rpc");
 assert.equal(call[2].p_action,"sale");assert.equal(call[2].p_actor_id,actorId);
 assert(!scenario.calls.some((c:any)=>Array.isArray(c)&&c[0]==="cars"&&c[1]==="update"));
});
