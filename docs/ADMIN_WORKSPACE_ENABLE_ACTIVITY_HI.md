# Admin panel ke baad Activity log enable karna

Baaki admin screens existing backend par chalti hain. Naye Activity log ke liye sirf ek SQL function add karna hai. Configured production token ne 401 diya, isliye automatic installation nahi ho saki.

1. GitHub mein `supabase/admin_workspace_activity.sql` kholo aur **Raw** se poori file copy karo.
2. Production Supabase project ka SQL Editor kholo:
   https://supabase.com/dashboard/project/zdbtlwdjmpvcmwsnkopc/sql/new
3. Project ka naam **vanshgupta12b's Project** aur reference **zdbtlwdjmpvcmwsnkopc** confirm karo. Test project `wellcardeals-test` select mat karna.
4. Nayi query mein poori SQL file paste karke **Run** dabao.
5. “Success. No rows returned” ke baad website ke Admin → Activity log ko refresh karo.

SQL ko pehle isolated test database mein verify kiya gaya hai. Yeh staff-only read function add karti hai; existing records/passwords ko update ya delete nahi karti. Dobara run karna safe hai.

## Agar automatic setup ke liye token update karna ho

- Supabase → Account → Access Tokens → Generate new token.
- Name: `wellcardeals-admin-deploy`; expiry: `24 hours`.
- Resource access: Project; organization: `shivam wcd back end`; sirf production project `vanshgupta12b's Project` select karo.
- Permissions: Project **Read**, Database **Read-write**. Is activity step ke liye baaki permissions ki zarurat nahi hai.
- Token create/copy karo. Codex Environment → Manage secrets mein `WCD_SUPABASE_PRODUCTION_DEPLOY_TOKEN` ka value update karo; allowed domain `api.supabase.com` rakho. Save karke Environment publish karo.
- Chat mein token ki value ya screenshot mat bhejna; sirf “ho gaya” batana.

Upar wala SQL Editor step karne par token update is setup ke liye zaroori nahi hai.
