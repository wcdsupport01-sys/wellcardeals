import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Clock } from "lucide-react";

// Blocking modal for a pending dealer trying to reach a gated page
// (Live Auction, Bid, Dealer Dashboard). Always renders on top of a dimmed
// backdrop and offers only a way back to Home — no way to dismiss into the
// gated page, since that page shouldn't render underneath for this dealer.
export default function DealerPendingModal({ open = true }) {
  const navigate = useNavigate();

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center px-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-[#0B1F4D]/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="dealer-pending-modal-title"
            className="relative w-full max-w-sm rounded-3xl bg-white p-7 text-center shadow-2xl"
          >
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
              <Clock size={26} className="text-amber-600" />
            </div>
            <h2
              id="dealer-pending-modal-title"
              className="text-lg font-bold text-[#0B1F4D]"
            >
              Application Under Review
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[#4B5C7E]">
              Your dealership is awaiting approval.
            </p>
            <button
              onClick={() => navigate("/", { replace: true })}
              className="mt-6 w-full rounded-2xl bg-gradient-to-r from-[#1E4FD9] to-[#3B6BF0] py-3 text-sm font-semibold text-white shadow-lg shadow-[#1E4FD9]/25 transition hover:brightness-110"
            >
              Back to Home
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
