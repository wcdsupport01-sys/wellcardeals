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
