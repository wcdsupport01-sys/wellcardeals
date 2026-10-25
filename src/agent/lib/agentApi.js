import { readPages } from "../../lib/readPages";
import { backendCommand } from "../../lib/backendCommands";
import { supabase } from "../../lib/supabaseClient";

// Requests assigned to the currently signed-in agent.
export async function fetchMyAssignedRequests() {
  return readPages(() => supabase.from("car_auction_requests").select("*", {count:"exact"}));
}

// The database locks the assignment, inserts the draft and links it atomically.
export async function submitAgentCar(requestId, carPayload) {
  return (await backendCommand("agent_submit", { request_id: requestId, fields: carPayload })).car;
}
