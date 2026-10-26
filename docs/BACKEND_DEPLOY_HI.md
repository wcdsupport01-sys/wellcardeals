# Backend upgrade live hai

26 October 2026 ko website **https://wellcardeals.com** par matching frontend,
dono SQL stages aur 18 Edge functions release ho gaye. Database ke 17 checks,
real test logins, bidding/purchase transactions, private documents aur mobile
buyer page ke checks pass hain. Existing 31 cars, 8 bids aur 16 profiles safe hain.

[Production verification](BACKEND_PRODUCTION_VERIFICATION.md) mein backup,
checks aur remaining work likha hai. Upgrade se pehle private recovery backup
banaya aur local restore/migration test kiya gaya. Daily encrypted database
backup code/restore test ready hai; [GitHub ke do secrets](DAILY_DATABASE_BACKUP_HI.md)
add karke pehla workflow run verify karna baaki hai. Full media/platform restore
alag work hai.

3 purane closed auctions ka saved price bid history se kam hai. Inka business
review baaki hai; naya sale command mismatched price ko winner confirm nahi
karega. Read-only
[backend_data_preflight.sql](../supabase/backend_data_preflight.sql) sirf counts
check karta hai, data change nahi karta.

Future release mein commands SQL → matching Edge/frontend → access SQL ka order
rakhein. [backend_release_check.sql](../supabase/backend_release_check.sql)
read-only database configuration check hai; Edge, Netlify aur authenticated
workflow checks alag verify hote hain. Detailed procedure
[BACKEND_UPGRADE.md](BACKEND_UPGRADE.md) mein hai.

Deployment token expire hone se running website band nahi hoti. Token values
secure Environment settings mein hi rakhein.
