# Supabase staging verification — 2026-10-26

The backend upgrade is deployed and tested on **wellcardeals-test.**
(`efxroxbhwfdwxlbtsaxp`). Production (`zdbtlwdjmpvcmwsnkopc`) schema inspection used its separate
read-only credential. This document records the staging checks; the subsequent
production release used the separate deployment token and is recorded in
[BACKEND_PRODUCTION_VERIFICATION.md](BACKEND_PRODUCTION_VERIFICATION.md).

## Restoration and deployment

The source PostgreSQL 17 schema was exported through the read-only Management
API and restored to the empty PostgreSQL 17 test project. Before applying the
upgrade, normalized comparisons matched 29 tables, 3 sequences, 1 view, 374 table
columns, 103 constraints, 38 indexes, 34 functions, 15 triggers, 70 policies,
984 relation grants, 154 function grants, 3 bucket configurations and 1 event
trigger. All 29 application tables were empty. No customer rows, passwords,
storage objects, provider credentials or background schedules were copied.

Both checked-in v3 SQL stages were applied to the test project, and the
read-only release check returned `database_checks_passed`. All 18 checked-in
Edge functions are deployed and active. Because secure proxy credentials are
resolved only on outbound requests, the CLI rejected the local token format;
the authenticated Management API multipart deployment succeeded. No credential
values were written to source, arguments or logs.

## Authenticated checks

`tests/backend/staging-smoke.mjs` uses the real Supabase JS SDK and managed
Auth/PostgREST/Storage/Edge HTTP endpoints. Credentials arrive only on stdin;
the harness rejects every project except the explicit disposable test project.
It creates synthetic `.invalid` email accounts with email confirmation set by
the Auth Admin API; it sends no email/SMS and contacts no payment provider.

Verified workflows include:

- Real password login for admin, manager, team lead, agent, two buyers,
  approved dealer, pending dealer and suspended staff; protected Edge actions
  reject anonymous, buyer, pending, suspended and unauthorized staff requests.
- Transactional Edge listing creation and retry; anonymous/buyer catalog masking
  and denied access to raw private fields or direct purchase writes.
- Verified buyer request, same-operation receipt replay, duplicate active enquiry
  reuse, stale-quote rejection and two competing staff purchase completions with
  only one successful sale.
- Dealer bid insertion with UUID receipt, retry without a second bid, per-car
  Rs 1,000 increment, approval checks, immutable terms and ended-auction sale.
  Sales outbox retains the accepted Rs 102,000 bid, not its optional Rs 999,999
  Buy Now price. A cached lower bid cannot be confirmed as the winner.
- Buyer seller request, manager assignment, agent Edge submission and team-lead
  review. The initial outbox record contains the assigned agent before the
  submitted request is linked to its new listing.
- Private PDF upload/signing through managed Storage: owner and staff allowed,
  unrelated buyer denied, public URL blocked.
- New dealer application approval, trusted Auth/application binding, real dealer
  login, rejected repeat approval, synthetic staff password reset and no-store
  credential response; public contact submission with anonymous reads blocked.

Each run removes its own synthetic accounts, cars, requests, files, operations
and associated records. The disposable staging schema remains available for
further verification. Durable throttle counters and earlier synthetic outbox
entries may remain; no provider delivery schedule/credentials were copied.

Local tests additionally passed 18 Node contracts, 15 Deno contracts, all Edge
entry-point type checks, PostgreSQL/PostgREST concurrency/RLS/privacy tests,
mobile Chromium buyer and staff workflows, and the production build. Existing
repository lint issues remain: 73 errors and 3 warnings.

## Production findings and remaining release work

The read-only aggregate preflight found 31 cars and 8 dealer bids. Three
**closed auctions** have a cached dealer price below their saved bid history.
No live auction had an invalid clock, no live Buy Now listing had a missing or
nonpositive price, no submitted agent request lacked its car, no profile had a
null role/status, and the outbox had no pending/failed jobs at the time of the
check. At preflight time both legacy document buckets were public; stage 2 makes
these private and the matching frontend resolves signed documents.

The new guard prevents a mismatched cached price from confirming a lower
winner. The three legacy records still need a business review/reconciliation;
the release does not silently rewrite historical financial results.

The subsequent production release followed SQL stage 1, Edge, matching Netlify
frontend, then SQL stage 2, after a private recovery backup/local restore rehearsal.
The three legacy records still require business reconciliation. Production deployment credentials
must remain separate from the source read-only and test-project credentials.
Google Sheets delivery, SMS/email providers, production backups and Netlify
publication are outside these staging checks; the later production verification
is recorded separately. These tests do not guarantee zero future errors.
