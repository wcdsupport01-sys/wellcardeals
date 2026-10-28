# Dealer auction interface — 28 October 2026

The owner approved the standalone dealer design preview before implementation.
The dealer workspace now uses the dark navigation, light canvas, blue actions
and self-hosted Manrope typography from that preview. Production uses the
existing dealer account, real auction records and inventory photos; sample
preview vehicles, counts and bids are not included.

The auction desk has four server-backed summary cards and tabs, grid/list
layouts, watchlist actions, price/countdown cards and responsive navigation.
Car/location search continues to use the existing server query and pagination;
the location control searches inventory rather than filtering only a loaded
page. Missing/unavailable photos have a clear fallback. A keyboard-accessible
guide explains the review/confirmation process. Dealer-only vehicle details,
amount entry, bid receipts/history and the confirmation dialog share the new
design. Buyers retain their existing public-site presentation.

This is a frontend release. There is no SQL migration or change to bid request
IDs, server-time freshness checks, accepted-bid receipts, interrupted-request
recovery, minimum-amount validation or seller approval rules. The amount and
submission handlers in `DealerBidPanel` remain unchanged.

## Validation

- Production Vite build; output kept outside tracked `dist`.
- ESLint on the four dealer components introduced/changed by the redesign.
- Six existing auction amount/status/export tests.
- `tests/dealer-auction-browser.mjs`: watchlist/totals, minimum validation,
  review/confirm, accepted receipt, lost-response recovery after reload without
  duplicate submission, outbid/stale/offline handling and ended-auction status.
- `tests/dealer-workspace-browser.mjs`: desktop/tablet/mobile widths, server
  search and location search, grid/list, watchlist/counts, missing/broken photos,
  closed-auction actions, guide focus/Escape, mobile focus trapping and routing.
- Desktop/mobile bid-panel and review screenshots inspected. Browser checks use
  isolated synthetic auth/API fixtures; no real customer bid is placed.

```sh
node --test tests/dealer-auction.test.js
PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tests/dealer-auction-browser.mjs
PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tests/dealer-workspace-browser.mjs
```

Run the browser checks with Vite on `http://127.0.0.1:5173`. The existing browser
fixture now includes the current `AuthRecovery` export and protected
`cars_catalog` read model; its old tab selector was updated for count badges.

Deployment follows the existing Netlify connection to `main`. Approved dealers
see the interface at `/dealer/dashboard` after signing in. Manrope's SIL Open
Font License is shipped at `/font-licenses/Manrope-OFL.txt`.

## Approved vehicle-detail preview implemented

After reviewing a separate vehicle-detail preview, the owner approved the
gallery-left, bidding-right design. Approved dealers viewing auction listings
now get a single gallery, thumbnails/fullscreen controls, real vehicle highlights
and a sticky bidding column. On smaller screens the sections stack and a fixed
bottom action opens the same bid review. Overview, inspection, features,
documents and similar listings use tabs without unmounting the bid panel or
discarding an entered amount. No second large vehicle photo is added.

Fuel and transmission names are looked up from the listing's actual lookup IDs.
Inspection displays only saved categories, statuses and notes, with explicit
missing-data states. Public document links are validated as HTTP(S). Recognized
private documents are signed for ten minutes with the current user's storage
permissions only when the Documents tab is opened; denied access has no link.
Buyer and fixed-price dealer listings keep the previous layout and EMI panel.

The review dialog renders through a React portal so the sticky column does not
put bid confirmation behind navigation. Bid submission, pending-request recovery
and all financial handlers remain unchanged. This release needs no backend
migration. Tests use intercepted auth/API/storage fixtures, including denied
private-document access, and never place a production bid.

Additional validation: `tests/dealer-car-detail-browser.mjs` covers desktop,
mobile/tablet widths, one gallery, deduplication, keyboard/focus fullscreen,
actual fuel/transmission labels, saved inspection notes, document access,
retained amount entry across tabs, full-viewport bid review, empty data and the
unchanged buyer/fixed-price views. Run it with the same Vite/Playwright setup.
