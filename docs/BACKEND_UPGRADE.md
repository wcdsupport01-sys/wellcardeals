# Backend reliability upgrade — release candidate

Source branch: `codex/backend-reliability`. Production main remains `db4e724` until
the database, Edge and frontend rollout is completed. The metadata supplied on
2026-10-25 was used to build and test this change. It does not establish that
production functions, delivery providers or backups have been deployed/verified.

## What changed

- Verified JWTs, approved-role checks, bounded JSON and UUID validation protect
  Edge mutations. Temporary passwords use Web Crypto. Responses carrying
  credentials have `Cache-Control: no-store`. The missing staff password-reset
  endpoint is implemented. Google/Twilio/database fetches have abort deadlines.
- Auth initialization cannot restore a stale account after logout/account switch.
  Failed permission checks clear access, offer retry and refresh in the background.
  Email-confirmation signup retains metadata and waits for an actual session.
- The exported `profiles.must_change_password` column is NOT NULL without a
  default. Stage 1 gives NEW rows a false default; it does not change stored flags.
  This flag alone is not an implemented forced-password-change mechanism.
- `backend_car_command` rechecks the approved actor under a lock. Create/edit,
  agent submission/review, auction sale, direct purchase completion, archival and
  dealer approval write their operation receipt and actor audit in one transaction.
  Idempotency keys are scoped to actor/action/payload. An uncertain reply reuses
  the same key; double clicks share a pending request. Listing forms retain the
  uploaded payload during an uncertain same-page retry instead of uploading new
  URLs and accidentally starting a second creation.
- Assigned submission locks its request, saves a hidden draft and links the car
  together. Concurrent submissions reuse the linked car. Team leads can review
  pending agent submissions; they cannot perform general inventory/sales writes.
  Approval preserves the assigned listing type. Auction submissions need an end
  time configured in Inventory before review can publish them.
- Auction terms cannot change after bids. Equivalent numeric/time values do not
  count as changes, and editing a description cannot reset the standing bid.
  The auction clock is checked after the row lock; hidden/future auctions reject
  bids. Withdrawn listings remain in the bidding dealer's history.
- Dealer sales require an ended auction and an actual matching highest bid.
  Direct purchase completion locks request+car; competing completions cannot
  sell the same car twice. These are staff sale confirmations, not payment
  collection or proof of funds. Public C2C/PDI/contact statuses track their
  separate request workflows; they do not charge customers or constitute a car
  sale. Physical car deletion is replaced with delisting to retain history.
- Application approval never resets an unrelated account with the same email.
  Auth creation binds the new login to the application using trusted app_metadata;
  the database atomically creates/links its approved profile+application. New
  staff-provisioned logins can enter without being stranded behind an unset legacy
  access code. A lost commit reply is checked, never compensated by deleting a
  possibly successful login. Staff get a **Finish account setup** recovery action
  when the server returns its newly created user ID; after reconciliation use the
  authorized password reset to issue fresh credentials if the original was lost.
  If Auth creation itself loses its reply before returning a user ID, an administrator
  must reconcile the trusted application binding in Auth; never adopt/reset an
  existing login merely by matching applicant email.
- Legacy profile approval/code generation remains compatible, is limited to
  approved admin/manager callers and is audited. Code verification locks its row,
  handles null safely and retains failed-attempt counts. The legacy code is not
  MFA: old profile records expose that code to their owner. Dealer bidding relies
  on authenticated identity and approved status, rather than claiming a second factor.
- `cars_catalog` authorizes rows and masks seller/internal data. Dealer-only
  auctions are absent from anonymous/buyer catalog reads. Bid snapshots/receipts/
  dashboard use the same redaction. Root client listing reads use the catalog;
  explicit safe `cars(...)` embeds retain column grants. Old raw private column
  grants and the public negotiation view are removed in stage 2.
- Profile insert/update guards reject self-approval, staff roles and protected
  identifiers. Request guards enforce initial state/ownership, protect assignments,
  logins, commissions and financial fields, validate amounts/location, and prevent
  direct purchase-completion bypasses. Old permissive policies are replaced as a
  set. Public submissions have a per-contact/account throttle; this is not an
  IP/CAPTCHA gateway and changing contact details can evade it.
- Anonymous car-media writes are removed. Dealer/sell request buckets become
  private, with owner/staff reads and bounded types/sizes. Existing dealer profile
  URLs and new canonical object references resolve to ten-minute signed URLs.
  Auth media refreshes with the profile; reload a long-open staff list to renew
  expired document links. New car media uses the uploader's UUID prefix.
  Vehicle PDFs already in the public car-media bucket remain public by URL;
  private migration of those objects is a separate storage operation.
- SQL aggregates produce dashboard/bid counts and complete vehicle lookup options
  without the PostgREST row cap. Main buyer/staff inventory/request lists use
  stable timestamp+ID pagination, including a custom API cap below page size.
  Browser list loads stop with an explicit error above 20,000 rows rather than
  silently truncating; this is not a replacement for large-scale server-filtered UI.
  C2C filters/actions now use the actual database status values.
