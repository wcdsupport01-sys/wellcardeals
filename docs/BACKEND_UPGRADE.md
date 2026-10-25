# Backend upgrade: audit and rollout status

Branch: `codex/backend-reliability`. The dealer-auction upgrade already on main
is preserved. This branch is a staged upgrade, not a claim that the entire live
backend has been upgraded or verified.

## Implemented and independently testable

- The shared staff/agent guard verifies the caller's JWT with Supabase Auth,
  requires an explicitly approved profile and the endpoint's allowed role,
  rejects missing server configuration, and fails closed on profile query errors.
- JSON entry points require a bounded object body and reject arrays/primitives,
  malformed JSON and oversized payloads. Identifier checks precede relevant
  privileged mutations. Credential-bearing responses use `Cache-Control: no-store`.
- Staff/agent/dealer temporary credentials use Web Crypto with rejection sampling,
  not Math.random. Custom administrative passwords are 8–128 characters and
  aren't silently trimmed. Existing stored passwords are not changed by deploying
  these helpers. The missing `reset-user-password` function is implemented.
- Dealer approval no longer scans existing Auth users or resets/re-roles an account
  based on an applicant-supplied email. Conflicting existing accounts require
  separate review. New-account profile failures attempt cleanup of the newly
  created login; uncertain later application-link failures still need reconciliation.
- The listing editor and assigned-agent handler cannot submit bid/winner fields, server timestamps or a
  direct `sold` status. Auction-term changes after bids are rejected. Compare-and-set
  predicates prevent a concurrently accepted bid from being overwritten by a
  price edit. Starting bid placeholders are initialized on the server.
- Repeated sale confirmation returns the existing result without repeating Sheet
  pushes. Empty/winnerless or still-open dealer auctions are rejected, and sale
  writes recheck the previously observed status/winner/amount to detect conflicts.
  Database-clock enforcement and a durable transaction audit still require the
  schema-dependent sale RPC below; the Edge clock is not its replacement.
- Deleting a car linked to history returns an actionable conflict. The database's
  existing restricted foreign key remains the actual retention enforcement.
- Dealer login lookup treats email LIKE metacharacters literally; query failures
  produce an unavailable response instead of a false "account not found".
- Google/Twilio calls have abort deadlines. Google Sheet values use RAW input so
  a submitted name or note cannot be interpreted as a spreadsheet formula.
- Auth state has generation/cancellation guards, clears stale permissions on
  account changes and logout, retries failed verification and revalidates in the
  background. Async Supabase work runs outside auth-change callbacks.
- Email-confirmation signup retains name/phone in Auth metadata and waits for an
  authenticated session before profile writes. Concurrent buyer profile creation
  doesn't fail the signup on a duplicate key. Self-supplied profile objects cannot
  overwrite id/role/status through the legacy registration client helper.
- Buyer dashboard/orders/listings distinguish read failures from empty results;
  failed saved-car removal retains the item and shows an error.

## Required next step: read live schema before database changes

Run **only `supabase/backend_inventory.sql`** in the live SQL Editor and export
its single result row as CSV. It returns schema/constraints, RLS, grants, trigger
names, function signatures/permissions and bucket configuration, not customer
rows, Auth password hashes or API credential values. Credential-like column
defaults are redacted. One JSON result row avoids the editor's 100-row result cap.

Why this is required: production already differed from repository SQL (UUID bid
IDs). `agent_portal_migration.sql`, `car_handler_migration.sql`,
`car_inspection_migration.sql` and `rbac_manager_teamlead_migration.sql` are empty.
Other flows reference migrations absent from Git, including agent car submission
review, car_master_data, contact/C2C requests and the Sheet sync queue.
The current Edge deployment and live function bodies cannot be inferred from
this checkout. Database admin/deployment access is not present in the workspace.

## Outstanding required work for the full backend upgrade

