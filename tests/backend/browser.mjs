// Real AuthProvider and buyer screens, isolated database/auth fixtures; no live accounts.
import assert from "node:assert/strict";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
await page.route(
  "**/src/lib/supabaseClient.js*",
  (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `
const user = { id: '00000000-0000-0000-0000-000000000001', email: 'buyer@example.test' };
window.backendFixture = { failOrders: true, failProfile: false, failDelete: true };
export const isSupabaseConfigured = true;
export const supabase = {
 auth: { getSession: async()=>({data:{session:{user}},error:null}), onAuthStateChange: ()=>({data:{subscription:{unsubscribe(){}}}}), signOut: async()=>({error:null}) },
 removeChannel(){}, channel(){const channel={on:()=>channel,subscribe:()=>channel};return channel;},
 from(table){let action='select';const query={select:()=>query,eq:()=>query,order:()=>query,limit:()=>query,maybeSingle:()=>query,abortSignal:()=>query,delete:()=>{action='delete';return query;},then(resolve,reject){
 let data=null,error=null;
 if(table==='profiles'){data={id:user.id,role:'buyer',status:'approved',full_name:'Fixture Buyer'};if(window.backendFixture.failProfile)error={message:'offline'};}
 if(table==='car_purchase_requests'){data=[];if(window.backendFixture.failOrders)error={message:'offline'};}
 if(table==='wishlist'){data=[{id:'saved-one',cars:{id:'car-one',vehicle_title:'Saved Hyundai',base_price_buyer:400000,images:[]}}];if(action==='delete'&&window.backendFixture.failDelete)error={message:'offline'};}
 return Promise.resolve({data,error}).then(resolve,reject);
 }};return query;}
};
`,
    }),
);
try {
  await page.goto("http://127.0.0.1:5173/buyer/orders");
  await page.getByRole("alert").filter({
    hasText: "Could not load your records.",
  }).waitFor();
  assert.equal(
    await page.getByText("No orders yet", { exact: true }).count(),
    0,
  );
  await page.evaluate(() => {
    window.backendFixture.failOrders = false;
  });
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await page.getByText("No orders yet", { exact: true }).waitFor();
  console.log(
    "PASS orders: a backend error is distinct from an empty account; retry recovers",
  );
  await page.goto("http://127.0.0.1:5173/buyer/saved-cars");
  await page.getByText("Saved Hyundai", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "Could not remove" })
    .waitFor();
  assert.equal(
    await page.getByText("Saved Hyundai", { exact: true }).count(),
    1,
  );
  console.log("PASS failed delete keeps the saved car visible");
  await page.evaluate(() => {
    window.backendFixture.failProfile = true;
    window.dispatchEvent(new Event("focus"));
  });
  await page.getByText("Your account access could not be verified.", {
    exact: true,
  }).waitFor();
  await page.evaluate(() => {
    window.backendFixture.failProfile = false;
  });
  await page.getByRole("button", { name: "Retry account check", exact: true })
    .click();
  await page.getByText("Saved Hyundai", { exact: true }).waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "PASS account verification fails closed, then recovers without page reload",
  );
} finally {
  await browser.close();
}
