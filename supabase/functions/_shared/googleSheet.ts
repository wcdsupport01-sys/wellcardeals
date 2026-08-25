// supabase/functions/_shared/googleSheet.ts
// Best-effort row append to a Google Sheet tab. Never throws — a Sheet
// outage should never block a car listing or a sold-marking from saving
// in Postgres. Reuses the same GOOGLE_* secrets already set for mark-sold.
//
// Required secrets (shared across every function that imports this):
//   supabase secrets set GOOGLE_CLIENT_EMAIL="sheets-writer@your-project.iam.gserviceaccount.com"
//   supabase secrets set GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
//   supabase secrets set GOOGLE_SHEET_ID="your-sheet-id"
//
// Make sure the original tabs ("Listings", "Sheet1", "Negotiations",
// "Signups") already exist in that spreadsheet — pushRowToSheetBestEffort's
// append call does not create a missing tab.
//
// NEW: pushRowToSheetEnsuringTab() is for the newer tabs (Cars_Master,
// Agents_Directory, Admin_Audit_Logs, Sales_Log) — it auto-creates the tab
// (with the given header row) the first time it's used, if it doesn't
// already exist, then appends the row.

// NOTE: google-auth-library (and gtoken/jwa under it) call Node's
// crypto.Sign under the hood, which Deno's Node-compat layer does NOT
// implement — every call would throw "Not implemented: crypto.Sign" and
// the Sheets push would never succeed. Instead, we build + sign the JWT
// ourselves with Deno's native Web Crypto API (crypto.subtle), which IS
// supported, then exchange it for an access token directly against
// Google's OAuth endpoint. No google-auth-library dependency needed.

// Cache which tabs we've already confirmed exist this cold-start, so we
// don't re-check on every single call (Sheets API has its own rate limits).
const knownTabs = new Set<string>();

// Cache the access token in-memory for this cold start too, since each
// token is valid for ~1hr and we don't want to re-sign + re-request on
// every single row push.
let cachedToken: { token: string; expiresAt: number } | null = null;

function base64url(input: ArrayBuffer | string): string {
  const bytes =
    typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const pemBody = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const binaryDer = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8",
    binaryDer.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

async function getAccessToken(): Promise<string | null> {
  const GOOGLE_CLIENT_EMAIL = Deno.env.get("GOOGLE_CLIENT_EMAIL");
  const GOOGLE_PRIVATE_KEY = (Deno.env.get("GOOGLE_PRIVATE_KEY") || "").replace(/\\n/g, "\n");
  if (!GOOGLE_CLIENT_EMAIL || !GOOGLE_PRIVATE_KEY) return null;

  // Reuse a cached, still-valid token (60s safety margin).
  if (cachedToken && cachedToken.expiresAt - 60_000 > Date.now()) {
    return cachedToken.token;
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: GOOGLE_CLIENT_EMAIL,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
  const key = await importPrivateKey(GOOGLE_PRIVATE_KEY);
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned)
  );
  const jwt = `${unsigned}.${base64url(signature)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    console.error("Google token exchange failed:", await res.text());
    return null;
  }

  const data = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
  return cachedToken.token;
}

/**
 * Ensures a tab exists in the spreadsheet, creating it (with the given
 * header row) if it doesn't. After the first successful check per cold
 * start, the result is cached in-memory, so this adds one extra API call
 * only the very first time a new tab name is used.
 */
async function ensureTabExists(tabName: string, headers: string[]): Promise<void> {
  if (knownTabs.has(tabName)) return;

  const GOOGLE_SHEET_ID = Deno.env.get("GOOGLE_SHEET_ID");
  let token: string | null;
  try {
    token = await getAccessToken();
  } catch (e) {
    console.error("getAccessToken threw (non-fatal):", e);
    return;
  }
  if (!token || !GOOGLE_SHEET_ID) return;

  try {
    const metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}?fields=sheets.properties.title`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const meta = await metaRes.json();
    const existingTitles: string[] = (meta.sheets ?? []).map(
      (s: any) => s.properties?.title
    );

    if (existingTitles.includes(tabName)) {
      knownTabs.add(tabName);
      return;
    }

    const addRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}:batchUpdate`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [{ addSheet: { properties: { title: tabName } } }],
        }),
      }
    );
    if (!addRes.ok) {
      console.error(`Failed to create tab "${tabName}":`, await addRes.text());
      return; // best-effort — later append will just fail too, which is fine
    }

    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}/values/${encodeURIComponent(
        `${tabName}!A1`
      )}?valueInputOption=USER_ENTERED`,
      {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ values: [headers] }),
      }
    );

    knownTabs.add(tabName);
  } catch (e) {
    console.error(`ensureTabExists threw (${tabName}, non-fatal):`, e);
    // Don't cache on failure — next call will retry the check.
  }
}

/**
 * Original behavior, unchanged: appends a row to `tabName`. Silently
 * no-ops if GOOGLE_* secrets aren't configured. Never throws.
 */
export async function pushRowToSheetBestEffort(tabName: string, row: (string | number)[]) {
  const GOOGLE_SHEET_ID = Deno.env.get("GOOGLE_SHEET_ID");
  if (!Deno.env.get("GOOGLE_CLIENT_EMAIL") || !Deno.env.get("GOOGLE_PRIVATE_KEY") || !GOOGLE_SHEET_ID) {
    return; // not configured, skip silently
  }

  try {
    const token = await getAccessToken();
    if (!token) return;

    const range = `${tabName}!A1`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}/values/${encodeURIComponent(
      range
    )}:append?valueInputOption=USER_ENTERED`;
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ values: [row] }),
    });
    if (!res.ok) {
      console.error(`Sheet push failed (${tabName}):`, await res.text());
    }
  } catch (e) {
    console.error(`Sheet push threw (${tabName}, non-fatal):`, e);
  }
}

/**
 * Use this instead of pushRowToSheetBestEffort when writing to a tab that
 * might not exist yet (i.e. any of the 4 new tabs). It creates the tab +
 * header row on first use, then appends the row. Existing call sites
 * (Listings, Negotiations, Sheet1, Signups) don't need to change — keep
 * using pushRowToSheetBestEffort for those, since those tabs are already
 * created manually.
 */
export async function pushRowToSheetEnsuringTab(
  tabName: string,
  headers: string[],
  row: (string | number | null | undefined)[]
) {
  await ensureTabExists(tabName, headers);
  await pushRowToSheetBestEffort(
    tabName,
    row.map((v) => (v === null || v === undefined ? "" : v))
  );
}