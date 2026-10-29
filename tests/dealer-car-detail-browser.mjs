// Isolated visual/interaction fixtures. All API requests are intercepted;
// browsing or reviewing the design must never submit a real bid.
import assert from "node:assert/strict";
import process from "node:process";
import { readFile } from "node:fs/promises";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium", args: ["--no-sandbox"] });
const origin = process.env.AUCTION_TEST_ORIGIN || "http://127.0.0.1:5173";
const id = "11111111-1111-1111-1111-111111111111";
const me = "00000000-0000-0000-0000-000000000001";
const image = await readFile(new URL("../src/assets/car.jpg", import.meta.url));
let role = "dealer", submits = 0, signings = 0;
let car = {
  id, vehicle_title: "BMW 320d Sport", variant: "2.0 diesel · Automatic", year: 2021,
  location: "New Delhi", registration_state: "DL", ownership: "1st", mileage_km: 42000, access_type: "all",
  fuel_type_id: "diesel-id", transmission_id: "automatic-id", status: "live", listing_type: "auction",
  auction_end: new Date(Date.now() + 3600000).toISOString(), current_bid_dealer: 1800000,
  current_bid_buyer: 1900000, base_price_dealer: 1700000, base_price_buyer: 1850000,
  minimum_increment: 5000, reserve_price: 1600000, is_verified: true,
  thumbnail_url: origin + "/fixture-photo/front.jpg",
  images: [origin + "/fixture-photo/front.jpg", origin + "/fixture-photo/rear.jpg", origin + "/fixture-photo/interior.jpg"],
  inspected_at: new Date().toISOString(), inspection_notes: "Review the paint notes before bidding.",
  inspection: { engine_transmission: { status: "good", note: "Engine checked." }, body_paint: { status: "fair", note: "Rear bumper has a scratch." }, interior: { status: "poor", note: "Seat repair required." } },
  safety_features: ["ABS", "Airbags"], comfort_features: ["Climate control"],
  documents: [
    { name: "Public RC", url: "https://documents.example.test/rc.pdf" },
    { name: "Restricted RC", url: "storage://dealer-docs/someone-else/rc.pdf" },
    { name: "Allowed insurance", url: "storage://dealer-docs/allowed/insurance.pdf" },
    { name: "Invalid document", url: "javascript:alert(1)" },
  ],
  description: "Vehicle details and inspection records supplied with this listing.",
};
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
await page.route("**/src/auth/AuthContext.jsx*", (route) => route.fulfill({
  contentType: "application/javascript",
  body: `const auth={user:{id:'${me}'},session:{id:'${me}'},profile:{full_name:'Demo Dealer'},role:'${role}',dealerStatus:'approved',loading:false}; export const useAuth=()=>auth; export const AuthProvider=({children})=>children; export const AuthRecovery=()=>null;`,
}));
await page.route("**/fixture-photo/**", (route) => route.fulfill({ body: image, contentType: "image/jpeg" }));
await page.route("**/storage/v1/object/sign/**", (route) => {
  signings++;
  return route.request().url().includes("/allowed/")
    ? route.fulfill({ json: { signedURL: "/object/sign/dealer-docs/allowed/insurance.pdf?token=fixture" } })
    : route.fulfill({ status: 403, json: { message: "Not permitted by policy" } });
});
await page.route("**/rest/v1/**", (route) => {
  const url = new URL(route.request().url()), endpoint = url.pathname.split("/").pop();
  if (endpoint === "place_dealer_bid_v2") { submits++; return route.fulfill({ status: 500, json: { message: "Unexpected submission" } }); }
  if (endpoint === "dealer_auction_snapshot") return route.fulfill({ json: { car, my_bid: null, my_bid_count: 0, recent_bids: [], server_time: new Date().toISOString() } });
  if (endpoint === "cars_catalog") return route.fulfill({ json: url.searchParams.get("id")?.startsWith("eq.") ? car : [] });
  if (endpoint === "fuel_types") return route.fulfill({ json: { name: "Diesel" } });
  if (endpoint === "transmissions") return route.fulfill({ json: { name: "Automatic" } });
  if (endpoint === "wishlist") return route.fulfill({ json: null });
  return route.fulfill({ json: [] });
});
const open = async (purchase = false) => { await page.goto(origin + (purchase ? "/cars/" : "/dealer/auctions/") + id); await page.getByRole("heading", { name: car.vehicle_title, exact: true }).waitFor(); };
const fits = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
try {
  await open();
  await page.getByRole("region", { name: "Vehicle highlights" }).getByText("Diesel", { exact: true }).waitFor();
  await page.getByRole("region", { name: "Vehicle highlights" }).getByText("Automatic", { exact: true }).waitFor();
  await page.locator("#dealer-bidding").getByText(/Verified \d+s ago/).waitFor();
  const gallery = await page.locator(".dealer-detail-gallery").boundingBox();
  const bid = await page.locator("#dealer-bidding").boundingBox();
  assert(bid.x > gallery.x + gallery.width && Math.abs(bid.y - gallery.y) < 3);
  const information = await page.locator(".dealer-detail-information").boundingBox();
  assert(information.width > gallery.width + bid.width, "details use the full page width");
  assert((await page.getByRole("tab").evaluateAll((tabs) => tabs.map((tab) => getComputedStyle(tab).fontWeight))).every((weight) => weight === "800"));
  assert.equal(await page.getByRole("link", { name: "My bids", exact: true }).getAttribute("href"), "/dealer/dashboard?tab=bids");
  assert.equal(await page.getByRole("link", { name: "Watchlist", exact: true }).first().getAttribute("href"), "/dealer/dashboard?tab=watchlist");
  assert.equal(await page.locator(".dealer-detail-main-photo:visible").count(), 1);
  assert.equal(await page.locator(".dealer-detail-thumbnails button").count(), 3, "thumbnail duplicates are removed");
  assert(await fits());
  await page.screenshot({ path: "/tmp/dealer-car-detail-desktop.png", fullPage: true });
  await page.getByRole("button", { name: "Next vehicle photo", exact: true }).click();
  await page.getByText("Photo 2 of 3", { exact: true }).waitFor();
  await page.getByRole("button", { name: "View full-size vehicle photo" }).click();
  await page.getByRole("dialog", { name: "Full-size vehicle photo" }).waitFor();
  await page.keyboard.press("ArrowRight");
  await page.getByRole("dialog").getByText("3 / 3", { exact: true }).waitFor();
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("dialog").count(), 0);
  assert.equal(await page.getByRole("button", { name: "View full-size vehicle photo" }).evaluate((el) => el === document.activeElement), true);
  console.log("PASS single gallery, deduplicated thumbnails, real fuel/transmission labels and fullscreen keyboard/focus.");

  await page.locator(".dealer-quick-bids").getByRole("button", { name: "₹18,05,000", exact: true }).click();
  assert.equal(await page.getByLabel("Your bid amount (₹)").inputValue(), "1805000");
  assert.equal(await page.getByRole("dialog").count(), 0, "quick amount selection does not confirm a bid");
  await page.getByRole("button", { name: "Increase bid by minimum increment", exact: true }).click();
  assert.equal(await page.getByLabel("Your bid amount (₹)").inputValue(), "1810000");
  await page.getByRole("tab", { name: /^Inspection/ }).click();
  await page.getByText("Rear bumper has a scratch.", { exact: true }).waitFor();
  await page.getByText("Poor · review notes", { exact: true }).waitFor();
  assert.equal(await page.getByText("Not checked", { exact: true }).count(), 2);
  await page.screenshot({ path: "/tmp/dealer-car-detail-inspection.png", fullPage: true });
  await page.getByRole("tab", { name: "Features", exact: true }).click();
  await page.getByText("Climate control", { exact: true }).waitFor();
  assert.equal(signings, 0, "private documents are signed only when opened");
  await page.getByRole("tab", { name: "Documents", exact: true }).click();
  await page.getByRole("link", { name: "Open Allowed insurance", exact: true }).waitFor();
  await page.getByRole("alert").filter({ hasText: "Unable to open this document" }).waitFor();
  assert.equal(await page.getByRole("link", { name: "Open Restricted RC", exact: true }).count(), 0);
  assert.equal(await page.getByRole("link", { name: "Open Invalid document", exact: true }).count(), 0);
  assert.equal(await page.getByRole("link", { name: "Open Public RC", exact: true }).getAttribute("href"), "https://documents.example.test/rc.pdf");
  assert((await page.getByRole("link", { name: "Open Allowed insurance", exact: true }).getAttribute("href")).includes("token=fixture"));
  assert.equal(await page.getByLabel("Your bid amount (₹)").inputValue(), "1810000");
  console.log("PASS real inspection states/notes, preserved bid input across tabs, safe document links and denied private access.");

  await page.locator("#dealer-bidding [data-main-review]").click();
  const review = page.getByRole("dialog", { name: "Review your bid" });
  await review.waitFor();
  assert(await review.evaluate((el) => el.parentElement === document.body));
  assert(await review.evaluate((el) => el.contains(document.elementFromPoint(20, 20))));
  await page.screenshot({ path: "/tmp/dealer-car-detail-review.png" });
  await page.keyboard.press("Escape");
  assert.equal(submits, 0);
  await page.setViewportSize({ width: 1440, height: 600 });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const dock = page.locator(".dealer-desktop-bid-dock");
  await dock.waitFor();
  await dock.getByRole("button", { name: "Review bid", exact: true }).click();
  await review.waitFor();
  await review.getByText("₹18,10,000", { exact: true }).waitFor();
  await page.keyboard.press("Escape");
  await page.context().setOffline(true);
  await page.getByText("Offline. Bidding paused.", { exact: true }).waitFor();
  assert(await dock.getByRole("button", { name: "Review bid", exact: true }).isDisabled());
  await page.context().setOffline(false);
  await page.locator("#dealer-bidding").getByText(/Verified \d+s ago/).waitFor();
  assert.equal(submits, 0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 0));
  assert(await fits());
  assert(await page.locator(".dealer-mobile-bid-bar").isVisible());
  await page.getByRole("button", { name: "Open menu", exact: true }).click();
  await page.getByRole("link", { name: "My bids", exact: true }).waitFor();
  await page.getByRole("button", { name: "Close menu", exact: true }).click();
  assert.equal(await page.getByRole("link", { name: "My bids", exact: true }).count(), 0);
  const mobileGallery = await page.locator(".dealer-detail-gallery").boundingBox();
  const mobileBid = await page.locator("#dealer-bidding").boundingBox();
  assert(mobileBid.y > mobileGallery.y + mobileGallery.height);
  await page.screenshot({ path: "/tmp/dealer-car-detail-mobile.png", fullPage: true });
  await page.screenshot({ path: "/tmp/dealer-car-detail-mobile-first-screen.png" });
  await page.locator(".dealer-mobile-bid-bar").getByRole("button", { name: "Review bid", exact: true }).click();
  await review.waitFor();
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 768, height: 1024 });
  assert(await fits());
  assert(await page.locator(".dealer-mobile-bid-bar").isVisible());
  console.log("PASS desktop review covers navigation, mobile/tablet layout and fixed review action; no bids submitted.");

  car = { ...car, images: [], thumbnail_url: null, inspection: {}, inspected_at: null, fuel_type_id: null, transmission_id: null };
  await open();
  await page.getByText("No vehicle photo available", { exact: true }).waitFor();
  await page.getByRole("tab", { name: "Inspection", exact: true }).click();
  await page.getByText("Inspection report not available for this listing yet.", { exact: true }).waitFor();
  assert.equal(await page.getByRole("region", { name: "Vehicle highlights" }).getByText("Not specified", { exact: true }).count(), 2);
  car = { ...car, listing_type: "buy_now_only", buy_now_price: 2000000 };
  await open(true);
  assert.equal(await page.locator(".dealer-detail-page").count(), 0);
  assert.equal(await page.locator("#dealer-bidding").count(), 0);
  await page.getByText("EMI Calculator", { exact: true }).waitFor();
  role = "buyer";
  await open(true);
  assert.equal(await page.locator(".dealer-detail-page").count(), 0);
  assert.equal(await page.locator("#dealer-bidding").count(), 0);
  assert.equal(await page.locator(".dealer-detail-navbar").count(), 0);
  assert.equal(submits, 0);
  assert.deepEqual(errors, []);
  console.log("PASS honest missing-data states, dealer fixed-price and buyer layouts preserved; no page errors.");
} finally { await browser.close(); }
