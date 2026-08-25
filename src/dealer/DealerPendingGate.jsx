import useDealerApplicationStatus from "./useDealerApplicationStatus";
import DealerPendingModal from "./DealerPendingModal";

// Wrap any gated element (Live Auction / Bid page, Dealer Dashboard) with
// this. If the current browser has a pending dealer application, the
// underlying page never renders — only the blocking modal does. Otherwise
// it renders `children` untouched (falling through to whatever other guard,
// e.g. ProtectedRoute, wraps it).
export default function DealerPendingGate({ children }) {
  const status = useDealerApplicationStatus();
  const isPending = status?.status === "pending";

  if (isPending) {
    return <DealerPendingModal open />;
  }

  return children;
}
