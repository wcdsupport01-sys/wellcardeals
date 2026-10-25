import { readJson, uuid } from "../_shared/http.ts";
// supabase/functions/delete-car/index.ts
// Admin-only. Body: { id: uuid }
// Deploy: supabase functions deploy delete-car
import { requireStaff, jsonResponse, corsHeaders, AdminAuthError } from "../_shared/adminAuth.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "POST only." }, 405);

  try {
    // Hard delete stays admin-only. MANAGER's "permanently remove" power is
    // delisting (status='delisted' via update-car) — the row and its audit
    // trail still exist, it's just pulled from every marketplace view.
    // Actually destroying a listing is an ADMIN "override everything" action.
    const { admin } = await requireStaff(req, ["admin"]);
    const { id } = await readJson(req);
    uuid(id, "id");
    if (!id) return jsonResponse({ error: "id is required." }, 400);

    const { data, error } = await admin.from("cars").delete().eq("id", id).select("id");
    if (error?.code === "23503") return jsonResponse({ error: "This car has linked history. Archive or delist it instead." }, 409);
    if (error) return jsonResponse({ error: error.message }, 400);
    if (!data?.length) return jsonResponse({ error: "Car not found." }, 404);

    return jsonResponse({ ok: true });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("delete-car error:", err);
    return jsonResponse({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});
