import { uuid, InputError } from "./http.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
// Service role is confined to this verified actor. The RPC rechecks approval
// under a profile lock and writes the operation receipt/audit in one transaction.
export async function backendCommand(admin: SupabaseClient, actor: string, req: Request, action: string, payload: Record<string, unknown>) {
  const id = req.headers.get("idempotency-key") || crypto.randomUUID();
  uuid(id, "idempotency-key");
  const { data, error } = await admin.rpc("backend_car_command", {
    p_action: action, p_payload: payload, p_operation_id: id, p_actor_id: actor,
  });
  if (error) {
    const status = error.code === "42501" ? 403 : error.code === "P0002" ? 404 : ["22023", "23505"].includes(error.code) ? 409 : error.code?.startsWith("22") || error.code?.startsWith("23") ? 400 : 503;
    throw new InputError(status === 503 ? "Save could not be confirmed. Retry with the same request ID." : error.message, status);
  }
  if (!data) throw new InputError("Save receipt unavailable. Retry with the same request ID.", 503);
  return data;
}
