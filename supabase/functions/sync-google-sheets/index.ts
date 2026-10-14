
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const GOOGLE_SHEET_ID =
  Deno.env.get("GOOGLE_SHEET_ID") || "";

const GOOGLE_CLIENT_EMAIL =
  Deno.env.get("GOOGLE_CLIENT_EMAIL") || "";

const GOOGLE_PRIVATE_KEY = (
  Deno.env.get("GOOGLE_PRIVATE_KEY") || ""
).replace(/\\n/g, "\n");

const SYNC_SECRET =
  Deno.env.get("SHEET_SYNC_SECRET") || "";

const supabase = createClient(
  SUPABASE_URL,
  SERVICE_ROLE_KEY
);

type Payload = Record<string, unknown>;

type QueueRecord = {
  id: number | string;
  sheet_tab: string;
  row_key: string;
  payload: Payload;
  attempts: number | null;
};

const HEADERS: Record<string, string[]> = {
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
  ],
};

const ID_COLUMNS: Record<string, string> = {
  Cars_Master: "car_id",
  Agents_Directory: "agent_id",
};

function base64url(
  input: Uint8Array | string
): string {
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
    JSON.stringify({
      alg: "RS256",
      typ: "JWT",
    })
  );

  const payload = base64url(
    JSON.stringify({
      iss: GOOGLE_CLIENT_EMAIL,
      scope:
        "https://www.googleapis.com/auth/spreadsheets",
      aud:
        "https://oauth2.googleapis.com/token",
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

  const response = await fetch(
    "https://oauth2.googleapis.com/token",
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded",
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
      `Google authentication failed: ${
        response.status
      } ${(await response.text()).slice(0, 300)}`
    );
  }

  const data = await response.json();

  if (!data.access_token) {
    throw new Error("Google access token missing");
  }

  return data.access_token;
}

async function sheetsRequest(
  token: string,
  url: string,
  method: string,
  body?: unknown
): Promise<any> {
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    ...(body === undefined
      ? {}
      : { body: JSON.stringify(body) }),
  });

  if (!response.ok) {
    const details = await response.text();

    throw new Error(
      `Google Sheets API ${response.status}: ${
        details.slice(0, 500)
      }`
    );
  }

  return response.json();
}

function sheetRange(
  tab: string,
  range: string
): string {
  return encodeURIComponent(`'${tab}'!${range}`);
}

function spreadsheetBase(): string {
  return (
    "https://sheets.googleapis.com/v4/spreadsheets/" +
    GOOGLE_SHEET_ID
  );
}

async function ensureTab(
  token: string,
  tab: string
): Promise<void> {
  const base = spreadsheetBase();

  const metadata = await sheetsRequest(
    token,
    `${base}?fields=sheets.properties.title`,
    "GET"
  );

  const exists = (metadata.sheets || []).some(
    (sheet: any) =>
      sheet.properties?.title === tab
  );

  if (!exists) {
    await sheetsRequest(
      token,
      `${base}:batchUpdate`,
      "POST",
      {
        requests: [
          {
            addSheet: {
              properties: {
                title: tab,
              },
            },
          },
        ],
      }
    );
  }

  // Always maintain the expected header names.
  // Existing data rows are not deleted.
  await sheetsRequest(
    token,
    `${base}/values/${sheetRange(
      tab,
      "A1"
    )}?valueInputOption=RAW`,
    "PUT",
    {
      values: [HEADERS[tab]],
    }
  );
}

function valueToString(
  value: unknown
): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

function rowValues(
  tab: string,
  payload: Payload,
  rowKey: string
): string[] {
  const idColumn = ID_COLUMNS[tab];

  return HEADERS[tab].map((column) => {
    if (
      column === idColumn &&
      (payload[column] === null ||
        payload[column] === undefined ||
        payload[column] === "")
    ) {
      return rowKey;
    }

    return valueToString(payload[column]);
  });
}