| Area | Concrete issue / required change |
| --- | --- |
| Profiles/RBAC | Verify live INSERT/UPDATE policies and privilege-escalation trigger. Prevent a self-signup from selecting approved dealer/staff status, editing dealer IDs or staff fields, or exploiting nullable comparisons. Preserve legitimate pending dealer onboarding. |
| Agent listings | Standalone agent submission and review currently write cars directly from the browser, which conflicts with the deployed auction write guard. Replace both with scoped server actions; team leads get review-only authority, not generic inventory writes. |
| Assigned inspection | Link the created car and car_auction_requests inside one database transaction with request locking/idempotency; current Edge code can leave an orphan or publish twice after retry. |
| Purchase/sales | Add database-clock, row-locked sale and purchase-completion RPCs. Persist actor/event/receipt atomically, reject competing buyers, and retain request history on archival. |
| Admin inventory | Move compare-and-set mutation/audit into one database command, including explicit status transitions and handler/reviewer checks. Add durable operation receipts to creates and retries. |
| Dealer provisioning | Make profile + application approval one transaction, with a safe Auth-account compensation/reconciliation process for uncertain responses. Never overwrite an unrelated existing login. |
| Public forms | Audit each request table's insert/read/update grants. Force initial pending state, bound text/price/location fields, enforce ownership and workflow transitions. Add rate limiting/abuse controls through a supported gateway or distributed store. |
| Data privacy | Audit public cars SELECTs for dealer-only rows and seller contact fields. Use role-appropriate read models rather than assuming client filters provide privacy. |
| Storage | Check actual car-media/dealer-docs policies, upload sizes/MIME types and ownership. Dealer licensing/identity documents need private access and signed URLs before making the bucket private; existing public URL consumers must migrate together. |
| Reporting | Buyer/staff lists need server-side pagination/counts beyond the default PostgREST row cap. Errors must not silently produce incomplete finance or inventory totals. |
| Sheets/outbox | Review existing sheet_sync_queue and sync worker. Authoritative sale/audit events must be durable in Postgres; best-effort appends are not an audit ledger or a backup. Verify retry/locking/deduplication. |
| Operations | Capture schema backup, validate upgrade on a staging copy, test restore, establish monitoring and failed-job review. Verify current deployed Edge functions, secrets' presence and scheduled jobs without exporting secret values. |

## Validation commands

Deno 2.5.6 was installed outside the repository. `deno.backend.json` maps the
existing pinned CDN SDK to the same npm version for local type checking; production
imports remain unchanged. In this cloud environment, set DENO_CERT to the supplied
SSL_CERT_FILE so package downloads use the existing trusted proxy CA.

```sh
DENO_CERT="$SSL_CERT_FILE" deno check --config deno.backend.json supabase/functions/*/index.ts
DENO_CERT="$SSL_CERT_FILE" deno test --allow-env --allow-read=./supabase,./tests --config tests/backend/deno.json tests/backend
node --test tests/auth-session.test.js tests/dealer-auction.test.js tests/rcLookupApi.test.js
npm run build -- --outDir /tmp/wellcardeals-build --emptyOutDir
```

The backend contract tests use injected fake Auth/database clients and run without
network access. They never reset real accounts or send emails/SMS. The real pinned
SDK is checked separately with Deno. Browser fixtures exercise the actual
AuthProvider/recovery and buyer read/delete error flows:

```sh
npm run dev -- --host 0.0.0.0 --port 5173 --strictPort
PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tests/backend/browser.mjs
```

Repository-wide frontend lint has pre-existing failures. Passing builds/contracts
cannot establish live RLS, database transaction, Auth-provider or delivery behavior.

## Deployment after outstanding checks

Review the live inventory and prepare/test the schema-specific migrations first.
Then deploy changed Supabase Edge functions as a coordinated release, followed
by the frontend. A GitHub/Netlify push deploys the frontend, **not** Supabase Edge
functions. Do not publish this branch as an already verified full-backend upgrade.
Function configuration follows the project's existing verify_jwt=false pattern;
protected handlers still require JWT verification through auth.getUser plus their
server-side role/status check. Do not remove these checks when deploying.

Required backend deploy scope includes the shared helper importers plus
reset-user-password, dealer-login-lookup, send-access-code, record-signup and
sync-google-sheets. Securely configure missing bindings in Supabase settings;
never copy credential values into source, Git, logs or chat.
