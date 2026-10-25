import { sheetRow } from "../_shared/sheetRow.ts";
import { timedFetch } from "../_shared/requestTimeout.ts";

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const GOOGLE_SHEET_ID = Deno.env.get("GOOGLE_SHEET_ID") || "";
const GOOGLE_CLIENT_EMAIL =
  Deno.env.get("GOOGLE_CLIENT_EMAIL") || "";
const GOOGLE_PRIVATE_KEY = (
  Deno.env.get("GOOGLE_PRIVATE_KEY") || ""
).replace(/\\n/g, "\n");
const SYNC_SECRET = Deno.env.get("SHEET_SYNC_SECRET") || "";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { global: { fetch: timedFetch }, auth: { persistSession:false, autoRefreshToken:false } });

type Payload = Record<string, unknown>;

type QueueRecord = {
  id: number | string;
  sheet_tab: string;
  row_key: string;
  payload: Payload;
  attempts: number | null;
};

const HEADERS: Record<string, string[]> = {
  Sales_Log: ["timestamp","car_id","buyer_details","final_sale_price","sale_type","closing_date","commission_margin"],
  Cars_Master: [
    "timestamp",
    "car_id",
    "make_model_year",
    "seller_info",
    "status",
    "assigned_agent_id",
    "assigned_agent_name",
    "final_price",
    "listing_type",
    "listing_date",
    "sold_date",
  ],
  Agents_Directory: [
    "timestamp",
    "agent_id",
    "agent_code",
    "full_name",
    "phone",
    "email",
    "account_created",
    "active_status",
  ],
  Admin_Audit_Logs: [
    "timestamp",
    "admin_id",
    "admin_name",
    "action",
    "previous_status",
    "new_status",
    "price_change",
    "sync_queue_id",
  ],
};

const ID_COLUMNS: Record<string, string> = {
  Sales_Log: "car_id",
  Cars_Master: "car_id",
  Agents_Directory: "agent_id",
  Admin_Audit_Logs: "sync_queue_id",
};

function base64url(input: Uint8Array | string): string {
  const bytes =
    typeof input === "string"
      ? new TextEncoder().encode(input)
      : input;

  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function googleAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  const header = base64url(
    JSON.stringify({ alg: "RS256", typ: "JWT" })
  );

  const payload = base64url(
    JSON.stringify({
      iss: GOOGLE_CLIENT_EMAIL,
      scope: "https://www.googleapis.com/auth/spreadsheets",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  );

  const unsigned = `${header}.${payload}`;

  const pem = GOOGLE_PRIVATE_KEY
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");

  const keyBytes = Uint8Array.from(
    atob(pem),
    (character) => character.charCodeAt(0)
  );

  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    keyBytes,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    new TextEncoder().encode(unsigned)
  );

  const jwt = `${unsigned}.${base64url(
    new Uint8Array(signature)
  )}`;

  const response = await timedFetch(
    "https://oauth2.googleapis.com/token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type:
          "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(
      `Google authentication failed: ${response.status} ${
        (await response.text()).slice(0, 300)
      }`
    );
  }

  const data = await response.json();

  if (!data.access_token) {
    throw new Error("Google access token missing");
  }

  return data.access_token;
}

function spreadsheetBase(): string {
  return (
    "https://sheets.googleapis.com/v4/spreadsheets/" +
    encodeURIComponent(GOOGLE_SHEET_ID)
  );
}

function sheetRange(tab: string, range: string): string {
  return `'${tab.replace(/'/g, "''")}'!${range}`;
}

async function sheetsRequest(
  token: string,
  url: string,
  method = "GET",
  body?: unknown
): Promise<any> {
  const response = await timedFetch(url, { method, headers: { Authorization:`Bearer ${token}`, "Content-Type":"application/json" }, ...(body===undefined?{}:{body:JSON.stringify(body)}) });
  if (!response.ok) throw new Error(`Google Sheets API ${response.status}; pending queue record will retry.`);
  const text = await response.text(); return text ? JSON.parse(text) : {};
}

