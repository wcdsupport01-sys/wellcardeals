// Real dealer components with synthetic auth/API fixtures. No production writes.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import process from "node:process";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const origin = process.env.AUCTION_TEST_ORIGIN || "http://127.0.0.1:5173";
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const me = "00000000-0000-0000-0000-000000000001";
const items = [
  { id: "11111111-1111-1111-1111-111111111111", vehicle_title: "BMW X3", location: "Delhi", mileage_km: 28000, year: 2021, current_bid_dealer: 1845000, last_bid: { amount: 1835000 }, watchlisted: false },
  { id: "22222222-2222-2222-2222-222222222222", vehicle_title: "Hyundai Creta", location: "Noida", mileage_km: 35000, year: 2022, current_bid_dealer: 1210000, last_bid: null, watchlisted: true },
  { id: "33333333-3333-3333-3333-333333333333", vehicle_title: "Honda City", location: "Gurugram", mileage_km: 42000, year: 2020, current_bid_dealer: 850000, last_bid: null, watchlisted: false },
  { id: "44444444-4444-4444-4444-444444444444", vehicle_title: "Tata Nexon", location: "Delhi", year: 2021, current_bid_dealer: 750000, last_bid: { amount: 750000 }, watchlisted: false, closed: true },
].map((car) => ({
  ...car,
  status: car.closed ? "closed" : "live",
  listing_type: "auction",
  is_live: !car.closed,
  minimum_increment: 5000,
  my_bid_count: car.last_bid ? 3 : 0,
  auction_end: new Date(Date.now() + (car.closed ? -3600000 : 3600000)).toISOString(),
  images: car.vehicle_title === "BMW X3" ? ["https://dealer-fixture.invalid/car.png"] : car.vehicle_title === "Honda City" ? ["https://dealer-fixture.invalid/broken.png"] : [],
}));
const errors = [], searches = [], realBidRequests = [];
page.on("pageerror", (error) => errors.push(error.message));
await page.route("**/src/auth/AuthContext.jsx*", (route) => route.fulfill({
  contentType: "application/javascript",
  body: `const auth={user:{id:'${me}'},session:{id:'${me}'},profile:{business_name:'Delhi Motors',status:'approved'},role:'dealer',dealerStatus:'approved',loading:false,signOut:async()=>{}}; export const useAuth=()=>auth; export const AuthProvider=({children})=>children; export const AuthRecovery=()=>null;`,
}));
const photo = await readFile("src/assets/car.png");
await page.route("https://dealer-fixture.invalid/car.png", (route) => route.fulfill({ contentType: "image/png", body: photo }));
await page.route("https://dealer-fixture.invalid/broken.png", (route) => route.fulfill({ status: 404, body: "Missing fixture photo" }));
await page.route("**/rest/v1/**", async (route) => {
  const url = new URL(route.request().url());
  const endpoint = url.pathname.split("/").pop();
  const args = route.request().postDataJSON() || {};
  if (endpoint === "place_dealer_bid_v2") realBidRequests.push(args);
  if (endpoint === "get_dealer_auction_dashboard") {
    const tab = args.p_tab;
    searches.push(args.p_search);
    const filtered = items.filter((car) => {
      const inTab = tab === "live" ? car.is_live : tab === "bids" ? car.last_bid : tab === "watchlist" ? car.watchlisted : !car.is_live && car.last_bid;
      return inTab && `${car.vehicle_title} ${car.location}`.toLowerCase().includes(args.p_search.toLowerCase());
    });
    return route.fulfill({ json: {
      server_time: new Date().toISOString(),
      summary: { live: 3, bids: 2, watchlist: items.filter((car) => car.watchlisted).length, results: 1 },
      total: filtered.length,
      items: filtered.slice(args.p_offset, args.p_offset + args.p_limit),
    } });
  }
  if (endpoint === "wishlist" && route.request().method() !== "GET") {
    if (route.request().method() === "DELETE") {
      const id = url.searchParams.get("car_id")?.replace("eq.", "");
      items.find((car) => car.id === id).watchlisted = false;
    } else {
      items.find((car) => car.id === args.car_id).watchlisted = true;
    }
    return route.fulfill({ json: null });
  }
  return route.fulfill({ json: [] });
});