async function syncRecord(
  token: string,
  record: QueueRecord
): Promise<void> {
  const tab = record.sheet_tab;

  if (!Object.prototype.hasOwnProperty.call(
    HEADERS,
    tab
  )) {
    throw new Error(
      `Unsupported sheet tab: ${tab}`
    );
  }

  const key = String(record.row_key || "");

  if (!key) {
    throw new Error("Missing row_key");
  }

  const payload =
    record.payload &&
    typeof record.payload === "object" &&
    !Array.isArray(record.payload)
      ? record.payload
      : {};

  await ensureTab(token, tab);

  const base = spreadsheetBase();
  const headers = HEADERS[tab];
  const values = rowValues(tab, payload, key);

  // Audit logs are append-only.
  // Every queue event gets its own row.
  if (tab === "Admin_Audit_Logs") {
    await sheetsRequest(
      token,
      `${base}/values/${sheetRange(
        tab,
        "A1"
      )}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      "POST",
      {
        values: [values],
      }
    );

    return;
  }

  const idColumn = ID_COLUMNS[tab];
  const idIndex = headers.indexOf(idColumn);

  if (idIndex < 0) {
    throw new Error(
      `Missing ID column for ${tab}`
    );
  }

  const valuesResult = await sheetsRequest(
    token,
    `${base}/values/${sheetRange(
      tab,
      "A:Z"
    )}`,
    "GET"
  );

  const rows: string[][] =
    valuesResult.values || [];

  const existingIndex = rows.findIndex(
    (row, index) =>
      index > 0 &&
      String(row[idIndex] || "") === key
  );

  if (existingIndex >= 0) {
    await sheetsRequest(
      token,
      `${base}/values/${sheetRange(
        tab,
        `A${existingIndex + 1}`
      )}?valueInputOption=RAW`,
      "PUT",
      {
        values: [values],
      }
    );

    return;
  }

  await sheetsRequest(
    token,
    `${base}/values/${sheetRange(
      tab,
      "A1"
    )}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    "POST",
    {
      values: [values],
    }
  );
}

function jsonResponse(
  data: unknown,
  status = 200
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return jsonResponse(
      {
        ok: false,
        error: "Method not allowed",
      },
      405
    );
  }

  if (
    !SYNC_SECRET ||
    request.headers.get("x-sync-secret") !==
      SYNC_SECRET
  ) {
    return jsonResponse(
      {
        ok: false,
        error: "Unauthorized",
      },
      401
    );
  }

  try {
    const { data: records, error } =
      await supabase
        .from("sheet_sync_queue")
        .select("*")
        .eq("status", "pending")
        .order("id", {
          ascending: true,
        })
        .limit(25);

    if (error) {
      throw error;
    }

    if (!records?.length) {
      return jsonResponse({
        ok: true,
        processed: 0,
        synced: 0,
        failed: 0,
        message: "No pending records",
      });
    }

    const token = await googleAccessToken();

    let synced = 0;
    let failed = 0;

    const errors: Array<{
      id: string;
      message: string;
    }> = [];

    for (const record of records) {
      try {
        await syncRecord(token, record);

        const { error: updateError } =
          await supabase
            .from("sheet_sync_queue")
            .update({
              status: "synced",
              synced_at:
                new Date().toISOString(),
              attempts:
                (record.attempts || 0) + 1,
              last_error: null,
            })
            .eq("id", record.id)
            .eq("status", "pending");

        if (updateError) {
          throw updateError;
        }

        synced++;
      } catch (err) {
        failed++;

        const message = String(err).slice(
          0,
          1000
        );

        errors.push({
          id: String(record.id),
          message,
        });

        const { error: queueError } =
          await supabase
            .from("sheet_sync_queue")
            .update({
              attempts:
                (record.attempts || 0) + 1,
              last_error: message,
            })
            .eq("id", record.id);

        if (queueError) {
          console.error(
            "Queue update failed:",
            queueError
          );
        }
      }
    }

    return jsonResponse({
      ok: true,
      processed: records.length,
      synced,
      failed,
      errors,
    });
  } catch (err) {
    console.error(
      "Google Sheets sync failed:",
      err
    );

    return jsonResponse(
      {
        ok: false,
        error: String(err),
      },
      500
    );
  }
});
