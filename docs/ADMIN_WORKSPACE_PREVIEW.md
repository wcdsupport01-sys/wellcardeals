# Approved admin workspace V2 — 29 October 2026

The owner approved the full admin design and its follow-up complete vehicle form. This release integrates the design into the real React admin routes; the standalone sample preview is not used as the application or its data source.

## Result

- Navy grouped navigation, light Manrope workspace, bold working text, mobile navigation, role-aware command search, live pending-work drawer and server-count dashboard.
- Request and account lists offer paginated tables, cards and record details. Existing review, assignment, follow-up, access and purchase actions retain their backend handlers and role restrictions.
- Inventory exposes Edit directly and retains advanced card actions, inspection, price locks, assignments and sale follow-up.
- Add and Edit use one complete VehicleEditor: all fields from the old Add Car form, technical specs, compliance, notes, five inspection categories, five feature groups, custom specifications, prices/schedule, visibility/access and five media groups. Existing photo upload and WCD plate branding remain functional.
- Updates send only edited fields. Unchanged media, feature data, inspection details and timestamps retain their original values. Bids, winners and confirmed sales remain server controlled. Pending saves retain their operation ID across an uncertain reply; no second listing is created on retry.
- Buy Car remains direct purchase only; dealer auctions stay separate.
- Dealer application Approve/Reject applies only to pending applications. A conditional pending-only rejection and matching approval receipt prevent false success after a concurrent review or failed response. Approved applications link to Dealer accounts for suspension/restoration, rather than rejecting historical approvals.
- Dealer/agent Login ID and new password Show/Hide/Copy use existing authorized generation/reset endpoints. Existing passwords cannot be retrieved. New credentials live only in the one-time dialog and clear on close. Agent controls remain admin-only; dealer controls remain admin/manager-only.
- Reports export authorized inventory, purchase and dealer records with CSV formula protection. Activity reads recorded backend vehicle/purchase events through an additive staff-only RPC.

## Activity database step

`supabase/admin_workspace_activity.sql` is the only new SQL required. It adds a bounded, paginated read-only activity RPC. It does not change raw-table access, write commands, existing audit events or account passwords. Output details are limited to status and purchase-request ID.

It was tested on the isolated production-schema fixture: repeated installation, active staff permissions, denial for buyer/dealer/agent/inactive/anonymous roles, cursor pagination with timestamp ties, detail redaction and unchanged raw audit-table privileges.

Automatic production installation was not possible: the configured `WCD_SUPABASE_PRODUCTION_DEPLOY_TOKEN` returned HTTP 401. The owner asked for the remaining setup instructions after panel work. The frontend shows an explicit pending database-update state on Activity until the SQL is applied; all other admin tools work independently. Follow `ADMIN_WORKSPACE_ENABLE_ACTIVITY_HI.md` or refresh the deployment token through the Environment secret interface. Never paste a token into chat.

## Validation

- Production Vite build.
- `tests/admin-vehicle-form.test.js`: retained fields/media, edited-field patches, direct/dealer channel separation, term locks, validation, date precision, inspection/features/specifications, CSV formulas.
- `tests/admin-workspace-browser.mjs`: real React screens and API logic with an isolated SDK fixture; complete Add/Edit, same-operation save retry, no unnecessary uploads, verified dealer approval, one-time credentials, CSV, activity setup fallback, search, all admin modules, existing roles and all ten form sections on mobile.
- `tests/admin-dealer-applications-browser.mjs`: approved-action restrictions, linked account, pending-only rejection, concurrent review, receipt/transport failures, one-time credentials and role restrictions.
- `tests/backend/workflows-browser.mjs`: transactional purchase completion and agent review through the new details views, team-lead controls, buyer price confirmation and retry behavior.
- `tests/backend/database.mjs`: isolated PostgreSQL schema, activity RPC checks and the existing transaction/concurrency/RLS/receipt/privacy suite. No production records are used.
- Existing auth-session and backend-operation unit tests; Buy Car separation browser regression.

The repository has existing lint findings in legacy initial-load effects. New workspace/form/report components pass targeted lint; a passing build is not a claim of a clean repository-wide lint run. Authenticated production accounts are not created, reset or used for testing.
