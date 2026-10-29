// Purchase and dealer auction context must follow the route, never just the role.
// All APIs are fixtures. Optional preview data contains public vehicle fields only.
import assert from "node:assert/strict";
import process from "node:process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const origin = process.env.AUCTION_TEST_ORIGIN || "http://127.0.0.1:5173";
const previewRoot = process.env.PURCHASE_PREVIEW_ROOT;
const me = "00000000-0000-0000-0000-000000000001";
const base = { status: "live", access_type: "all", listing_type: "buy_now_only", year: 2019, location: "Delhi", registration_state: "Delhi", ownership: "1st", mileage_km: 120000, fuel_types: { name: "Diesel" }, transmissions: { name: "Manual" }, buy_now_price: 450000, base_price_buyer: 450000, base_price_dealer: 1, current_bid_dealer: 99999999, images: [], is_verified: true };
let cars = previewRoot ? JSON.parse(await readFile(previewRoot + "/public-car-reference.json", "utf8")) : [
  { ...base, id: "11111111-1111-1111-1111-111111111111", vehicle_title: "Purchase fixture car" },
  { ...base, id: "22222222-2222-2222-2222-222222222222", vehicle_title: "Second purchase fixture", buy_now_price: 700000 },
];
cars = cars.map((car, i) => ({ ...car, vehicle_title: car.vehicle_title.trim(), base_price_dealer: 1, current_bid_dealer: 99999999, thumbnail_url: origin + `/fixture-purchase/car-${i + 1}-1.jpg`, images: previewRoot ? (car.images || []).map((_, j) => origin + `/fixture-purchase/car-${i + 1}-${j + 1}.jpg`) : [], created_at: "2026-10-28T00:00:00Z" }));
const auction = { ...base, id: "33333333-3333-3333-3333-333333333333", vehicle_title: "Dealer auction fixture", listing_type: "auction", buy_now_price: null, base_price_dealer: 400000, current_bid_dealer: 400000, minimum_increment: 5000, auction_end: new Date(Date.now() + 3600000).toISOString(), is_live: true, images: [], thumbnail_url: null };
let role = "dealer", dealerStatus = "approved", snapshots = 0, writes = 0;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
const errors = [], captures = {};
await page.routeWebSocket(/.*/, (socket) => socket.close());
page.on("pageerror", (error) => errors.push(error.message));
await page.addInitScript(() => sessionStorage.setItem("auctionhub_signup_popup_shown", "1"));
await page.route("**/src/auth/AuthContext.jsx*", (route) => route.fulfill({ contentType: "application/javascript", body: `const user=${role === "guest" ? "null" : `{id:'${me}',email:'preview@example.test'}`};const auth={user,session:user?{user}:null,profile:{full_name:'Preview account'},role:'${role}',dealerStatus:'${dealerStatus}',loading:false};export const useAuth=()=>auth;export const AuthProvider=({children})=>children;export const AuthRecovery=()=>null;` }));
await page.route("**/fixture-purchase/**", async (route) => {
  const name = new URL(route.request().url()).pathname.split("/").pop();
  const data = await readFile(previewRoot ? previewRoot + "/assets/" + name : new URL("../src/assets/car.jpg", import.meta.url));
  await route.fulfill({ body: data, contentType: "image/jpeg" });
});
await page.route("**/rest/v1/**", (route) => {
  const url = new URL(route.request().url()), endpoint = url.pathname.split("/").pop();
  if (route.request().method() !== "GET" && !["dealer_auction_snapshot", "get_dealer_auction_dashboard"].includes(endpoint)) { writes++; return route.fulfill({ status: 400, json: { message: "Unexpected write during preview" } }); }
  if (endpoint === "dealer_auction_snapshot") { snapshots++; return route.fulfill({ json: { car: auction, my_bid: null, my_bid_count: 0, recent_bids: [], server_time: new Date().toISOString() } }); }
  if (endpoint === "get_dealer_auction_dashboard") return route.fulfill({ json: { summary: { live: 1, bids: 0, watchlist: 0, results: 0 }, total: 1, server_time: new Date().toISOString(), items: [{ ...auction, my_bid_count: 0 }] } });
  if (endpoint === "cars_catalog") {
    let rows = [...cars, auction];
    for (const field of ["id", "listing_type", "access_type", "status"]) {
      const filter = url.searchParams.get(field);
      if (filter?.startsWith("eq.")) rows = rows.filter((car) => String(car[field]) === filter.slice(3));
      if (filter?.startsWith("neq.")) rows = rows.filter((car) => String(car[field]) !== filter.slice(4));
    }
    if (url.searchParams.get("id")?.startsWith("eq.")) return route.fulfill({ json: rows[0] || null });
    return route.fulfill({ json: rows, headers: { "content-range": `0-${Math.max(0, rows.length - 1)}/${rows.length}` } });
  }
  if (endpoint === "wishlist") return route.fulfill({ json: null });
  return route.fulfill({ json: [] });
});
const money = (value) => "₹" + Number(value).toLocaleString("en-IN");
const noAuction = async () => {
  assert.equal(await page.locator("#dealer-bidding,.dealer-detail-navbar,.dealer-desktop-bid-dock").count(), 0);
  assert.equal(await page.locator('a[href^="/dealer/auctions/"]').count(), 0);
  assert(!/auction|bidding|highest bid|starting bid|countdown/i.test(await page.locator("body").innerText()));
  assert.equal(snapshots, 0, "purchase routes never read bidding snapshots");
};
async function capture(name) {
  if (!previewRoot) return;
  await mkdir(previewRoot, { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: previewRoot + "/" + name + ".png", fullPage: true, animations: "disabled" });
  if (name.endsWith("mobile")) await page.screenshot({ path: previewRoot + "/" + name + "-first-screen.png", animations: "disabled" });
  captures[name] = await page.evaluate(async () => {
    const clone = document.querySelector("#root").cloneNode(true);
    const originals = [...document.querySelectorAll("#root select")];
    [...clone.querySelectorAll("select")].forEach((select, index) => {
      [...select.options].forEach((option, optionIndex) => option.toggleAttribute("selected", optionIndex === originals[index].selectedIndex));
    });
    const images = [...clone.querySelectorAll("img")];
    await Promise.all(images.map(async (image) => {
      const response = await fetch(image.src), bytes = await response.arrayBuffer();
      const data = await new Promise((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(new Blob([bytes], { type: response.headers.get("content-type") || "image/jpeg" })); });
      image.src = data;
    }));
    const styles = [...document.styleSheets].map((sheet) => { try { return [...sheet.cssRules].map((rule) => rule.cssText).join("\n"); } catch { return ""; } }).join("\n");
    return { body: clone.innerHTML, styles };
  });
}
try {
  await page.goto(origin + "/buy-car");
  await page.getByRole("heading", { name: cars[0].vehicle_title, exact: true }).waitFor();
  await noAuction();
  await capture("buy-car-desktop");
  await page.getByRole("link", { name: "View Details", exact: true }).first().click();
  await page.getByRole("heading", { name: cars[0].vehicle_title, exact: true }).waitFor();
  await noAuction();
  await page.getByText("Available for purchase", { exact: true }).waitFor();
  assert.equal(await page.getByRole("link", { name: "Call to enquire", exact: true }).first().getAttribute("href"), "tel:+917836008277");
  assert.equal(await page.getByText("LIVE", { exact: true }).count(), 0);
  await page.getByText(money(cars[0].buy_now_price), { exact: true }).first().waitFor();
  await capture("purchase-detail-desktop");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 0));
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await capture("purchase-detail-mobile");
  await page.goto(origin + "/buy-car");
  await page.getByRole("heading", { name: cars[0].vehicle_title, exact: true }).waitFor();
  await noAuction();
  await capture("buy-car-mobile");
  await page.goto(origin + "/cars/" + auction.id);
  await page.getByRole("link", { name: "Browse available cars", exact: true }).waitFor();
  await noAuction();
  console.log("PASS approved dealer Buy Car list/detail stay purchase-only, fixed prices ignore dealer bids, enquiry links work, mobile fits, zero bidding reads/writes.");

  role = "buyer";
  await page.goto(origin + "/cars/" + cars[0].id);
  await page.getByRole("button", { name: "Buy Now — " + money(cars[0].buy_now_price), exact: true }).first().click();
  await page.getByPlaceholder("Your phone number", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Confirm — " + money(cars[0].buy_now_price), exact: true }).waitFor();
  await noAuction();
  role = "guest";
  await page.goto(origin + "/cars/" + cars[0].id);
  await page.getByRole("link", { name: "Log In to Buy", exact: true }).first().waitFor();
  await noAuction();
  await page.goto(origin + "/dealer/auctions/" + auction.id);
  await page.waitForURL("**/dealer-login");
  role = "buyer";
  await page.goto(origin + "/dealer/auctions/" + auction.id);
  await page.waitForURL("**/unauthorized");
  assert.equal(snapshots, 0);
  console.log("PASS buyer purchase form and guest login action; guest/buyer access to dealer auction is blocked.");

  role = "dealer";
  await page.goto(origin + "/services");
  const entry = page.locator('a[href="/live-auctions"]').first();
  await entry.click();
  await page.getByRole("heading", { name: "Your auction desk", exact: true }).waitFor();
  const openAuction = page.getByRole("link", { name: "Open auction: " + auction.vehicle_title, exact: true });
  assert.equal(await openAuction.getAttribute("href"), "/dealer/auctions/" + auction.id);
  await openAuction.click();
  await page.locator("#dealer-bidding").getByText(/Verified \d+s ago/).waitFor();
  assert(snapshots > 0);
  assert.equal(await page.locator(".dealer-detail-navbar").count(), 1);
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await capture("dealer-service-auction");
  assert.equal(writes, 0);
  assert.deepEqual(errors, []);
  if (previewRoot) await writeFile(previewRoot + "/page-captures.json", JSON.stringify(captures));
  console.log("PASS Services → Live Auctions → dealer desk → dedicated auction detail; no production requests or page errors.");
} finally { await browser.close(); }
