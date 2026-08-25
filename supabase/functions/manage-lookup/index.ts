// supabase/functions/manage-lookup/index.ts
// Admin-only. Covers insert/delete for every dropdown/lookup table so
// ManageLookupsPage keeps working once RLS write access is revoked.
// Body: { action: "insert" | "delete", table: string, values?: object, id?: uuid }
// Deploy: supabase functions deploy manage-lookup

import { requireStaff, jsonResponse, corsHeaders, AdminAuthError } from "../_shared/adminAuth.ts";

// Whitelist — never build a table name from raw user input directly.
const ALLOWED_TABLES = new Set([
  "states",
  "cities",
  "brands",
  "models",
  "fuel_types",
  "body_types",
  "transmissions",
  "colors",
  "vehicle_categories",
  "features",
  "specification_keys",
]);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "POST only." }, 405);

  try {
    const { admin } = await requireStaff(req, ["admin", "manager"]);
    const { action, table, values, id } = await req.json();

    if (!ALLOWED_TABLES.has(table)) {
      return jsonResponse({ error: `Table "${table}" is not allowed.` }, 400);
    }

    if (action === "insert") {
      if (!values || typeof values !== "object") {
        return jsonResponse({ error: "values object is required for insert." }, 400);
      }
      const { data, error } = await admin.from(table).insert(values).select().single();
      if (error) return jsonResponse({ error: error.message }, 400);
      return jsonResponse({ data });
    }

    if (action === "delete") {
      if (!id) return jsonResponse({ error: "id is required for delete." }, 400);
      const { error } = await admin.from(table).delete().eq("id", id);
      if (error) return jsonResponse({ error: error.message }, 400);
      return jsonResponse({ ok: true });
    }

    return jsonResponse({ error: "action must be 'insert' or 'delete'." }, 400);
  } catch (err) {
    if (err instanceof AdminAuthError) return err;
    console.error("manage-lookup error:", err);
    return jsonResponse({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});
