import { useMemo, useState } from "react";
import { Wallet } from "lucide-react";

function formatINR(n) {
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

export default function CarLoanEmi() {
  const [amount, setAmount] = useState(500000);
  const [rate, setRate] = useState(11);
  const [tenure, setTenure] = useState(48); // months

  const { emi, totalPayment, totalInterest } = useMemo(() => {
    const P = Number(amount) || 0;
    const r = (Number(rate) || 0) / 12 / 100;
    const n = Number(tenure) || 1;
    if (r === 0) {
      const emiVal = P / n;
      return { emi: emiVal, totalPayment: emiVal * n, totalInterest: 0 };
    }
    const emiVal = (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    const total = emiVal * n;
    return { emi: emiVal, totalPayment: total, totalInterest: total - P };
  }, [amount, rate, tenure]);

  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <div className="flex items-center gap-2 mb-2 text-[#1E6FD9]">
        <Wallet size={22} />
        <span className="text-sm font-semibold tracking-wide uppercase">Car Loan EMI Calculator</span>
      </div>
      <h1 className="text-3xl font-bold text-gray-900 mb-3">Estimate your monthly EMI</h1>
      <p className="text-gray-500 mb-10">Adjust the loan amount, interest rate, and tenure to see your EMI.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mb-10">
        <div>
          <div className="flex justify-between text-sm mb-1.5">
            <span className="font-medium text-gray-700">Loan Amount</span>
            <span className="text-gray-500">{formatINR(amount)}</span>
          </div>
          <input
            type="range"
            min="50000"
            max="3000000"
            step="10000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full accent-black"
          />
        </div>

        <div>
          <div className="flex justify-between text-sm mb-1.5">
            <span className="font-medium text-gray-700">Interest Rate (p.a.)</span>
            <span className="text-gray-500">{rate}%</span>
          </div>
          <input
            type="range"
            min="6"
            max="20"
            step="0.1"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            className="w-full accent-black"
          />
        </div>

        <div className="sm:col-span-2">
          <div className="flex justify-between text-sm mb-1.5">
            <span className="font-medium text-gray-700">Tenure</span>
            <span className="text-gray-500">{tenure} months</span>
          </div>
          <input
            type="range"
            min="6"
            max="84"
            step="1"
            value={tenure}
            onChange={(e) => setTenure(e.target.value)}
            className="w-full accent-black"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-gray-200 p-5 text-center">
          <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">Monthly EMI</p>
          <p className="text-2xl font-bold text-gray-900">{formatINR(emi)}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 p-5 text-center">
          <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">Total Interest</p>
          <p className="text-2xl font-bold text-gray-900">{formatINR(totalInterest)}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 p-5 text-center">
          <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">Total Payment</p>
          <p className="text-2xl font-bold text-gray-900">{formatINR(totalPayment)}</p>
        </div>
      </div>

      <p className="text-xs text-gray-400 mt-6">
        This is an estimate only. Actual EMI depends on the lender's terms, processing fees, and approval.
      </p>
    </div>
  );
}
