import { supabase } from "./supabaseClient";

function distinctSorted(rows, key) {
  if (!rows || !Array.isArray(rows)) return [];
  
  const values = new Set();
  for (const row of rows) {
    if (row && row[key] !== null && row[key] !== undefined && row[key] !== "") {
      values.add(row[key]);
    }
  }
  
  return [...values].sort((a, b) =>
    typeof a === "number" ? b - a : String(a).localeCompare(String(b))
  );
}

// 1. FETCH BRANDS
export async function fetchDistinctBrands() {
  const { data, error } = await supabase
    .from("car_master_data")
    .select("oem");

  if (error) {
    console.error("❌ Supabase Error (fetchDistinctBrands):", error);
    throw error;
  }

  return distinctSorted(data, "oem");
}

// 2. FETCH MODELS
export async function fetchModelsForBrand(brand) {
  if (!brand) return [];

  const { data, error } = await supabase
    .from("car_master_data")
    .select("model")
    .eq("oem", brand);

  if (error) {
    console.error("❌ Supabase Error (fetchModelsForBrand):", error);
    throw error;
  }

  return distinctSorted(data, "model");
}

// 3. FETCH VARIANTS
export async function fetchVariantsForBrandModel(brand, model) {
  if (!brand || !model) return [];

  const { data, error } = await supabase
    .from("car_master_data")
    .select("variant")
    .eq("oem", brand)
    .eq("model", model);

  if (error) {
    console.error("❌ Supabase Error (fetchVariantsForBrandModel):", error);
    throw error;
  }

  return distinctSorted(data, "variant");
}