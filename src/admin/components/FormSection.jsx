import { useState } from "react";
import { ChevronDown } from "lucide-react";

export default function FormSection({ title, subtitle, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-6 py-4 text-left"
      >
        <div>
          <h3 className="text-lg font-semibold text-white tracking-tight">{title}</h3>
          {subtitle && <p className="text-sm text-zinc-400 mt-0.5">{subtitle}</p>}
        </div>
        <ChevronDown
          size={20}
          className={`text-zinc-400 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="px-6 pb-6 pt-1 grid grid-cols-1 md:grid-cols-2 gap-5">{children}</div>
      )}
    </div>
  );
}

export function Field({ label, full, children, hint }) {
  return (
    <label className={`flex flex-col gap-1.5 ${full ? "md:col-span-2" : ""}`}>
      <span className="text-sm font-medium text-zinc-300">{label}</span>
      {children}
      {hint && <span className="text-xs text-zinc-500">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl bg-zinc-900/70 border border-white/10 px-4 py-2.5 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500/60 focus:border-amber-500/60 transition";