async function prepareTabs(
  token: string,
  tabs: string[]
): Promise<Record<string, string[][]>> {
  const base = spreadsheetBase();

  const metadata = await sheetsRequest(
    token,
    `${base}?fields=sheets.properties.title`
  );

  const existingTabs = new Set<string>(
    (metadata.sheets || []).map(
      (sheet: any) => sheet.properties.title
    )
  );

  const missingTabs = tabs.filter(
    (tab) => !existingTabs.has(tab)
  );

  if (missingTabs.length) {
    await sheetsRequest(token, `${base}:batchUpdate`, "POST", {
      requests: missingTabs.map((tab) => ({
        addSheet: { properties: { title: tab } },
      })),
    });
  }

  // One API read request for all required tabs.
  const params = new URLSearchParams();

  for (const tab of tabs) {
    params.append("ranges", sheetRange(tab, "A:Z"));
  }

  const result = await sheetsRequest(
    token,
    `${base}/values:batchGet?${params.toString()}`
  );

  const output: Record<string, string[][]> = {};

  tabs.forEach((tab, index) => {
    output[tab] = result.valueRanges?.[index]?.values || [];
  });

  for (const tab of tabs) {
    const header = output[tab]?.[0];
    if (header?.length && (!header.includes(ID_COLUMNS[tab]) || new Set(header).size!==header.length)) throw new Error(`Sheet ${tab} needs a unique ${ID_COLUMNS[tab]} header. Existing headers were preserved.`);
    if (!header?.length) {
      await sheetsRequest(token, `${base}/values:batchUpdate`, "POST", { valueInputOption:"RAW", data:[{range:sheetRange(tab,"A1"),values:[HEADERS[tab]]}] });
      output[tab]=[HEADERS[tab]];
    }
  }
  return output;
}

async function markSynced(
  record: QueueRecord
): Promise<void> {
  const { error } = await supabase
    .from("sheet_sync_queue")
    .update({
      status: "synced",
      synced_at: new Date().toISOString(),
      attempts: (record.attempts || 0) + 1,
      last_error: null,
    })
    .eq("id", record.id)
    .eq("status", "pending");

  if (error) throw error;
}

async function markFailed(
  record: QueueRecord,
  message: string
): Promise<void> {
  const { error } = await supabase
    .from("sheet_sync_queue")
    .update({
      attempts: (record.attempts || 0) + 1,
      last_error: message.slice(0, 1000),
    })
    .eq("id", record.id)
    .eq("status", "pending");

  if (error) console.error("Queue error:", error);
}