- Postgres audit records are authoritative. Listing/sale endpoints rely on the
  existing durable database outbox instead of duplicate best-effort Sheet appends.
  The Sheet worker has a service-only renewable lease, supports Sales_Log,
  coalesces repeated keys and writes RAW values. It maps by existing headers and
  preserves cells absent from a partial payload instead of overwriting headers or
  blanking unrelated columns. Failed jobs remain pending with attempts/errors.
  External writes are at least once: a process lost around an external append can
  still require duplicate reconciliation; Sheets are a mirror, not a backup.

## Local verification

- 18 Node contracts cover auth races, bid helpers, lookup failures, durable request
  IDs, concurrent client saves, signing and capped/paged read failures.
- 14 Deno contracts cover auth/password/input policies, handler delegation,
  provisioning uncertainty, conflict responses and Sheet column preservation.
- All Edge entry points type-check against the real pinned Supabase SDK.
- PostgreSQL 16 tests replay metadata-derived tables, columns, defaults and
  constraints, then v2 + both v3 stages. Assertions cover roles/RLS, privacy,
  concurrent purchase and assigned submissions, timestamps, sale conditions,
  audit/idempotency, private object policies, form throttling, profile approval,
  provisioning, worker leases and aggregates above 1,000 rows.
- PostgREST 13 checks real catalog foreign-key embeds, anonymous masking,
  dealer/owner reads and staff report RPCs with synthetic JWTs.
- Mobile Chromium checks the actual AuthProvider, buyer error/retry/removal,
  agent review, purchase completion and team-lead permission UI.
- The production build passes. Repository-wide lint still has existing frontend
  issues (77 errors, 3 warnings in this checkout). A successful build is not a clean lint run.

```sh
node --test tests/auth-session.test.js tests/dealer-auction.test.js tests/rcLookupApi.test.js tests/backend-operations.test.js
# Deno 2; in this workspace use the supplied trusted proxy certificate.
DENO_CERT="$SSL_CERT_FILE" deno check --config deno.backend.json supabase/functions/*/index.ts
DENO_CERT="$SSL_CERT_FILE" deno test --allow-env --allow-read=./supabase,./tests --config tests/backend/deno.json tests/backend
# Disposable containers only; no remote DB/password/account is used.
docker pull postgres:16
docker pull postgrest/postgrest:v13.0.7
BACKEND_REST_TEST=1 node tests/backend/database.mjs
npm run build -- --outDir /tmp/wellcardeals-build --emptyOutDir
npm run dev -- --host 0.0.0.0 --port 5173 --strictPort
PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tests/backend/browser.mjs
PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tests/backend/workflows-browser.mjs
```

The synthetic fixture contains no customer rows. Legacy function/trigger bodies
were NOT in the export, and the old negotiation view is represented only as a
relation for REVOKE testing. Tests do not establish compatibility with every live
inspection/history/queue trigger body. Test a restored staging copy before production.

## Coordinated rollout

1. Securely capture the current DB schema/data and storage object backup; prove a
   restore on staging. Storage metadata alone is not a backup of its objects.
   On that copy, review existing inspection, privilege/price guards, bid validation,
   history and outbox trigger bodies and repeat role/workflow/rollback checks.
   Inspect the actual queue payloads/Sheet headers and scheduled worker status.
2. Apply **supabase/backend_commands_v3.sql** first. It adds compatible commands,
   read views, aggregates and worker lease without deleting existing records.
   Leave **backend_access_v3.sql** until the matching clients are deployed.
3. Deploy ALL checked-in Edge functions using the existing Supabase CLI project
   configuration; shared imports changed across endpoints. Securely configure
   the required Supabase/Google/Twilio bindings in the platform, never in Git/chat.
   The project's verify_jwt=false configuration is preserved; protected endpoints
   still verify JWT+role/status themselves. Then deploy the matching frontend to
   a Netlify preview, validate it, and release it to production. GitHub/Netlify
   deployment alone does **not** deploy Edge functions or SQL.
4. Apply **supabase/backend_access_v3.sql**. It replaces access policies, makes
   private buckets private and removes raw/legacy exposure. Repeat anonymous,
   buyer, pending/approved/suspended dealer, agent and each staff role smoke tests.
   Ask old browser tabs to reload. Verify completed sales, queue drain, signed
   documents and denied direct writes on production without placing customer test
   bids or resetting customer accounts. Monitor failed jobs and backup schedules.

If a SQL stage fails its transaction, inspect the error before proceeding. After
stage 2, a frontend rollback must retain the catalog/command-compatible client.
Do not restore permissive public grants or public document buckets as a shortcut.
Keep the schema/audit data; prepare a forward fix for any discovered trigger conflict.

No production database administrator, authenticated Supabase CLI deployment or
Netlify management access is present in this workspace. These source changes
must not be described as a deployed, completely verified production upgrade.
