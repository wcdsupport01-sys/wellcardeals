import { supabase } from "../../lib/supabaseClient";

// Requests assigned to the currently signed-in agent.
export async function fetchMyAssignedRequests() {
  const { data, error } = await supabase
    .from("car_auction_requests")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

// Submits the uploaded car for a given assigned request. Everything
// (listing_type, RLS-bypassed insert) is enforced server-side by the
// agent-add-car Edge Function — this just forwards the form payload.
export async function submitAgentCar(requestId, carPayload) {
  const { data, error } = await supabase.functions.invoke("agent-add-car", {
    body: { requestId, ...carPayload },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data.data;
}