function jsonResponse(
  data: unknown,
  status = 200
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return jsonResponse(
      { ok: false, error: "Method not allowed" },
      405
    );
  }

  if (
    !SYNC_SECRET ||
    request.headers.get("x-sync-secret") !== SYNC_SECRET
  ) {
    return jsonResponse(
      { ok: false, error: "Unauthorized" },
      401
    );
  }

  const leaseToken = crypto.randomUUID();
  let leased = false;
  const renewLease = async () => {
    const { data,error } = await supabase.rpc("backend_sheet_lease", { p_token:leaseToken });
    if (error || !data) throw new Error("Sync lease unavailable; pending jobs retained.");
  };
  try {
    if (
      !SUPABASE_URL ||
      !SERVICE_ROLE_KEY ||
      !GOOGLE_SHEET_ID ||
      !GOOGLE_CLIENT_EMAIL ||
      !GOOGLE_PRIVATE_KEY
    ) {
      throw new Error("Required environment secrets missing");
    }

    const claim = await supabase.rpc("backend_sheet_lease", { p_token:leaseToken });
    if (claim.error) throw claim.error;
    if (!claim.data) return jsonResponse({ok:true, busy:true, processed:0});
    leased = true;
    const { data, error } = await supabase
      .from("sheet_sync_queue")
      .select("*")
      .eq("status", "pending")
      .order("id", { ascending: true })
      .limit(25);

    if (error) throw error;

    const records = (data || []) as QueueRecord[];

    if (!records.length) {
      return jsonResponse({
        ok: true,
        processed: 0,
        synced: 0,
        failed: 0,
        message: "No pending records",
      });
    }

    const errors: Array<{
      id: string;
      message: string;
    }> = [];

    let synced = 0;
    let failed = 0;

    const invalid = records.filter(
      (record) =>
        !HEADERS[record.sheet_tab] ||
        !String(record.row_key || "").trim()
    );

    const valid = records.filter(
      (record) => !invalid.includes(record)
    );

    for (const record of invalid) {
      const message = !HEADERS[record.sheet_tab]
        ? `Unsupported sheet tab: ${record.sheet_tab}`
        : "Missing row_key";

      failed++;
      errors.push({ id: String(record.id), message });
      await markFailed(record, message);
    }

    if (valid.length) {
      await renewLease();
      const token = await googleAccessToken();

      const tabs = [...new Set(
        valid.map((record) => record.sheet_tab)
      )];

      const existing = await prepareTabs(token, tabs);
      const base = spreadsheetBase();

      for (const tab of tabs) {
        await renewLease();
        const tabRecords = valid.filter(
          (record) => record.sheet_tab === tab
        );

        try {
          const rows = existing[tab];
          const headers=rows[0];
          const idIndex = headers.indexOf(
            ID_COLUMNS[tab]
          );

          const positions = new Map<string, number>();

          rows.forEach((row, index) => {
            if (index === 0) return;

            const key = String(row[idIndex] || "");
            if (key && !positions.has(key)) {
              positions.set(key, index + 1);
            }
          });

          const updates = new Map<
            number,
            { values: string[] }
          >();

          const appends = new Map<string, string[]>();

          for (const record of tabRecords) {
            const key =
              tab === "Admin_Audit_Logs"
                ? String(record.id)
                : String(record.row_key);

            const existingRow = positions.get(key);
            const previous=existingRow===undefined ? appends.get(key) : (updates.get(existingRow)?.values || rows[existingRow-1]);
            const values=sheetRow(record,headers,ID_COLUMNS[tab],previous);

            if (existingRow !== undefined) {
              // Audit records never overwrite existing logs.
              if (tab !== "Admin_Audit_Logs") {
                updates.set(existingRow, { values });
              }
            } else {
              appends.set(key,values);
            }
          }

          if (updates.size) {
            await sheetsRequest(
              token,
              `${base}/values:batchUpdate`,
              "POST",
              {
                valueInputOption: "RAW",
                data: [...updates.entries()].map(
                  ([rowNumber, item]) => ({
                    range: sheetRange(
                      tab,
                      `A${rowNumber}`
                    ),
                    values: [item.values],
                  })
                ),
              }
            );
          }

          if (appends.size) {
            await sheetsRequest(
              token,
              `${base}/values/${
                encodeURIComponent(sheetRange(tab, "A1"))
              }:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
              "POST",
              { values: [...appends.values()] }
            );
          }

          for (const record of tabRecords) {
            try {
              await markSynced(record);
              synced++;
            } catch (queueError) {
              failed++;
              errors.push({
                id: String(record.id),
                message: String(queueError).slice(0, 500),
              });
            }
          }
        } catch (tabError) {
          const message = String(tabError).slice(0, 1000);

          for (const record of tabRecords) {
            failed++;
            errors.push({
              id: String(record.id),
              message,
            });
            await markFailed(record, message);
          }
        }
      }
    }

    return jsonResponse({
      ok: failed === 0,
      processed: records.length,
      synced,
      failed,
      errors,
    });
  } catch (error) {
    console.error("Google Sheets sync failed:", error);

    return jsonResponse(
      {
        ok: false,
        error: String(error),
      },
      500
    );
  } finally {
    if (leased) { try { await supabase.rpc("backend_sheet_lease", { p_token:leaseToken, p_release:true }); } catch { /* The lease expires if release cannot be confirmed. */ } }
  }
});