try {
  await page.goto(origin + "/dealer/dashboard");
  await page.getByRole("heading", { name: "Your auction desk", exact: true }).waitFor();
  await page.getByRole("button", { name: "Live auctions 3", exact: true }).waitFor();
  assert.equal(await page.locator(".dealer-auction-card").count(), 3);
  await page.waitForFunction(() => document.querySelectorAll(".dealer-photo-placeholder").length === 2);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: "/tmp/dealer-workspace-desktop.png", fullPage: true, animations: "disabled" });
  await page.getByRole("button", { name: "List view", exact: true }).click();
  assert.equal(await page.getByRole("button", { name: "List view", exact: true }).getAttribute("aria-pressed"), "true");
  assert(await page.locator(".dealer-auction-grid").evaluate((element) => element.classList.contains("is-list")));
  await page.getByRole("button", { name: "Grid view", exact: true }).click();
  await page.getByLabel("Search auctions").fill("Honda");
  await page.getByRole("heading", { name: "Honda City", exact: true }).waitFor();
  await page.waitForFunction(() => document.querySelectorAll(".dealer-auction-card").length === 1);
  assert(searches.includes("Honda"));
  await page.getByRole("button", { name: "Clear search", exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll(".dealer-auction-card").length === 3);
  await page.locator(".dealer-location summary").click();
  assert(await page.locator(".dealer-location").evaluate((element) => element.open));
  await page.getByRole("heading", { name: "Your auction desk", exact: true }).click();
  assert.equal(await page.locator(".dealer-location").evaluate((element) => element.open), false);
  await page.locator(".dealer-location summary").click();
  await page.getByLabel("Search a city or location").fill("Delhi");
  await page.getByRole("button", { name: "Find auctions", exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll(".dealer-auction-card").length === 1);
  assert(searches.includes("Delhi"));
  assert.equal(await page.getByLabel("Search auctions").inputValue(), "Delhi");
  await page.getByRole("button", { name: "Clear search", exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll(".dealer-auction-card").length === 3);
  console.log("PASS desktop layout, grid/list, debounced server search and location search across inventory.");

  await page.getByRole("button", { name: "Add to watchlist: BMW X3", exact: true }).click();
  await page.getByRole("button", { name: "Remove from watchlist: BMW X3", exact: true }).waitFor();
  await page.getByRole("tab", { name: "Watchlist 2", exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll(".dealer-auction-card").length === 2);
  await page.getByRole("tab", { name: "Results 1", exact: true }).click();
  await page.getByRole("heading", { name: "Tata Nexon", exact: true }).waitFor();
  assert.equal(await page.getByRole("link", { name: "View & bid", exact: true }).count(), 0);
  await page.getByRole("tab", { name: "Live auctions 3", exact: true }).click();
  await page.getByRole("heading", { name: "BMW X3", exact: true }).waitFor();
  console.log("PASS real watchlist updates, tab counts and closed-auction action labels.");

  const helpButton = page.locator("main").getByRole("button", { name: "How bidding works", exact: true });
  await helpButton.click();
  await page.getByRole("dialog", { name: "A clearer way to your next deal.", exact: true }).waitFor();
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("dialog").count(), 0);
  assert(await helpButton.evaluate((button) => button === document.activeElement));
  for (const width of [768, 390]) {
    await page.setViewportSize({ width, height: 844 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  }
  await page.screenshot({ path: "/tmp/dealer-workspace-mobile.png", fullPage: true, animations: "disabled" });
  const openMenu = page.getByRole("button", { name: "Open navigation", exact: true });
  await openMenu.click();
  const navigation = page.getByRole("dialog", { name: "Dealer navigation", exact: true });
  await navigation.waitFor();
  await page.keyboard.press("Shift+Tab");
  assert(await navigation.getByRole("button", { name: "Log out", exact: true }).evaluate((button) => button === document.activeElement));
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("dialog", { name: "Dealer navigation", exact: true }).count(), 0);
  assert(await openMenu.evaluate((button) => button === document.activeElement));
  await page.setViewportSize({ width: 844, height: 390 });
  await openMenu.click();
  await navigation.getByRole("button", { name: "Log out", exact: true }).scrollIntoViewIfNeeded();
  assert(await navigation.getByRole("button", { name: "Log out", exact: true }).evaluate((button) => {
    const rect = button.getBoundingClientRect();
    return rect.top >= 0 && rect.bottom <= innerHeight;
  }));
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 390, height: 844 });
  await openMenu.click();
  await navigation.getByRole("link", { name: "My bids", exact: true }).click();
  await page.waitForURL("**/dealer/dashboard?tab=bids");
  assert.equal(await page.getByRole("dialog", { name: "Dealer navigation", exact: true }).count(), 0);
  assert.deepEqual(errors, []);
  assert.deepEqual(realBidRequests, []);
  console.log("PASS guide dialog focus, tablet/mobile width, mobile focus trap/Escape, sidebar routing; no bid submissions.");
} finally {
  await browser.close();
}
