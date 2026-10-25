import { supabase } from "./supabaseClient";
import { createBackendCommands } from "./backendOperations";
export const backendCommand = createBackendCommands(supabase);
