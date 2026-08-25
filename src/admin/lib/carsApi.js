import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";

function requireSupabase() {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Supabase isn't configured yet — add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env (see SUPABASE_SETUP.md)."
    );
  }
  return supabase;
}

// ---------------------------------------------------------------------------
// Generic lookup helpers (states, brands, fuel_types, body_types, ...)
// ---------------------------------------------------------------------------
export async function fetchLookup(table, orderField = "name") {
  const { data, error } = await requireSupabase().from(table).select("*").order(orderField);
  if (error) throw error;
  return data;
}

// Lookup writes now go through the manage-lookup Edge Function — RLS on
// these tables is select-only, so a direct .insert()/.delete() from here
// would just get rejected. The function checks the caller is an admin,
// then writes with the service_role key.
export async function addLookupValue(table, values) {
  const { data, error } = await requireSupabase().functions.invoke("manage-lookup", {
    body: { action: "insert", table, values },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data.data;
}

export async function deleteLookupValue(table, id) {
  const { data, error } = await requireSupabase().functions.invoke("manage-lookup", {
    body: { action: "delete", table, id },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}

// Models depend on a brand
export async function fetchModelsForBrand(brandId) {
  if (!brandId) return [];
  const { data, error } = await requireSupabase()
    .from("models")
    .select("*")
    .eq("brand_id", brandId)
    .order("name");
  if (error) throw error;
  return data;
}

export async function addModel(brandId, name) {
  const { data, error } = await requireSupabase().functions.invoke("manage-lookup", {
    body: { action: "insert", table: "models", values: { brand_id: brandId, name } },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data.data;
}

// Features grouped by category
export async function fetchFeatures() {
  const { data, error } = await requireSupabase().from("features").select("*").order("name");
  if (error) throw error;
  return data;
}

export async function addFeature(category, name) {
  const { data, error } = await requireSupabase().functions.invoke("manage-lookup", {
    body: { action: "insert", table: "features", values: { category, name } },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data.data;
}

// ---------------------------------------------------------------------------
// Media upload — Supabase Storage ('car-media' bucket, public read)
// ---------------------------------------------------------------------------
export async function uploadCarFile(file, folder = "misc") {
  const ext = file.name.split(".").pop();
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;

  const { error } = await requireSupabase().storage.from("car-media").upload(path, file);
  if (error) throw error;

  const { data } = requireSupabase().storage.from("car-media").getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadManyCarFiles(files, folder) {
  const urls = [];
  for (const file of files) {
    urls.push(await uploadCarFile(file, folder));
  }
  return urls;
}

// ---------------------------------------------------------------------------
// Cars CRUD
// ---------------------------------------------------------------------------
// cars is RLS-locked to select-only now — insert/update/delete all go
// through Edge Functions that verify the caller is an admin, then write
// with the service_role key.
export async function createCar(payload) {
  const { data, error } = await requireSupabase().functions.invoke("add-car", { body: payload });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data.data;
}

export async function updateCar(id, payload) {
  const { data, error } = await requireSupabase().functions.invoke("update-car", {
    body: { id, ...payload },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data.data;
}

export async function deleteCar(id) {
  const { data, error } = await requireSupabase().functions.invoke("delete-car", { body: { id } });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}

export async function fetchCarById(id) {
  const { data, error } = await requireSupabase().from("cars").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}

export async function fetchCars({ status, channel } = {}) {
  let q = requireSupabase().from("cars").select("*").order("created_at", { ascending: false });
  if (status) q = q.eq("status", status);
  if (channel) q = q.eq("channel", channel);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}
