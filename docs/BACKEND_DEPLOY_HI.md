# Backend upgrade ko live karna

Code `codex/backend-reliability` branch mein hai. Abhi production upgrade complete
nahi hua hai. Alag `wellcardeals-test.` project par dono SQL stages aur 17 Edge
functions deploy karke real test logins se workflow checks pass hue hain.
[Verified results](BACKEND_STAGING_VERIFICATION.md) yahan hain. GitHub push se Supabase ki SQL aur Edge functions deploy nahi hoti.

Har SQL step ke baad status verify karne ke liye
[backend_release_check.sql](../supabase/backend_release_check.sql) ko SQL Editor
mein New query mein paste karke Run kar sakte hain. Yeh read-only hai: customer
data aur permissions nahi badalta, aur ek `backend_release_status` result deta hai.

- `commands_not_installed`: pehli migration abhi nahi lagi.
- `commands_ready_access_pending`: commands lagi hain; matching Edge functions
  aur website verify karein, phir permissions migration. Failed checks review karein.
- `database_checks_passed`: listed database checks pass hain; live login, Edge,
  Netlify aur workflow checks alag se karne hain.
- `review_needed`: pehli migration ke checks incomplete hain; error inspect karein.

Live ke read-only data check mein 3 purane closed auctions ka standing price
bid history se kam mila. In records ko review/reconcile karein; naya sale command
mismatched standing ko winner confirm nahi karega.
[backend_data_preflight.sql](../supabase/backend_data_preflight.sql) sirf counts
check karta hai, data change nahi karta.

1. Supabase ka backup lekar staging copy par migration aur existing triggers check
   karein. Test ke liye real customer ke bids/passwords use nahi karein.
2. Pehle [backend_commands_v3.sql](../supabase/backend_commands_v3.sql) chalayein.
3. Isi branch ki Supabase Edge functions deploy karein, phir Netlify preview check
   karke website release karein. CLI login aur platform secrets secure settings
   mein configure hon; passwords/API secrets chat ya Git mein paste na karein.
4. Aakhir mein [backend_access_v3.sql](../supabase/backend_access_v3.sql) chalayein. Buyer/dealer/staff login,
   bidding, agent review, sale completion aur private documents verify karein.

Dono SQL files ka order zaroori hai. Detailed checks aur remaining limits
[BACKEND_UPGRADE.md](BACKEND_UPGRADE.md) mein hain.
