import { useState } from "react";
import { Plus } from "lucide-react";
import { inputClass } from "./FormSection";

export default function FeaturePicker({ category, allFeatures, selected, onChange, onAddNew }) {
  const [newValue, setNewValue] = useState("");
  const options = allFeatures.filter((f) => f.category === category);

  function toggle(name) {
    if (selected.includes(name)) onChange(selected.filter((s) => s !== name));
    else onChange([...selected, name]);
  }

  async function handleAdd() {
    const name = newValue.trim();
    if (!name) return;
    await onAddNew(category, name);
    onChange([...selected, name]);
    setNewValue("");
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {options.map((f) => {
          const active = selected.includes(f.name);
          return (
            <button
              type="button"
              key={f.id}
              onClick={() => toggle(f.name)}
              className={`px-3 py-1.5 rounded-full text-sm border transition ${
                active
                  ? "bg-amber-500 border-amber-500 text-black font-medium"
                  : "border-white/15 text-zinc-300 hover:bg-white/5"
              }`}
            >
              {f.name}
            </button>
          );
        })}
      </div>
      <div className="flex gap-2 pt-1">
        <input
          className={inputClass}
          placeholder={`Add a new feature...`}
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAdd())}
        />
        <button
          type="button"
          onClick={handleAdd}
          className="shrink-0 rounded-xl border border-white/10 px-3 text-amber-400 hover:bg-white/5"
        >
          <Plus size={18} />
        </button>
      </div>
    </div>
  );
}
