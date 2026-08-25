import { useCallback, useEffect, useState } from "react";
import { LOOKUPS } from "../lib/lookups";
import { fetchLookup, fetchFeatures } from "../lib/carsApi";

export function useLookups() {
  const [data, setData] = useState({});
  const [features, setFeatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const entries = await Promise.all(
        Object.entries(LOOKUPS).map(async ([key, cfg]) => [
          key,
          await fetchLookup(cfg.table, cfg.orderBy),
        ])
      );
      setData(Object.fromEntries(entries));
      setFeatures(await fetchFeatures());
    } catch (e) {
      setError(e.message || "Failed to load dropdown data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { lookups: data, features, loading, error, reload };
}
