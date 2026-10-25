// Agents use the same verified JWT + approved-profile check as staff.
import { AdminAuthError, requireStaff } from "./adminAuth.ts";
export { corsHeaders, jsonResponse } from "./http.ts";
export { AdminAuthError as AgentAuthError };
export function requireAgent(req: Request) {
  return requireStaff(req, ["agent"]);
}
