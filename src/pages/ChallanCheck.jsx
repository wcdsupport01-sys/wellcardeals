import { useState } from "react";
import { Zap, Search } from "lucide-react";

export default function ChallanCheck() {
  const [reg, setReg] = useState("");
  const [checked, setChecked] = useState(false);

  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      <div className="flex items-center gap-2 mb-2 text-[#1E6FD9]">
        <Zap size={22} />
        <span className="text-sm font-semibold tracking-wide uppercase">Challan Check</span>
      </div>
      <h1 className="text-3xl font-bold text-gray-900 mb-3">Check pending traffic challans</h1>
      <p className="text-gray-500 mb-8">
        Enter a registration number to see any pending e-challans against the vehicle.
      </p>

      <div className="flex gap-2">
        <input
          value={reg}
          onChange={(e) => setReg(e.target.value.toUpperCase())}
          placeholder="e.g. DL4CAB1234"
          className="flex-1 border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm"
        />
        <button
          onClick={() => setChecked(true)}
          className="flex items-center gap-1.5 bg-[#0B2545] text-white text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-[#123a6b] transition"
        >
          <Search size={15} /> Check
        </button>
      </div>

      {checked && (
        <div className="mt-8 border border-amber-200 bg-amber-50 rounded-2xl p-6 text-sm text-amber-800">
          Challan lookup isn't connected to the government e-Challan database yet — this needs a licensed
          challan-lookup provider. Once wired up, pending challans for{" "}
          <strong>{reg || "your number"}</strong> will appear here automatically.
        </div>
      )}
    </div>
  );
}
