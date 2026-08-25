import { motion } from "framer-motion";
import { Clock } from "lucide-react";
import useDealerApplicationStatus from "./useDealerApplicationStatus";

// Shown at the top of the Home page whenever this browser has a dealer
// application sitting in "pending" status. Renders nothing otherwise.
export default function DealerApplicationPendingCard() {
  const status = useDealerApplicationStatus();

  if (status?.status !== "pending") return null;

  return (
    <div className="w-full flex justify-center px-4 pt-6">
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-md overflow-hidden rounded-3xl border border-[#DCE6FB] bg-gradient-to-br from-white via-[#F6F9FF] to-[#EAF1FF] p-6 text-center shadow-[0_8px_30px_rgba(11,31,77,0.08)]"
      >
        <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-[#1E4FD9]/10 blur-2xl" />

        <div className="relative mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
          <Clock size={26} className="text-amber-600" />
        </div>

        <h2 className="relative text-lg font-bold text-[#0B1F4D]">
          Application Under Review
        </h2>

        <p className="relative mt-2 text-sm leading-relaxed text-[#4B5C7E]">
          Your dealership is waiting for admin approval.
        </p>

        <span className="relative mt-4 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3.5 py-1.5 text-xs font-semibold text-amber-700">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          Pending
        </span>
      </motion.div>
    </div>
  );
}
