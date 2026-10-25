# Backend upgrade ko live karna

Code `codex/backend-reliability` branch mein hai. Abhi production upgrade complete
nahi hua hai. GitHub push se Supabase ki SQL aur Edge functions deploy nahi hoti.

1. Supabase ka backup lekar staging copy par migration aur existing triggers check
   karein. Test ke liye real customer ke bids/passwords use nahi karein.
2. Pehle `supabase/backend_commands_v3.sql` chalayein.
3. Isi branch ki Supabase Edge functions deploy karein, phir Netlify preview check
   karke website release karein. CLI login aur platform secrets secure settings
   mein configure hon; passwords/API secrets chat ya Git mein paste na karein.
4. Aakhir mein `supabase/backend_access_v3.sql` chalayein. Buyer/dealer/staff login,
   bidding, agent review, sale completion aur private documents verify karein.

Dono SQL files ka order zaroori hai. Detailed checks aur remaining limits
[BACKEND_UPGRADE.md](BACKEND_UPGRADE.md) mein hain.
