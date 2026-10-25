# Dealer auction desk

Buyer purchases remain on Buy Car. Approved dealers use `/dealer/dashboard` and
`/cars/:id#dealer-bidding`. Existing `/live-auctions` links redirect to the desk.

## What changed

- Live auctions, all participated cars, server-backed watchlists and results have
  separate views. Summary counts cover all matching database records; pages are
  24 cars, rather than deriving totals from the latest eight bids.
- Dealer bids use `place_dealer_bid_v2` exclusively. It authenticates the caller,
  locks their approval row and the car row, checks the database clock after
  waiting for locks, enforces whole-rupee amounts, the reserve floor and minimum
  increment, and commits the bid history and highest bidder together.
- A globally unique request ID is saved before sending. Pending requests survive
  a page refresh in the same tab. Reconciliation looks up the receipt first and
  retries the same key. A missing/failed response never means "try another bid".
- Prices and personal bid history use a verified server snapshot. Realtime
  signals trigger refresh; polling is a fallback. Offline, failed or stale
  snapshots pause new bids. Closing time is enforced by PostgreSQL; the UI clock
  is only guidance. Very slow snapshots (>5s round-trip) pause bidding too.
- Accepted receipts display the bid ID, amount and server acceptance time in IST.
  Dealer status is based on the highest bidder's ID, not equal amounts or names.
- "Highest bidder · awaiting approval" is distinct from "Deal confirmed".
  Confirmation requires the existing administrator mark-sold workflow and
  `dealer_winner_marked_sold`, not just an expired countdown.
- Staff can export bid records with IDs, request IDs and server timestamps.
  Exports use cursor pagination and escape spreadsheet formula prefixes.

## Deployment prerequisite — do not deploy the frontend by itself

The workspace has frontend Supabase configuration, but no database admin
connection was supplied. Local PostgreSQL and fixture-based browser validation
do not establish that these functions exist in the live Supabase project.

1. Review the project's live schema, existing bid RPC definitions and grants.
   Export a schema/data backup and retain the legacy function definitions/ACLs.
   Test the migration on a staging copy of the live schema first. Required
   existing tables are `profiles`, `cars`, `car_bids`, and `wishlist`; these come
   from the repository's existing migrations. Keep existing auth/RLS protections.
2. During a short bidding maintenance window, run the complete contents of
   `supabase/dealer_auction_v2_migration.sql` through the Supabase SQL Editor as
   the database owner. It runs in one transaction and is safe to rerun.
3. Deploy this frontend revision immediately after the migration succeeds.
   Older open tabs must reload: every overload of `place_dealer_bid` has browser
   execution revoked. The new UI intentionally has no unsafe legacy fallback.
4. With staging dealer accounts, test two competing bids and an interrupted
   response, verify the receipt/history, then check the staff CSV export. Do not
   create test bids against a real customer auction.

The migration blocks direct browser writes to `cars` and `car_bids`, including
when an old permissive policy remains. Existing supported car administration
uses the service-role Edge Functions and continues through those paths. Audit
any other privileged SECURITY DEFINER routines on the live database before
rollout; a repository migration cannot establish the safety of unknown routines.

Car deletion is restricted when bids exist so history cannot be cascaded away.
Keep closed auctions as records; do not use the admin Delete action for these.
The new code neither deletes existing bids nor rewrites their amounts. Privileged
service-role maintenance remains privileged; retain database backups/audit logs.
This version models one auction per car record. Preserve the original record
when relisting; repeated rounds on one car need a separate auction-round model.

Reverting only the frontend is insufficient after retiring the old RPC. Prefer
a forward fix; any database rollback needs the reviewed, pre-upgrade function
backup and must preserve already accepted v2 bids and their request IDs.

## Local validation

Build without changing the repository's tracked `dist` output:

```sh
node --test tests/rcLookupApi.test.js tests/dealer-auction.test.js
npm run build -- --outDir /tmp/wellcardeals-build --emptyOutDir
```

Run database integration tests in a NEW disposable PostgreSQL container. The
fixture and test suite must never be run in a real project; a fixture marker is
required before the test runner resets tables.

```sh
docker run --detach --rm --name wellcardeals-auction-test \
  -e POSTGRES_PASSWORD=local-test-only postgres:16
# Wait for `docker exec wellcardeals-auction-test pg_isready -U postgres` to pass.
docker exec -i wellcardeals-auction-test psql -U postgres -v ON_ERROR_STOP=1 < tests/auction-fixture.sql
docker exec -i wellcardeals-auction-test psql -U postgres -v ON_ERROR_STOP=1 < supabase/dealer_auction_v2_migration.sql
AUCTION_TEST_CONTAINER=wellcardeals-auction-test node --test tests/dealer-auction-db.test.js
docker stop wellcardeals-auction-test
```

The browser contract test uses synthetic auth and intercepts REST requests; it
never places a live bid. It requires an installed Playwright module and Chromium:

```sh
npm run dev -- --host 0.0.0.0 --port 5173 --strictPort
# In another shell, with Playwright installed outside the application if needed:
PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tests/dealer-auction-browser.mjs
```

Live schema compatibility, real dealer authentication, network permissions and
production deployment must be verified separately. Existing repository-wide
lint failures are not evidence that a live bid was accepted or saved.
