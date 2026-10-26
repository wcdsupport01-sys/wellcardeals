# Production backend release — 2026-10-26

The backend upgrade is live on **https://wellcardeals.com** and production
Supabase project `zdbtlwdjmpvcmwsnkopc`. Both SQL stages, the matching website
build and all **18** checked-in Edge functions were deployed in the coordinated
order. The release configuration check passes all 17 command/access checks.
The source read-only, staging deployment and production deployment credentials
remain separate. Deployment tokens are setup credentials; their expiration does
not stop the running website's configured Supabase services.

## Recovery preparation

The production backup inventory had no managed database backups. Before any
production change, a private upgrade-recovery export was saved outside Git under
`/workspace/.backend-backups/`. It includes the public application schema,
all 29 existing application tables and sequence positions, Auth reference IDs,
storage object inventory/bucket configuration, all 50 document files affected
by the private-bucket migration, and the previous 18 Edge function bundles.
The large imported vehicle catalog contains 37,813 records and was exported in
bounded chunks with stable source fingerprints.

A disposable PostgreSQL 17 container restored the application schema and data.
All 29 table counts/content fingerprints, foreign keys, sequence positions and
backed-up file hashes were checked. Both migrations were then applied over the
restored real application data. Database checks passed and existing application
record fingerprints remained unchanged. The container was removed afterward.
No production customer records were copied to the remote test project.

This export is an **upgrade-recovery backup**, not a full Supabase disaster
recovery backup: Auth passwords/sessions and provider secrets were not exported;
unchanged public car-media bytes were not duplicated. It is retained privately
in this environment, not uploaded to GitHub or an external backup service.
Scheduled, off-environment backups and full project restore remain separate work.

## Deployed checks

- Real synthetic production Auth logins/JWTs for buyer, dealer and staff;
  self-promotion denied, staff reports and dealer dashboard authorized, public
  catalog/private-column restrictions and direct-write denials verified.
- Production bid acceptance/receipt replay and buyer request/replay/completion
  exercised inside **one rolled-back transaction**. No test cars, bids,
  purchase requests or Sheet outbox rows were committed.
- Private Storage PDF upload/download/signing through real HTTP: owner and
  approved staff allowed, unrelated dealer and public URL denied. The test file
  and synthetic accounts were removed afterward.
- Mobile Chromium loaded the published production frontend with a real synthetic
  buyer session and verified that the buyer's orders load without script errors.
  TLS checks used the trusted environment proxy CA.
- Anonymous calls to protected Edge endpoints return 401. The old
  `push-winner-to-sheet` endpoint was discovered in the deployed project, audited
  and replaced with a compatibility handler using the same verified transactional
  sale command. It now checks approved admin status, closed auction/highest bid
  and durable outbox rules. Its real production checks deny anonymous/suspended
  callers and route approved JWTs through the command; no car/Sheet row is changed.
- The scheduled Sheet worker retains its existing secret-header gateway behavior.
  Its scheduled HTTP calls returned 200. Queue handling/column mapping/leases
  were tested; no external test Sheet append, SMS/email or payment was sent.

After the production checks, counts remain **31 cars, 8 bids and 16 profiles**.
Both document buckets are private. Existing customer bids, passwords and sale
results were not rewritten. Existing background schedules and provider secrets
were retained.

## Remaining items

Three legacy **closed auctions** have a cached dealer price below their saved
bid history. Their financial history was preserved for business review; the new
sale guard refuses to confirm a lower cached bid as the winner. Use the read-only
`supabase/backend_data_preflight.sql` to check aggregate counters. These records
need reconciliation before staff can confirm their sales.

Automatic backups/full restore, actual email/SMS/payment and external Sheet
write delivery were not established by this release. Existing repository-wide
frontend lint issues remain (73 errors, 3 warnings); the production build and
relevant tests pass. No software release guarantees zero future errors.

Staging details and repeatable checks are in
[BACKEND_STAGING_VERIFICATION.md](BACKEND_STAGING_VERIFICATION.md) and
[BACKEND_UPGRADE.md](BACKEND_UPGRADE.md).
