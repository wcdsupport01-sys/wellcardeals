import React from "react";
import { motion } from "framer-motion";
import { Clock3, ShieldAlert } from "lucide-react";

/**
 * Shown on the Home page when a signed-in dealer's application is still
 * "pending". Purely informational — the actual page-level blocking for
 * Live Auctions / Bid / Dealer Dashboard happens via DealerApprovalModal.
 */
export default function DealerPendingCard() {
  return (
    <section className="px-4 sm:px-6 pt-8">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative mx-auto max-w-2xl overflow-hidden rounded-3xl border border-[#DCE6FB] bg-gradient-to-br from-white via-[#F6F9FF] to-[#EAF1FF] shadow-[0_8px_30px_rgba(11,31,77,0.08)] px-6 py-8 sm:px-10 sm:py-10 text-center"
      >
        <div className="pointer-events-none absolute -top-14 -right-14 h-40 w-40 rounded-full bg-[#1E4FD9]/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-14 h-40 w-40 rounded-full bg-amber-300/10 blur-3xl" />

        <div className="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
          <Clock3 size={30} className="text-amber-600" />
        </div>

        <h2 className="relative text-2xl font-extrabold text-[#0B1F4D] tracking-tight">
          Application Under Review
        </h2>
        <p className="relative mt-2 text-[#4B5C7E] text-sm sm:text-base max-w-md mx-auto">
          Your dealership is waiting for admin approval.
        </p>

        <span className="relative mt-5 inline-flex items-center gap-1.5 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold tracking-wide px-4 py-1.5">
          <ShieldAlert size={14} /> Pending
        </span>

        <p className="relative mt-6 text-xs text-[#93A0BD]">
          Live Auctions, bidding, and the dealer dashboard will unlock automatically once you're
          approved.
        </p>
      </motion.div>
    </section>
  );
}
