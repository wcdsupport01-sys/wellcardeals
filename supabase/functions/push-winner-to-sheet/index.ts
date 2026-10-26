import { requireAdmin, jsonResponse, corsHeaders } from "../_shared/adminAuth.ts";
import { readJson, uuid } from "../_shared/http.ts";
import { backendCommand } from "../_shared/backendCommand.ts";

// Compatibility endpoint for older callers. The transaction validates the
// highest bid and closed auction, and its outbox owns the Sheet mirror.
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "POST only." }, 405);
  try {
    const { admin, user } = await requireAdmin(req);
    const { carId, role = "dealer" } = await readJson(req);
    uuid(carId);
    const result = await backendCommand(admin, user.id, req, "sale", { id: carId, track: role });
    return jsonResponse({ ok: true, data: result.car });
  } catch (failure) {
    if (failure instanceof Response) return failure;
    return jsonResponse({ error: "Save unavailable. Retry with the same request ID." }, 503);
  }
});
