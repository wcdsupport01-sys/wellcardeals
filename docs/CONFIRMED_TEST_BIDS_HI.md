# Owner-confirmed test bids — 28 October 2026

Owner ne confirm kiya: Thar 2025, Venue 2024 aur i20 Active 2015 ki reviewed
legacy bids test thi, genuine offers nahi. Verified GitHub backup run
`40653635130` ke snapshot mein in teen auctions par **5 bid records** hain.

**SQL local restored copy par pass hai; production par abhi apply nahi hui.**
Existing production deployment credential ne HTTP 401 return kiya; expired
credential ke saath live write attempt nahi ki gayi.

## Live par run karne ka step

1. [Production SQL Editor](https://supabase.com/dashboard/project/zdbtlwdjmpvcmwsnkopc/sql/new)
   kholo: project **vanshgupta12b's Project**, ref `zdbtlwdjmpvcmwsnkopc`.
2. [archive_confirmed_test_bids_20261028.sql](../supabase/archive_confirmed_test_bids_20261028.sql)
   ka **poora code**, aakhri result wali `SELECT` samet, paste karke **Run** dabao.
3. Result mein `archived_test_bids: 5`, `active_bids_on_reviewed_auctions: 0`
   aur `cars_changed: 0` aana chahiye.

Yeh sirf isi reviewed production dataset ki one-time cleanup hai. Record ya
bid set backup ke baad change hua ho to SQL poori transaction rok degi. Error
par fingerprint/check hata kar force mat karo; current records review karo.

## Kya change hota hai

- Exact 5 original bids `backend_test_bid_archive` mein copy hoti hain, original
  car snapshot, reason, database user aur archive timestamp ke saath.
- Copy verify hone ke baad wahi 5 bids active `car_bids` se nikalti hain. Existing
  auction counts, dealer dashboards aur sale/highest-bid checks active rows use
  karte hain, isliye test bids un calculations mein nahi aayengi.
- Car price/status/winner, other bids, accounts, requests aur Sheet outbox ko
  update nahi kiya jata. Teeno cars closed aur base price par hi rehti hain.
- Archive sirf approved admin padh sakta hai; browser se archive write/delete/
  truncate blocked hai. Service/database owner recovery ke liye access rakhte hain.
- Existing daily encrypted backup exporter automatically new archive table bhi
  include karega. Pehla verified GitHub archive pre-cleanup history rakhta hai.
- Rerun same records dobara archive nahi karta aur baad ki legitimate listing/
  bid activity ko reset nahi karta.

## Restore-copy verification

Actual downloaded, authenticated GitHub backup disposable PostgreSQL 17 mein
restore karke cleanup test ki gayi. Koi production row change nahi hui.

- Changed car, missing bid, edited amount, extra bid, sold flag aur partial
  archive: har case mein whole transaction rollback; all source fingerprints same.
- Success: original 5 bids verbatim archive; 9 active bids se 4 remaining; har
  doosri public/account table, cars aur outbox ka count/content fingerprint same.
- Aggregate dealer-price mismatches: **3 → 0**; backend configuration ke all
  command/access checks pass.
- Second run: no data/archive timestamp changes. Reopened listing aur later new
  bid ke saath rerun: new activity preserved (test transaction rolled back).
- Approved admin read succeeds; public, dealer, buyer aur suspended admin read
  blocked/empty; authenticated archive update/delete/truncate denied.

Local restore container aur temporary decrypted backup check ke baad remove
kar diye. SQL Editor ka successful result production completion verify karega.
