import { useState } from "react";
import DealerApprovalModal from "../components/DealerApprovalModal";

/**
 * Rendered in place of a dealer-only page (Live Auctions, Dealer Dashboard)
 * whenever the signed-in dealer's application is still "pending". Shows the
 * "awaiting approval" modal over a neutral, empty backdrop instead of the
 * real page content, and sends the dealer back to Home when dismissed.
 */
export default function DealerPendingGate() {
  const [open, setOpen] = useState(true);
  return (
    <div className="min-h-screen bg-[#F6F9FF]">
      <DealerApprovalModal isOpen={open} onClose={() => setOpen(false)} redirectHome />
    </div>
  );
}
