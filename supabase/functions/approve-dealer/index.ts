// Keep the older profile-approval route compatible while application approvals
// use the separate new-login provisioning flow.
import { approveDealer } from "../_shared/approveDealer.ts";
import { requireStaff } from "../_shared/adminAuth.ts";
import { readJson, uuid, jsonResponse, corsHeaders } from "../_shared/http.ts";
import { backendCommand } from "../_shared/backendCommand.ts";
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, {headers:corsHeaders});
  if (req.method !== "POST") return jsonResponse({error:"POST only."},405);
  try {
    const body=await readJson(req.clone());
    if (body.dealerId === undefined) return approveDealer(req);
    uuid(body.dealerId,"dealerId");
    const {admin,user}=await requireStaff(req,["admin","manager"]);
    const result=await backendCommand(admin,user.id,req,"dealer_approve",{id:body.dealerId});
    return jsonResponse(result);
  } catch (failure) {
    if (failure instanceof Response) return failure;
    return jsonResponse({error:"Approval unavailable. Retry with the same request ID."},503);
  }
});
