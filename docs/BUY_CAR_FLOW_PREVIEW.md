# Buy Car and dealer auction separation — 29 October 2026

The owner reviewed the purchase-only preview and approved publishing this
correction through the existing GitHub-to-Netlify deployment.

Previously the shared `/cars/:id` page selected dealer navigation and auction
controls from the signed-in role. An approved dealer entering from Buy Car could
therefore see auction navigation on a fixed-price purchase listing. Buy Car also
advertised bidding, and the shared public detail retained a legacy auction panel.

`/cars/:id` is now always a direct-purchase page. Its query requires a public
fixed-price listing, uses the listed purchase price and actual fuel/transmission
labels, and contains no auction status, timer or bid controls. Similar listings,
public featured cards, Buy Car copy and the purchase-page footer stay purchase
focused. Buy Car uses a purchase-only query even for dealer accounts. Buyers
retain the existing transactional request flow; guests get buyer login; other
account roles get the team's telephone enquiry action instead of a dead purchase
button. Buyer transaction permissions have not been widened.

Services → Live Auctions still opens the protected dealer auction desk. Its cards
now link to `/dealer/auctions/:id`, a separate approved-dealer route. Dealer
navigation and the existing V2 bidding interface appear only in that route.
Existing bid handlers, backend permissions and pending-receipt storage keys are
unchanged. A public car URL, query or hash cannot turn on dealer bidding.

Validation uses isolated auth/API fixtures: purchase-only UI for an approved
dealer, buyer and guest; no auction snapshots on purchase routes; fixed prices
unaffected by dealer bids; public links cannot open auction inventory; guest and
buyer auction-route guards; Services entry into the dealer desk and auction
detail. The existing auction confirmation/recovery, dealer detail and buyer
purchase retry suites also pass. No real purchase, bid or customer message is
submitted. The preview uses selected public vehicle records/photos in an
untracked workspace directory; those records are not application fixtures.

```sh
PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tests/buy-car-flow-browser.mjs
```
