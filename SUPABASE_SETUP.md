# Connecting the real database (Supabase)

This project uses **two** backends on purpose:

| What | Where | Why |
|---|---|---|
| Buyer / dealer / admin accounts, login, Google sign-in | **Firebase** (Auth + Firestore `buyers`/`dealers`/`admin_users`) | Already set up — see `src/firebase.js` and the `VITE_FIREBASE_*` keys in `.env`. |
| Car listings, dropdown lookups (brands, fuel types, etc.), live bidding demo, access codes | **Supabase** | This guide. |

The site works right now without doing anything below — cars/lookups will
throw a clear "Supabase isn't configured yet" error, and live bidding falls
back to a local, in-browser simulation. Follow these steps whenever you're
ready to switch those pieces to a real, shared database.

## 1. Create a Supabase project
1. Go to https://supabase.com and sign up / log in (free tier is enough to start).
2. Click **New Project**. Pick any name/region, set a database password (save it somewhere safe).
3. Wait ~2 minutes for the project to finish provisioning.

## 2. Run these schema files
In your project, open **SQL Editor** (left sidebar) and run these files
from this project's `supabase/` folder, **in order** — paste the whole file,
click **Run**, then move to the next one. All are safe to re-run.

1. `supabase/car_management_schema.sql` — creates `brands`, `models`,
   `fuel_types`, `body_types`, `transmissions`, `colors`,
   `vehicle_categories`, `features`, `states`, `cities`,
   `specification_keys`, and the main `cars` table, seeds some starter
   lookup values, and creates the `car-media` Storage bucket for photos/docs.
2. `supabase/schema.sql` — creates the `cars_state` / `bids` / `access_codes`
   tables and the bidding/access-code functions used by the Live Auctions
   demo, and seeds the 8 demo cars.
3. `supabase/dealer_pricing_migration.sql` — adds `access_type` (`all` /
   `dealer_only`) plus separate buyer/dealer price columns to `cars`, used by
   `fetchAuctionCars()` / `AuctionGrid.jsx` to show dealers their own pricing
   and dealer-only inventory. Has its own security note at the top — read it.

⚠️ **Read the notice at the top of `car_management_schema.sql` before
running it.** Because admin accounts live in Firebase (not Supabase Auth),
the `cars` and lookup tables end up open to anyone holding the public anon
key — fine to get everything working now, not fine to leave that way once
real users show up. See that file's comments for the recommended fix
(a small server-side function that checks the Firebase ID token before
writing).

## 3. Get your API keys
1. Go to **Project Settings → API**.
2. Copy the **Project URL** and the **anon / public** key (not the `service_role` key — that one must never go in frontend code).

## 4. Configure the app
In the project root, open `.env` and fill in:
```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```
Restart the dev server (`npm run dev`) — the console warnings about "local
preview mode" for Supabase should disappear, and Add Car / Manage Lookups
in the Admin panel should start writing to the real database.

## 5. Enable Realtime (usually on by default)
`schema.sql` already runs `alter publication supabase_realtime add table ...`
for you. If bids don't sync live across two open tabs, double check
**Database → Replication** in the dashboard — `cars_state` and `bids` should
be listed there.

## 6. Dealer approval → access code (currently: manual send, for testing)

This adds a step after admin approval: a 6-digit code is generated and the
dealer must enter it once before they can open the dealer dashboard or bid
in Live Auctions.

**Right now (testing mode)**: nothing is sent automatically. When an admin
clicks **Approve & Generate Code** in Manage Dealers, the code is generated
and shown right there in the admin UI with a **Copy** button — the admin
copies it and sends it to the dealer manually (WhatsApp/SMS/call, whatever's
convenient) from their own phone. "New Code" does the same for an
already-approved dealer.

Once a real SMS/WhatsApp provider (Twilio, WhatsApp Cloud API, MSG91, etc.)
is set up, switch `ManageDealersPage.jsx` from `approveDealerManualCode` /
`regenerateDealerManualCode` over to `approveDealerAndSendCode` /
`resendDealerAccessCode` (both already in `src/auth/authApi.js`) — those
call the `send-access-code` Edge Function below to actually text/WhatsApp
the code out automatically from **+91 9540102163**.

1. **Run the migration** — `supabase/dealer_access_code_migration.sql` in
   SQL Editor. Adds `dealer_access_code`, `dealer_access_code_verified`,
   `dealer_access_code_sent_at`, `dealer_access_code_attempts` to
   `profiles`, plus two functions: `generate_dealer_access_code(dealer_id)`
   (admin-only) and `verify_dealer_access_code(code)` (the signed-in dealer
   checks their own code). **This step is needed even in manual-send mode**
   — it's what generates and stores the code.

2. **(Later, once ready to automate sending)** the steps below set up
   Twilio so `send-access-code` can text/WhatsApp the code out itself.

2. **Get a Twilio account** with:
   - An **Account SID** and **Auth Token** (Twilio Console → Account).
   - A number you own, **+91 9540102163**, enabled for SMS. For WhatsApp,
     that same number needs to be set up as a Twilio **WhatsApp Sender**
     (Console → Messaging → Senders → WhatsApp) — this requires Meta
     Business verification if it isn't already a WhatsApp-approved number.
     If WhatsApp isn't ready yet, the Edge Function can be called with
     `channel: "sms"` only until it is.

3. **Deploy the Edge Function**:
   ```bash
   supabase functions deploy send-access-code
   supabase secrets set TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxx
   supabase secrets set TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxx
   supabase secrets set TWILIO_FROM_SMS=+919540102163
   supabase secrets set TWILIO_FROM_WHATSAPP=whatsapp:+919540102163
   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```
   (`SUPABASE_URL` and `SUPABASE_ANON_KEY` are already available to every
   Edge Function automatically — no need to set those two yourself.)

4. **How it's used in the app**:
   - Admin → Manage Dealers → **Approve & Send Code** sets the dealer to
     `approved`, generates a fresh code, and sends it by SMS + WhatsApp.
   - **Resend Code** on an already-approved dealer generates a new code and
     re-sends it (e.g. if the dealer lost the message).
   - After logging in, an approved dealer who hasn't verified yet is routed
     to `/dealer/verify-code` instead of the dashboard. Once they enter the
     right code, they're let into `/dealer/dashboard` and Live Auctions.

Note: this is separate from the `access_codes` table further down this
document — that one is an unrelated buyer/guest "bidding pass" demo code,
not part of dealer approval.

## What's real vs. simulated once connected
| Piece | Source of truth |
|---|---|
| Buyer/dealer/admin accounts & login | Firebase Auth + Firestore |
| Car listings created in Admin → Add Car | Supabase `cars` table |
| Dropdown lookups (brands, fuel types, etc.) | Supabase lookup tables |
| Car photos/docs uploaded from Add Car | Supabase Storage (`car-media` bucket) |
| Live Auctions demo — current bid, bid count, countdown | Supabase `cars_state` table (realtime) |
| Access codes (issued + redeemed) | Supabase `access_codes` table, via secure functions |

## What's still worth building next
- **Locking down admin writes** properly (see the ⚠️ note above) before this goes live for real users.
- **Emailing** the access ID automatically when someone requests it (a Supabase Edge Function + an email provider like Resend).
- **Ending auctions automatically** (a scheduled Supabase Edge Function or `pg_cron` job to mark cars as sold once `end_time` passes).

Let me know which of these you'd like next.
