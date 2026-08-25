import { useCallback, useEffect, useState } from "react";
import { fetchModelsForBrand } from "../lib/carsApi";

export function useModels(brandId) {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!brandId) {
      setModels([]);
      return;
    }
    setLoading(true);
    try {
      setModels(await fetchModelsForBrand(brandId));
    } finally {
      setLoading(false);
    }
  }, [brandId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { models, loading, reload };
}
