import { useEffect, useState } from "react";
import {
  getDealerApplicationStatus,
  DEALER_APPLICATION_EVENT,
} from "./dealerApplicationSession";

// Reactive read of the current browser's dealer application status.
// Updates on same-tab changes (custom event) and cross-tab changes
// (native "storage" event) so the Home card / gates stay in sync.
export default function useDealerApplicationStatus() {
  const [status, setStatus] = useState(() => getDealerApplicationStatus());

  useEffect(() => {
    function refresh() {
      setStatus(getDealerApplicationStatus());
    }
    window.addEventListener(DEALER_APPLICATION_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(DEALER_APPLICATION_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return status;
}
