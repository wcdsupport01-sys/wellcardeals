// UI contract tests with isolated auth/API fixtures; never submits real bids.
// Run with Vite on :5173 and PLAYWRIGHT_MODULE pointing at installed Playwright.
import assert from "node:assert/strict";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const origin = process.env.AUCTION_TEST_ORIGIN || "http://127.0.0.1:5173";
const me = "00000000-0000-0000-0000-000000000001";
const id = "11111111-1111-1111-1111-111111111111";
let car = {
  id,
  vehicle_title: "Hyundai Creta SX",
  year: 2021,
  location: "Delhi",
  status: "live",
  listing_type: "auction",
  auction_end: new Date(Date.now() + 3600000).toISOString(),
  base_price_dealer: 400000,
  current_bid_dealer: 400000,
  minimum_increment: 5000,
  reserve_price: 350000,
  images: [],
};
let myBid = null,
  receipt = null,
  submits = 0,
  loseResponse = false,
  failSnapshot = false,
  watchlisted = false;
const seenRequests = [];
const savedBids = [];
const errors = [];
page.on("pageerror", (failure) => errors.push(failure.message));
await page.route("**/src/auth/AuthContext.jsx*", (route) =>
  route.fulfill({
    contentType: "application/javascript",
    body: `const auth={user:{id:'${me}'},session:{id:'${me}'},profile:{business_name:'Delhi Motors'},role:'dealer',dealerStatus:'approved',loading:false}; export const useAuth=()=>auth; export const AuthProvider=({children})=>children; export const AuthRecovery=()=>null;`,
  }),
);
await page.route("**/rest/v1/**", async (route) => {
  const url = new URL(route.request().url());
  const endpoint = url.pathname.split("/").pop();
  const args = route.request().postDataJSON() || {};
  if (endpoint === "dealer_auction_snapshot") {
    if (failSnapshot)
      return route.fulfill({
        status: 503,
        json: { message: "Connection unavailable" },
      });
    return route.fulfill({
      json: {
        car,
        my_bid: myBid,
        my_bid_count: savedBids.length,
        recent_bids: savedBids.slice(-5).reverse(),
        server_time: new Date().toISOString(),
      },
    });
  }
  if (endpoint === "dealer_bid_receipt")
    return route.fulfill({
      json: receipt?.request_id === args.p_request_id ? receipt : null,
    });
  if (endpoint === "place_dealer_bid_v2") {
    submits++;
    seenRequests.push(args.p_request_id);
    car = {
      ...car,
      current_bid_dealer: args.p_amount,
      highest_bidder_id_dealer: me,
    };
    myBid = {
      id: String(80 + submits),
      amount: args.p_amount,
      created_at: new Date().toISOString(),
    };
    savedBids.push(myBid);
    receipt = {
      bid_id: String(80 + submits),
      request_id: args.p_request_id,
      amount: args.p_amount,
      accepted_at: myBid.created_at,
      car,
      server_time: myBid.created_at,
    };
    if (loseResponse) {
      loseResponse = false;
      return route.abort("failed");
    }
    return route.fulfill({ json: receipt });
  }
  if (endpoint === "get_dealer_auction_dashboard")
    return route.fulfill({
      json: {
        summary: {
          live: 32,
          bids: 27,
          watchlist: watchlisted ? 1 : 0,
          results: 6,
        },
        total: 1,
        server_time: new Date().toISOString(),
        items:
          args.p_tab === "watchlist" && !watchlisted
            ? []
            : [
                {
                  ...car,
                  last_bid: myBid,
                  my_bid_count: 12,
                  watchlisted,
                  is_live: true,
                },
              ],
      },
    });
  if (endpoint === "cars" || endpoint === "cars_catalog")
    return route.fulfill({
      json: url.searchParams.get("id")?.startsWith("eq.") ? car : [],
    });
  if (endpoint === "car_bids")
    return route.fulfill({ json: myBid ? [myBid] : [] });
  if (endpoint === "wishlist") {
    if (route.request().method() !== "GET")
      watchlisted = route.request().method() !== "DELETE";
    return route.fulfill({ json: null });
  }
  return route.fulfill({ json: [] });
});
try {
  await page.goto(origin + "/dealer/dashboard");
  await page.getByRole("heading", { name: "Your auction desk" }).waitFor();
  await page.getByRole("button", { name: "My bids 27", exact: true }).waitFor();
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page
    .getByRole("button", { name: "Add to watchlist: Hyundai Creta SX" })
    .click();
  await page
    .getByRole("button", { name: "Remove from watchlist: Hyundai Creta SX" })
    .waitFor();
  await page.getByRole("tab", { name: /^Watchlist\b/ }).click();
  await page
    .getByRole("heading", { name: "Hyundai Creta SX", exact: true })
    .waitFor();
  await page.screenshot({
    path: "/tmp/dealer-auction-desk-mobile.png",
    fullPage: true,
  });
  console.log(
    "PASS dashboard totals beyond 8 bids, tabs, watchlist and mobile width",
  );

  await page.goto(origin + "/dealer/auctions/" + id);
  const panel = page.locator("#dealer-bidding");
  await panel.getByText(/Verified \d+s ago/).waitFor();
  await panel.getByLabel("Your bid amount (₹)").fill("400001");
  await panel
    .getByRole("button", { name: "Review bid ₹4,00,001", exact: true })
    .click();
  await panel.getByRole("alert").filter({ hasText: "at least" }).waitFor();
  assert.equal(submits, 0);
  await panel.getByLabel("Your bid amount (₹)").fill("405000");
  await panel
    .getByRole("button", { name: "Review bid ₹4,05,000", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm bid", exact: true })
    .click();
  await panel.getByText("Bid saved: ₹4,05,000", { exact: true }).waitFor();
  await panel.getByText("You are leading", { exact: true }).waitFor();
  assert.equal(submits, 1);
  assert.equal(await page.locator("[role=dialog]").count(), 0);
  console.log(
    "PASS minimum validation, review step, verified receipt, leading status",
  );

  // Response is lost AFTER the fixture server saves. Refresh the browser and
  // recover the receipt, rather than sending another amount/request ID.
  loseResponse = true;
  await panel.getByLabel("Your bid amount (₹)").fill("410000");
  await panel
    .getByRole("button", { name: "Review bid ₹4,10,000", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm bid", exact: true })
    .click();
  await panel.getByText(/Unconfirmed request/).waitFor();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Check / retry same bid", exact: true })
    .waitFor();
  assert.equal(submits, 2);
  await page.reload();
  await panel
    .getByRole("button", { name: "Check / retry same bid", exact: true })
    .click();
  await panel.getByText("Bid saved: ₹4,10,000", { exact: true }).waitFor();
  assert.equal(submits, 2);
  assert.equal(new Set(seenRequests).size, 2);
  await panel
    .getByRole("heading", {
      name: "Your bid history · 2 saved bids",
      exact: true,
    })
    .waitFor();
  console.log(
    "PASS lost-response recovery survives reload without duplicate submission",
  );

  car = {
    ...car,
    current_bid_dealer: 420000,
    highest_bidder_id_dealer: "another-dealer",
  };
  await panel.getByRole("button", { name: "Refresh", exact: true }).click();
  await panel.getByText("You have been outbid", { exact: true }).waitFor();
  await panel.getByLabel("Your bid amount (₹)").fill("425000");
  await panel
    .getByRole("button", { name: "Review bid ₹4,25,000", exact: true })
    .click();
  car = { ...car, current_bid_dealer: 430000 };
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await page
    .getByRole("dialog")
    .getByText("Auction status changed.", { exact: false })
    .waitFor();
  assert(
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Confirm bid", exact: true })
      .isDisabled(),
  );
  await page.keyboard.press("Escape");
  await panel.getByLabel("Your bid amount (₹)").fill("");
  await page.screenshot({
    path: "/tmp/dealer-bidding-mobile.png",
    fullPage: true,
  });
  failSnapshot = true;
  await panel.getByRole("button", { name: "Refresh", exact: true }).click();
  await panel.getByText("Connection unavailable", { exact: false }).waitFor();
  assert(
    await panel
      .getByRole("button", { name: "Review bid ₹4,35,000", exact: true })
      .isDisabled(),
  );
  failSnapshot = false;
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  // Browser-level offline state affects navigator.onLine as well.
  await page.context().setOffline(true);
  await panel.getByText("Offline. Bidding paused.", { exact: true }).waitFor();
  await page.context().setOffline(false);
  await panel.getByRole("button", { name: "Refresh", exact: true }).click();
  await panel.getByText(/Verified \d+s ago/).waitFor();
  car = {
    ...car,
    auction_end: new Date(Date.now() - 1000).toISOString(),
    highest_bidder_id_dealer: me,
  };
  await panel.getByRole("button", { name: "Refresh", exact: true }).click();
  await panel
    .getByText("Highest bidder · awaiting approval", { exact: true })
    .waitFor();
  assert.equal(
    await panel
      .getByRole("button", { name: "Review bid", exact: true })
      .count(),
    0,
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS outbid status, failed/offline sync blocks bidding, closed auction awaits approval",
  );
} finally {
  await browser.close();
}
