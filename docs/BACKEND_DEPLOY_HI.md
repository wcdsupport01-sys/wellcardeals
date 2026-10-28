# Backend upgrade live hai

26 October 2026 ko website **https://wellcardeals.com** par matching frontend,
dono SQL stages aur 18 Edge functions release ho gaye. Database ke 17 checks,
real test logins, bidding/purchase transactions, private documents aur mobile
buyer page ke checks pass hain. Us verification mein existing 31 cars, 8 bids aur
16 profiles safe the.

[Production verification](BACKEND_PRODUCTION_VERIFICATION.md) mein backup,
checks aur remaining work likha hai. Upgrade se pehle private recovery backup
banaya aur local restore/migration test kiya gaya. 28 October ko daily encrypted
database backup schedule enable hua aur pehla manual GitHub run pass hua. Usi
uploaded backup se local restore bhi verify hua: 33 public tables, 3 account
tables, 37,813 catalog records; snapshot mein 31 cars, 9 bids aur 16 profiles hain.
[Daily backup details](DAILY_DATABASE_BACKUP_HI.md) mein roz 02:00 IST ka schedule,
14-day retention aur key/token maintenance likhi hai. Full media/platform restore
alag work hai.

Owner ne 28 October ko confirm kiya: 3 purane closed auctions ki bids test thi.
Owner ne unke 5 original bid records archive karne wali SQL production mein
apply kar di. Naye encrypted backup se read-back aur restore pass hai: 5 test
bids preserved, reviewed auctions par active bids 0 aur mismatches 0; car prices/
status unchanged. [Cleanup verification](CONFIRMED_TEST_BIDS_HI.md) mein details
hain. Read-only
[backend_data_preflight.sql](../supabase/backend_data_preflight.sql) sirf counts
check karta hai, data change nahi karta.

Future release mein commands SQL → matching Edge/frontend → access SQL ka order
rakhein. [backend_release_check.sql](../supabase/backend_release_check.sql)
read-only database configuration check hai; Edge, Netlify aur authenticated
workflow checks alag verify hote hain. Detailed procedure
[BACKEND_UPGRADE.md](BACKEND_UPGRADE.md) mein hai.

Deployment token expire hone se running website band nahi hoti. Token values
secure Environment settings mein hi rakhein.
