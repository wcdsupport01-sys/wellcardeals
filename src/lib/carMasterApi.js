import { supabase } from "./supabaseClient";
async function options(field, brand=null, model=null) {
  const {data,error}=await supabase.rpc("backend_vehicle_options",{p_field:field,p_brand:brand,p_model:model});
  if (error) throw error;
  return data || [];
}
export const fetchDistinctBrands = () => options("brand");
export const fetchModelsForBrand = brand => brand ? options("model",brand) : Promise.resolve([]);
export const fetchVariantsForBrandModel = (brand,model) => brand && model ? options("variant",brand,model) : Promise.resolve([]);
