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
Daily encrypted off-environment database backups were added and verified on
28 October as described below. Full media/platform restore remains separate work.

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

At the 26 October production verification, counts were **31 cars, 8 bids and
16 profiles**.
Both document buckets are private. Existing customer bids, passwords and sale
results were not rewritten. Existing background schedules and provider secrets
were retained.

## Daily database backup — 2026-10-28

The repository owner added both backup secrets and manually started
[workflow run 40653635130](https://github.com/wcdsupport01-sys/wellcardeals/actions/runs/40653635130)
on `main` at `bdb8d59`. Encryption/failure tests, the read-only database export
and encrypted artifact upload all succeeded. GitHub reports the workflow active;
its daily schedule is 20:30 UTC / 02:00 IST, with 14-day artifact retention.
The first verified execution was manual; scheduled executions are best effort.

The actual uploaded artifact (10,566,740 bytes as an artifact ZIP) was downloaded
and authenticated with the separately saved recovery key. A disposable local
PostgreSQL 17 restored all 33 public tables, 3 account tables and 37,813 imported
catalog records. Exact row-content fingerprints, catalog completeness, generated
account fields, foreign keys and sequence positions passed. Its snapshot contains
31 cars, 9 bids and 16 profiles; customer activity after the release is preserved.
The temporary plaintext and restore container were removed after verification.
No production records were changed by this backup or recovery check.

The archive includes account password hashes and identities, encrypted, plus
storage inventory. Media file bytes, active sessions and provider/platform
secrets are outside this database archive. Keep the independent recovery key
and rotate the read-only backup token before expiry. Setup and recovery details:
[DAILY_DATABASE_BACKUP_HI.md](DAILY_DATABASE_BACKUP_HI.md).

## Remaining items

On 28 October the owner confirmed the three legacy closed auctions used test
bids, not genuine offers. The targeted
[`archive_confirmed_test_bids_20261028.sql`](../supabase/archive_confirmed_test_bids_20261028.sql)
preserves their five exact bid records in an admin-readable archive before
removing them from active bidding; no car, price, winner or sale fields change.
The actual encrypted GitHub snapshot was restored locally and this cleanup
passed: all other table fingerprints stay unchanged, dealer-price mismatches
fall from 3 to 0, changed-data scenarios roll back, archive privacy is enforced
and reruns preserve later activity. **Production execution remains pending:**
the existing production deployment credential returned HTTP 401. The repository
owner can apply the complete reviewed SQL through the production SQL Editor;
see [CONFIRMED_TEST_BIDS_HI.md](CONFIRMED_TEST_BIDS_HI.md). Until applied, the sale
guard continues to reject the three inconsistent cached results.

Full media/platform restore, actual email/SMS/payment and external Sheet write
delivery were not established by this release. Existing repository-wide
frontend lint issues remain (73 errors, 3 warnings); the production build and
relevant tests pass. No software release guarantees zero future errors.

Staging details and repeatable checks are in
[BACKEND_STAGING_VERIFICATION.md](BACKEND_STAGING_VERIFICATION.md) and
[BACKEND_UPGRADE.md](BACKEND_UPGRADE.md).
