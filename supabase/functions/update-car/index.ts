import { requireStaff, jsonResponse, corsHeaders } from "../_shared/adminAuth.ts";
import { readJson, uuid } from "../_shared/http.ts";
import { backendCommand } from "../_shared/backendCommand.ts";
import { validateCarInput } from "../_shared/carInput.ts";

// Database commands own the transaction, audit and durable outbox triggers.
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "POST only." }, 405);
  try {
    const { admin, user } = await requireStaff(req, ["admin", "manager"]);
    const { id, ...fields } = await readJson(req); uuid(id); validateCarInput(fields); const payload = { id, fields };
    const result = await backendCommand(admin, user.id, req, "update", payload);
    return jsonResponse({ ok: true, data: result.car });
  } catch (failure) {
    if (failure instanceof Response) return failure;
    return jsonResponse({ error: "Save unavailable. Retry with the same request ID." }, 503);
  }
});
