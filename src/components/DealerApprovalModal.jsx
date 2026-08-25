import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

/**
 * Blocking modal shown any time a dealer whose application is still
 * "pending" tries to reach a dealer-only feature (Live Auctions, placing a
 * Bid, or the Dealer Dashboard).
 *
 * Usage:
 *   <DealerApprovalModal isOpen={isPendingDealer} onClose={() => ...} />
 */
export default function DealerApprovalModal({ isOpen, onClose, redirectHome = false }) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  function handleClose() {
    onClose?.();
    if (redirectHome) navigate("/", { replace: true });
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-[#0B1F4D]/60 backdrop-blur-sm"
          onClick={handleClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm rounded-3xl border border-white/60 bg-white shadow-[0_20px_60px_rgba(11,31,77,0.25)] p-7 text-center"
          >
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 text-[#93A0BD] hover:text-[#0B1F4D] transition"
              aria-label="Close"
            >
              <X size={18} />
            </button>

            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
              <Clock size={26} className="text-amber-600" />
            </div>

            <h2 className="text-lg font-bold text-[#0B1F4D] mb-2">Awaiting Approval</h2>
            <p className="text-sm text-[#4B5C7E] leading-relaxed mb-6">
              Your dealership is awaiting approval.
            </p>

            <button
              onClick={handleClose}
              className="w-full rounded-2xl bg-gradient-to-r from-[#1E4FD9] to-[#3B6BF0] hover:brightness-110 text-white font-semibold py-3 text-sm shadow-lg shadow-[#1E4FD9]/25 transition"
            >
              Back to Home
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
