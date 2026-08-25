import { useState } from "react";
import { Plus, X, Loader2 } from "lucide-react";
import { inputClass } from "./FormSection";

export default function LookupSelect({ options, value, onChange, onAddNew, placeholder = "Select..." }) {
  const [adding, setAdding] = useState(false);
  const [newValue, setNewValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function handleAdd() {
    if (!newValue.trim()) return;
    setSaving(true);
    setErr("");
    try {
      const created = await onAddNew(newValue.trim());
      onChange(created.id);
      setAdding(false);
      setNewValue("");
    } catch (e) {
      setErr(e.message || "Could not add value");
    } finally {
      setSaving(false);
    }
  }

  if (adding) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex gap-2">
          <input
            autoFocus
            className={inputClass}
            placeholder="New value"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAdd())}
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={saving}
            className="shrink-0 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-medium px-3 disabled:opacity-60"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : "Add"}
          </button>
          <button
            type="button"
            onClick={() => setAdding(false)}
            className="shrink-0 rounded-xl border border-white/10 px-3 text-zinc-300 hover:bg-white/5"
          >
            <X size={16} />
          </button>
        </div>
        {err && <span className="text-xs text-red-400">{err}</span>}
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <select
        className={inputClass}
        value={value || ""}
        onChange={(e) => onChange(e.target.value || null)}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => setAdding(true)}
        title="Add new value"
        className="shrink-0 rounded-xl border border-white/10 px-3 text-amber-400 hover:bg-white/5"
      >
        <Plus size={18} />
      </button>
    </div>
  );
}
